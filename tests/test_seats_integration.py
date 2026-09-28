"""
Postgres + PostGIS integration tests for Seats matching and trust gating.

Skipped on CI SQLite. Run locally:
  DATABASE_URL=postgresql://... pytest tests/test_seats_integration.py -v
"""
from __future__ import annotations

import threading
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import delete, select, text

from app.models.group import Group, GroupMember, MemberRole
from app.models.seats import Ride, RideBooking, RideStop, Vehicle
from app.models.user import User
from app.services.ride_cost_service import compute_cost_for_region, route_distance_km
from app.services.seats_booking_service import create_booking
from app.services.seats_service import SeatsService
from app.utils.auth import hash_password
from app.utils.database import SessionLocal
from config import settings

IST = timezone(timedelta(hours=5, minutes=30))
pytestmark = pytest.mark.seats_postgres

# Mumbai / Vashi / Pune coords
MUMBAI = (19.1136, 72.8697)
VASHI = (19.0770, 72.9982)
PUNE = (18.5912, 73.7389)
PUNE_WEST = (18.5074, 73.8077)


def _requires_postgres() -> None:
    url = (settings.DATABASE_URL or "").lower()
    if "sqlite" in url:
        pytest.skip("Seats integration tests require PostgreSQL")


def _requires_seats_schema(db) -> None:
    try:
        db.execute(text("SELECT 1 FROM rides LIMIT 0"))
        db.execute(text("SELECT PostGIS_Version()"))
    except Exception:
        pytest.skip("Apply migrations/003_seats.sql before running seats integration tests")


@pytest.fixture()
def pg_db():
    _requires_postgres()
    db = SessionLocal()
    _requires_seats_schema(db)
    tag = f"seats-it-{uuid.uuid4().hex[:8]}"
    ctx = {"tag": tag, "user_ids": [], "ride_ids": [], "group_ids": []}
    yield db, ctx
    from app.models.seats import SplitEntry
    from app.models.seats import ConnectionPath

    for rid in ctx["ride_ids"]:
        booking_ids = db.execute(
            select(RideBooking.id).where(RideBooking.ride_id == rid)
        ).scalars().all()
        if booking_ids:
            db.execute(
                delete(SplitEntry).where(
                    SplitEntry.source_type == "ride_booking",
                    SplitEntry.source_id.in_(booking_ids),
                )
            )
        db.execute(delete(RideBooking).where(RideBooking.ride_id == rid))
        db.execute(delete(RideStop).where(RideStop.ride_id == rid))
        db.execute(delete(Ride).where(Ride.id == rid))
    for uid in ctx["user_ids"]:
        db.execute(delete(Vehicle).where(Vehicle.user_id == uid))
        db.execute(delete(ConnectionPath).where(ConnectionPath.viewer_id == uid))
        db.execute(delete(GroupMember).where(GroupMember.user_id == uid))
    for gid in ctx["group_ids"]:
        db.execute(delete(GroupMember).where(GroupMember.group_id == gid))
        db.execute(delete(Group).where(Group.id == gid))
    for uid in ctx["user_ids"]:
        db.execute(delete(User).where(User.id == uid))
    db.commit()
    db.close()


def _user(db, ctx, suffix: str, *, phone: str = "+919000000001") -> User:
    u = User(
        email=f"{ctx['tag']}-{suffix}@test.local",
        hashed_password=hash_password("testpass12345"),
        full_name=f"Test {suffix}",
        is_active=True,
        is_verified=True,
        phone=phone,
    )
    db.add(u)
    db.flush()
    ctx["user_ids"].append(u.id)
    return u


def _group_with(db, ctx, *users: User) -> Group:
    owner = users[0]
    g = Group(
        name=f"Seats IT {ctx['tag']}",
        description="integration",
        created_by=owner.id,
        invite_code=ctx["tag"].replace("-", "")[:12],
    )
    db.add(g)
    db.flush()
    ctx["group_ids"].append(g.id)
    for i, u in enumerate(users):
        db.add(
            GroupMember(
                group_id=g.id,
                user_id=u.id,
                role=MemberRole.admin if i == 0 else MemberRole.member,
            )
        )
    db.flush()
    return g


def _vehicle(db, user: User, ctx: dict) -> Vehicle:
    v = Vehicle(
        user_id=user.id,
        make="Test",
        model="Car",
        plate=f"MH{ctx['tag'].replace('-', '')[:8]}",
        mileage_kmpl=15.0,
        seats=4,
    )
    db.add(v)
    db.flush()
    return v


def _publish(
    db,
    ctx,
    driver: User,
    stops: list[tuple[str, float, float]],
    *,
    approval: str = "instant",
    seats_offered: int = 4,
    price_paise: int | None = None,
) -> Ride:
    vehicle = _vehicle(db, driver, ctx)
    stop_dicts = [{"label": s[0], "lat": s[1], "lon": s[2]} for s in stops]
    distance = route_distance_km([(s[1], s[2]) for s in stops])
    basis = compute_cost_for_region(
        db,
        distance_km=distance,
        mileage_kmpl=15.0,
        tolls_paise=None,
        seats_offered=seats_offered,
        region="IN-MH",
    )
    price = price_paise if price_paise is not None else basis.max_per_seat_paise
    tomorrow = datetime.now(IST) + timedelta(days=1)
    ride = SeatsService.publish_ride(
        db,
        driver,
        stops=stop_dicts,
        depart_at=tomorrow.replace(hour=5, minute=30, second=0, microsecond=0),
        arrive_est_at=tomorrow.replace(hour=9, minute=0, second=0, microsecond=0),
        seats_offered=seats_offered,
        visibility="groups",
        approval=approval,
        price_per_seat_paise=price,
        mileage_kmpl=15.0,
        vehicle_id=vehicle.id,
        tolls_paise=None,
        note=ctx["tag"],
        region="IN-MH",
    )
    ctx["ride_ids"].append(ride.id)
    return ride


def test_publish_no_tolls_sets_estimated(pg_db):
    db, ctx = pg_db
    driver = _user(db, ctx, "driver")
    _group_with(db, ctx, driver)
    db.commit()
    ride = _publish(
        db,
        ctx,
        driver,
        [("Mumbai", *MUMBAI), ("Pune", *PUNE)],
    )
    assert ride.cost_basis.get("tolls_estimated") is True


def test_publish_above_cap_422(pg_db):
    db, ctx = pg_db
    driver = _user(db, ctx, "driver")
    _group_with(db, ctx, driver)
    db.commit()
    coords = [MUMBAI, PUNE]
    distance = route_distance_km(coords)
    basis = compute_cost_for_region(
        db,
        distance_km=distance,
        mileage_kmpl=15.0,
        tolls_paise=None,
        seats_offered=3,
        region="IN-MH",
    )
    vehicle = _vehicle(db, driver, ctx)
    with pytest.raises(HTTPException) as ei:
        SeatsService.publish_ride(
            db,
            driver,
            stops=[{"label": "A", "lat": MUMBAI[0], "lon": MUMBAI[1]}, {"label": "B", "lat": PUNE[0], "lon": PUNE[1]}],
            depart_at=datetime.now(IST) + timedelta(days=1),
            arrive_est_at=None,
            seats_offered=3,
            visibility="groups",
            approval="instant",
            price_per_seat_paise=basis.max_per_seat_paise + 100,
            mileage_kmpl=15.0,
            vehicle_id=vehicle.id,
            tolls_paise=None,
            note=ctx["tag"],
        )
    assert ei.value.status_code == 422


def test_vashi_to_pune_finds_mumbai_pune_ride(pg_db):
    db, ctx = pg_db
    driver = _user(db, ctx, "driver")
    viewer = _user(db, ctx, "viewer")
    _group_with(db, ctx, driver, viewer)
    db.commit()
    _publish(
        db,
        ctx,
        driver,
        [
            ("Mumbai Andheri", *MUMBAI),
            ("Vashi", *VASHI),
            ("Pune Hinjawadi", *PUNE),
        ],
    )
    db.commit()
    day = (datetime.now(IST) + timedelta(days=1)).date()
    hits = SeatsService.search_rides(
        db,
        viewer,
        from_lat=VASHI[0],
        from_lon=VASHI[1],
        to_lat=PUNE[0],
        to_lon=PUNE[1],
        day=day,
        seats=1,
    )
    assert len(hits) >= 1


def test_reverse_ride_not_in_mumbai_pune_search(pg_db):
    db, ctx = pg_db
    driver = _user(db, ctx, "driver")
    viewer = _user(db, ctx, "viewer")
    _group_with(db, ctx, driver, viewer)
    db.commit()
    _publish(
        db,
        ctx,
        driver,
        [
            ("Pune", *PUNE),
            ("Mumbai", *MUMBAI),
        ],
    )
    db.commit()
    day = (datetime.now(IST) + timedelta(days=1)).date()
    hits = SeatsService.search_rides(
        db,
        viewer,
        from_lat=MUMBAI[0],
        from_lon=MUMBAI[1],
        to_lat=PUNE[0],
        to_lon=PUNE[1],
        day=day,
        seats=1,
    )
    assert len(hits) == 0


def test_stranger_ride_invisible_and_404(pg_db):
    db, ctx = pg_db
    driver = _user(db, ctx, "driver")
    stranger_driver = _user(db, ctx, "stranger-driver")
    viewer = _user(db, ctx, "viewer")
    _group_with(db, ctx, driver, viewer)
    # Stranger driver in their own group — viewer has no shared group with them
    lone = Group(
        name=f"Lone {ctx['tag']}",
        description="no viewer",
        created_by=stranger_driver.id,
        invite_code=f"L{ctx['tag'].replace('-', '')[:11]}",
    )
    db.add(lone)
    db.flush()
    ctx["group_ids"].append(lone.id)
    db.add(
        GroupMember(
            group_id=lone.id,
            user_id=stranger_driver.id,
            role=MemberRole.admin,
        )
    )
    db.commit()
    visible_ride = _publish(db, ctx, driver, [("Mumbai", *MUMBAI), ("Pune", *PUNE)])
    secret_ride = _publish(
        db, ctx, stranger_driver, [("Mumbai", *MUMBAI), ("Pune", *PUNE)]
    )
    db.commit()
    day = (datetime.now(IST) + timedelta(days=1)).date()
    hits = SeatsService.search_rides(
        db,
        viewer,
        from_lat=MUMBAI[0],
        from_lon=MUMBAI[1],
        to_lat=PUNE[0],
        to_lon=PUNE[1],
        day=day,
        seats=1,
    )
    ids = {h["id"] for h in hits}
    assert str(visible_ride.id) in ids
    assert str(secret_ride.id) not in ids

    with pytest.raises(HTTPException) as ei:
        SeatsService.get_ride_detail(db, viewer, secret_ride.id)
    assert ei.value.status_code == 404


def test_concurrent_booking_last_seat_pg(pg_db):
    db, ctx = pg_db
    driver = _user(db, ctx, "driver")
    rider_a = _user(db, ctx, "rider-a")
    rider_b = _user(db, ctx, "rider-b")
    _group_with(db, ctx, driver, rider_a, rider_b)
    db.commit()
    ride = _publish(
        db,
        ctx,
        driver,
        [("Mumbai", *MUMBAI), ("Pune", *PUNE)],
        seats_offered=1,
    )
    db.commit()
    ride_id = ride.id
    results: list = []
    errors: list = []

    def attempt(rider_id: uuid.UUID) -> None:
        s = SessionLocal()
        try:
            b = create_booking(
                s,
                ride_id=ride_id,
                rider_id=rider_id,
                seats=1,
                board_seq=0,
                alight_seq=1,
            )
            results.append(b)
        except HTTPException as e:
            errors.append(e.status_code)
        finally:
            s.close()

    t1 = threading.Thread(target=attempt, args=(rider_a.id,))
    t2 = threading.Thread(target=attempt, args=(rider_b.id,))
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    assert len(results) == 1
    assert 409 in errors

    check = SessionLocal()
    try:
        row = check.get(Ride, ride_id)
        assert row is not None
        assert row.seats_taken == 1
    finally:
        check.close()


def test_manual_hold_decrements_availability(pg_db):
    db, ctx = pg_db
    driver = _user(db, ctx, "driver")
    rider = _user(db, ctx, "rider")
    _group_with(db, ctx, driver, rider)
    db.commit()
    ride = _publish(
        db,
        ctx,
        driver,
        [("Mumbai", *MUMBAI), ("Pune", *PUNE)],
        approval="manual",
        seats_offered=2,
    )
    db.commit()
    create_booking(
        db,
        ride_id=ride.id,
        rider_id=rider.id,
        seats=1,
        board_seq=0,
        alight_seq=1,
    )
    refreshed = db.get(Ride, ride.id)
    assert refreshed is not None
    assert refreshed.seats_taken == 1


def test_split_emission_idempotent(pg_db):
    db, ctx = pg_db
    from app.models.seats import SplitEntry

    driver = _user(db, ctx, "driver")
    rider = _user(db, ctx, "rider")
    _group_with(db, ctx, driver, rider)
    db.commit()
    ride = _publish(
        db,
        ctx,
        driver,
        [("Mumbai", *MUMBAI), ("Pune", *PUNE)],
        seats_offered=2,
    )
    booking = create_booking(
        db,
        ride_id=ride.id,
        rider_id=rider.id,
        seats=1,
        board_seq=0,
        alight_seq=1,
    )
    booking.status = "completed"
    db.commit()
    e1 = SeatsService.emit_split_on_complete(db, booking.id)
    e2 = SeatsService.emit_split_on_complete(db, booking.id)
    assert e1 is not None
    assert e2 is not None
    assert e1.id == e2.id
    count = db.execute(
        select(SplitEntry).where(
            SplitEntry.source_type == "ride_booking",
            SplitEntry.source_id == booking.id,
        )
    ).scalars().all()
    assert len(count) == 1
