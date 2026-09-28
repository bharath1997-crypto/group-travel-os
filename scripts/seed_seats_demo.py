#!/usr/bin/env python3
"""
Seed demo Seats rides: Mumbai ↔ Pune corridor (India-first).

Creates (or reuses):
- Group "Mumbai Commute" with driver + demo rider
- 3 open rides matching the UI mock (Arjun, Neha, Rahul)
- 1 reverse Pune→Mumbai ride (for negative matching tests)

Requires: PostGIS + migrations/003_seats.sql applied.

Run from repo root:
  python scripts/seed_seats_demo.py
  python scripts/seed_seats_demo.py --wipe   # remove prior demo rows first
"""
from __future__ import annotations

import argparse
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sqlalchemy import delete, select, text

from app.models.group import Group, GroupMember, MemberRole
from app.models.seats import Ride, RideBooking, RideStop, Vehicle
from app.models.user import User
from app.services.ride_cost_service import compute_cost_for_region, route_distance_km
from app.services.seats_service import SeatsService
from app.utils.auth import hash_password
from app.utils.database import SessionLocal

IST = timezone(timedelta(hours=5, minutes=30))

DEMO_GROUP_NAME = "Mumbai Commute"
DEMO_TAG = "seats-demo-v1"

DRIVERS = [
    {
        "email": "seats-arjun@rovvy.demo",
        "name": "Arjun M.",
        "seats_offered": 4,
        "seats_taken": 1,
        "approval": "instant",
        "price_paise": 47000,
        "note": "Leaves on the dot. One bag each, no smoking.",
        "depart_hm": (5, 30),
        "arrive_hm": (8, 45),
        "from_label": "Mumbai, Andheri East",
        "to_label": "Pune, Hinjawadi",
        "stops": [
            ("Mumbai, Andheri East", 19.1136, 72.8697),
            ("Vashi", 19.0770, 72.9982),
            ("Panvel", 18.9881, 73.1102),
            ("Pune, Hinjawadi", 18.5912, 73.7389),
        ],
    },
    {
        "email": "seats-neha@rovvy.demo",
        "name": "Neha S.",
        "seats_offered": 4,
        "seats_taken": 2,
        "approval": "manual",
        "price_paise": 52000,
        "note": "Music OK, quiet after 8. Pickup at station only.",
        "depart_hm": (6, 15),
        "arrive_hm": (9, 40),
        "from_label": "Mumbai, Bandra",
        "to_label": "Pune, Koregaon Park",
        "stops": [
            ("Mumbai, Bandra", 19.0596, 72.8295),
            ("Panvel", 18.9881, 73.1102),
            ("Pune, Koregaon Park", 18.5362, 73.8937),
        ],
    },
    {
        "email": "seats-rahul@rovvy.demo",
        "name": "Rahul D.",
        "seats_offered": 3,
        "seats_taken": 2,
        "approval": "instant",
        "price_paise": 44500,
        "note": "Early bird. Small bags in boot only.",
        "depart_hm": (7, 0),
        "arrive_hm": (10, 20),
        "from_label": "Mumbai, Dadar",
        "to_label": "Pune, Kothrud",
        "stops": [
            ("Mumbai, Dadar", 19.0178, 72.8478),
            ("Lonavala", 18.7546, 73.4062),
            ("Pune, Kothrud", 18.5074, 73.8077),
        ],
    },
]

REVERSE_DRIVER = {
    "email": "seats-reverse@rovvy.demo",
    "name": "Reverse Driver",
    "stops": [
        ("Pune, Hinjawadi", 18.5912, 73.7389),
        ("Lonavala", 18.7546, 73.4062),
        ("Mumbai, Andheri East", 19.1136, 72.8697),
    ],
}

RIDER_EMAIL = "seats-rider@rovvy.demo"
STRANGER_EMAIL = "seats-stranger@rovvy.demo"


def _ensure_user(db, email: str, name: str, *, phone: str = "+919876543210") -> User:
    row = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if row:
        if not row.phone:
            row.phone = phone
        return row
    u = User(
        email=email,
        hashed_password=hash_password("demo-seats-pass-2026"),
        full_name=name,
        is_active=True,
        is_verified=True,
        phone=phone,
    )
    db.add(u)
    db.flush()
    return u


def _ensure_group(db, owner: User) -> Group:
    g = db.execute(select(Group).where(Group.name == DEMO_GROUP_NAME)).scalar_one_or_none()
    if g:
        return g
    g = Group(
        name=DEMO_GROUP_NAME,
        description="Demo group for Seats Mumbai - Pune",
        created_by=owner.id,
        invite_code="SEATS01",
    )
    db.add(g)
    db.flush()
    db.add(GroupMember(group_id=g.id, user_id=owner.id, role=MemberRole.admin))
    return g


def _ensure_member(db, group: Group, user: User) -> None:
    exists = db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group.id,
            GroupMember.user_id == user.id,
        )
    ).scalar_one_or_none()
    if not exists:
        db.add(GroupMember(group_id=group.id, user_id=user.id, role=MemberRole.member))


def _ensure_vehicle(db, user: User) -> Vehicle:
    v = db.execute(select(Vehicle).where(Vehicle.user_id == user.id)).scalar_one_or_none()
    if v:
        return v
    v = Vehicle(
        user_id=user.id,
        make="Maruti",
        model="Swift",
        plate="MH-01-SE-0001",
        mileage_kmpl=15.0,
        seats=4,
    )
    db.add(v)
    db.flush()
    return v


def _tomorrow_ist(h: int, m: int) -> datetime:
    now = datetime.now(IST)
    day = (now + timedelta(days=1)).date()
    return datetime(day.year, day.month, day.day, h, m, tzinfo=IST)


def _wipe_demo(db) -> None:
    demo_emails = [d["email"] for d in DRIVERS] + [REVERSE_DRIVER["email"], RIDER_EMAIL, STRANGER_EMAIL]
    users = db.execute(select(User).where(User.email.in_(demo_emails))).scalars().all()
    uids = [u.id for u in users]
    if uids:
        rides = db.execute(select(Ride).where(Ride.driver_id.in_(uids))).scalars().all()
        ride_ids = [r.id for r in rides]
        if ride_ids:
            db.execute(delete(RideBooking).where(RideBooking.ride_id.in_(ride_ids)))
            db.execute(delete(RideStop).where(RideStop.ride_id.in_(ride_ids)))
            db.execute(delete(Ride).where(Ride.id.in_(ride_ids)))
        db.execute(delete(Vehicle).where(Vehicle.user_id.in_(uids)))
    db.commit()
    print(f"Wiped demo rides for {len(uids)} users")


def _publish(
    db,
    driver: User,
    vehicle: Vehicle,
    spec: dict,
    *,
    depart_at: datetime,
    arrive_est_at: datetime,
    seats_taken: int = 0,
) -> Ride:
    note_tag = f"{DEMO_TAG} · {spec.get('note', '')}"
    existing = db.execute(
        select(Ride).where(
            Ride.driver_id == driver.id,
            Ride.note == note_tag,
        )
    ).scalar_one_or_none()
    if existing:
        return existing

    stops = [{"label": s[0], "lat": s[1], "lon": s[2]} for s in spec["stops"]]
    coords = [(s[1], s[2]) for s in spec["stops"]]
    distance = route_distance_km(coords)
    basis = compute_cost_for_region(
        db,
        distance_km=distance,
        mileage_kmpl=15.0,
        tolls_paise=None,
        seats_offered=spec["seats_offered"],
        region="IN-MH",
    )
    # Demo prices in spec are illustrative; cap is enforced server-side
    price_paise = min(spec["price_paise"], basis.max_per_seat_paise)
    ride = SeatsService.publish_ride(
        db,
        driver,
        stops=stops,
        depart_at=depart_at,
        arrive_est_at=arrive_est_at,
        seats_offered=spec["seats_offered"],
        visibility="groups",
        approval=spec["approval"],
        price_per_seat_paise=price_paise,
        mileage_kmpl=15.0,
        vehicle_id=vehicle.id,
        tolls_paise=None,
        note=f"{DEMO_TAG} · {spec.get('note', '')}",
        region="IN-MH",
    )
    if seats_taken:
        ride.seats_taken = seats_taken
        if seats_taken >= ride.seats_offered:
            ride.status = "full"
        db.commit()
        db.refresh(ride)
    return ride


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--wipe", action="store_true", help="Remove prior demo rides")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        db.execute(text("SELECT PostGIS_Version()"))
    except Exception as e:
        print("ERROR: PostGIS required. Apply migrations/003_seats.sql first.", e)
        sys.exit(1)

    if args.wipe:
        _wipe_demo(db)

    arjun = _ensure_user(db, DRIVERS[0]["email"], DRIVERS[0]["name"])
    group = _ensure_group(db, arjun)
    rider = _ensure_user(db, RIDER_EMAIL, "Demo Rider")
    stranger = _ensure_user(db, STRANGER_EMAIL, "Stranger User", phone="+919999999999")
    _ensure_member(db, group, rider)
    # stranger intentionally NOT in group

    db.commit()

    published: list[Ride] = []
    for spec in DRIVERS:
        driver = _ensure_user(db, spec["email"], spec["name"])
        _ensure_member(db, group, driver)
        vehicle = _ensure_vehicle(db, driver)
        dh, dm = spec["depart_hm"]
        ah, am = spec["arrive_hm"]
        ride = _publish(
            db,
            driver,
            vehicle,
            spec,
            depart_at=_tomorrow_ist(dh, dm),
            arrive_est_at=_tomorrow_ist(ah, am),
            seats_taken=spec["seats_taken"],
        )
        published.append(ride)
        print(f"  OK {spec['name']} ride {ride.id} ({ride.seats_offered - ride.seats_taken} free)")

    rev_driver = _ensure_user(db, REVERSE_DRIVER["email"], REVERSE_DRIVER["name"])
    _ensure_member(db, group, rev_driver)
    rev_vehicle = _ensure_vehicle(db, rev_driver)
    rev_spec = {
        **REVERSE_DRIVER,
        "seats_offered": 3,
        "seats_taken": 0,
        "approval": "instant",
        "price_paise": 45000,
        "note": "Reverse corridor test ride",
    }
    reverse_ride = _publish(
        db,
        rev_driver,
        rev_vehicle,
        rev_spec,
        depart_at=_tomorrow_ist(9, 0),
        arrive_est_at=_tomorrow_ist(12, 30),
    )
    print(f"  OK Reverse Pune-Mumbai ride {reverse_ride.id}")

    db.commit()
    print(f"\nDone — {len(published) + 1} rides. Demo rider: {RIDER_EMAIL}")
    print(f"Group: {DEMO_GROUP_NAME} (invite SEATS01). Stranger (no access): {STRANGER_EMAIL}")


if __name__ == "__main__":
    main()
