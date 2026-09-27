"""Seats — publish, search, detail, watches, me."""
from __future__ import annotations

import hashlib
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.orm import Session, selectinload

from app.models.seats import Ride, RideBooking, RideStop, RideWatch, SplitEntry, Vehicle
from app.models.user import User
from app.services.notification_service import NotificationService
from app.services.ride_cost_service import (
    assert_price_within_cap,
    compute_cost_for_region,
    format_money,
    route_distance_km,
)
from app.services.seats_visibility_service import (
    is_blocked,
    rebuild_connection_paths,
    trust_path_for,
)
from app.utils.exceptions import AppException

IST = timezone(timedelta(hours=5, minutes=30))
METRO_RADIUS_M = 5000
INTERCITY_RADIUS_M = 25000


def _geohash_key(from_lat: float, from_lon: float, to_lat: float, to_lon: float) -> str:
    raw = f"{round(from_lat, 3)}:{round(from_lon, 3)}:{round(to_lat, 3)}:{round(to_lon, 3)}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _update_route_geom(db: Session, ride_id: uuid.UUID) -> None:
    db.execute(
        text(
            """
            UPDATE rides SET route_geom = (
              SELECT ST_MakeLine(geog::geometry ORDER BY seq)::geography
              FROM ride_stops WHERE ride_id = :ride_id
            )
            WHERE id = :ride_id
            """
        ),
        {"ride_id": ride_id},
    )


def _set_route_geom_line(db: Session, ride_id: uuid.UUID, coordinates: list[list[float]]) -> None:
    if len(coordinates) < 2:
        _update_route_geom(db, ride_id)
        return
    parts = []
    for pair in coordinates:
        if len(pair) < 2:
            continue
        lon, lat = float(pair[0]), float(pair[1])
        parts.append(f"{lon} {lat}")
    if len(parts) < 2:
        _update_route_geom(db, ride_id)
        return
    wkt = f"LINESTRING({','.join(parts)})"
    db.execute(
        text(
            """
            UPDATE rides
            SET route_geom = ST_SetSRID(ST_GeomFromText(:wkt), 4326)::geography
            WHERE id = :ride_id
            """
        ),
        {"ride_id": ride_id, "wkt": wkt},
    )


_VEHICLE_LABELS = {
    "sedan": "Sedan",
    "suv": "SUV",
    "compact_hatchback": "Compact / Hatchback",
    "minivan": "Minivan",
}


def _vehicle_for_card(db: Session, row: dict[str, Any]) -> dict[str, Any]:
    cb = row.get("cost_basis") or {}
    body = cb.get("vehicle_body_type")
    vid = row.get("vehicle_id")
    if vid:
        vehicle = db.get(Vehicle, vid)
        if vehicle:
            return {
                "make": vehicle.make,
                "model": vehicle.model,
                "body_type": body,
                "display": f"{vehicle.make} {vehicle.model}",
            }
    display = _VEHICLE_LABELS.get(body, "Four-wheeler") if body else "Four-wheeler"
    return {"make": None, "model": None, "body_type": body, "display": display}


def _route_summary_from_basis(cost_basis: dict[str, Any] | None) -> str | None:
    if not cost_basis:
        return None
    parts: list[str] = []
    label = cost_basis.get("route_label")
    if isinstance(label, str) and label.strip():
        parts.append(label.strip())
    miles = cost_basis.get("route_distance_miles")
    if isinstance(miles, (int, float)) and miles > 0:
        parts.append(f"{miles:.1f} mi" if miles < 10 else f"{int(round(miles))} mi")
    return " · ".join(parts) if parts else None


def _driver_rating(db: Session, driver_id: uuid.UUID) -> str:
    # Placeholder until ratings table wired — stable for sort
    completed = db.execute(
        select(RideBooking.id).where(
            RideBooking.ride_id.in_(
                select(Ride.id).where(Ride.driver_id == driver_id)
            ),
            RideBooking.status == "completed",
        )
    ).scalars().all()
    base = 4.5 + min(len(completed), 20) * 0.02
    return f"{min(base, 4.95):.1f}"


def _ride_to_card(
    db: Session,
    row: dict[str, Any],
    viewer_id: uuid.UUID,
) -> dict[str, Any]:
    driver = db.get(User, row["driver_id"])
    seats_free = row["seats_offered"] - row["seats_taken"]
    cost_basis = row.get("cost_basis") or {}
    return {
        "id": str(row["id"]),
        "depart_at": row["depart_at"].isoformat(),
        "arrive_est_at": row["arrive_est_at"].isoformat() if row.get("arrive_est_at") else None,
        "board_seq": row.get("board_seq"),
        "alight_seq": row.get("alight_seq"),
        "seats_offered": row["seats_offered"],
        "seats_free": seats_free,
        "approval": row["approval"],
        "price_per_seat": format_money(row["price_per_seat_paise"]),
        "max_per_seat": format_money(row["max_per_seat_paise"]),
        "note": row.get("note"),
        "driver": {
            "id": str(row["driver_id"]),
            "name": driver.full_name if driver else "Driver",
            "username": driver.username if driver else None,
            "verified": bool(driver and (driver.is_verified or driver.phone)),
            "profile_public": bool(driver.profile_public) if driver else False,
            "rating": _driver_rating(db, row["driver_id"]),
            "ride_count": row.get("ride_count", 0),
        },
        "vehicle": _vehicle_for_card(db, row),
        "route_summary": _route_summary_from_basis(cost_basis),
        "stops": row.get("stops", []),
    }


class SeatsService:
    @staticmethod
    def search_rides(
        db: Session,
        viewer: User,
        *,
        from_lat: float,
        from_lon: float,
        to_lat: float,
        to_lon: float,
        day: date,
        seats: int = 1,
        sort: str = "earliest",
        radius_m: int = INTERCITY_RADIUS_M,
    ) -> list[dict[str, Any]]:
        rebuild_connection_paths(db, viewer.id)
        db.commit()

        window_start = datetime.combine(day, datetime.min.time(), tzinfo=IST)
        window_end = window_start + timedelta(days=1)

        order = {
            "earliest": "r.depart_at ASC",
            "cheapest": "r.price_per_seat_paise ASC",
            "rated": "r.depart_at ASC",
        }.get(sort, "r.depart_at ASC")

        sql = text(
            f"""
            WITH rider AS (
              SELECT ST_SetSRID(ST_MakePoint(:from_lon, :from_lat), 4326)::geography AS a,
                     ST_SetSRID(ST_MakePoint(:to_lon, :to_lat), 4326)::geography AS b
            ),
            legs AS (
              SELECT r.id,
                     MIN(sa.seq) AS board_seq,
                     MAX(sb.seq) AS alight_seq
              FROM rides r
              JOIN ride_stops sa ON sa.ride_id = r.id
              JOIN ride_stops sb ON sb.ride_id = r.id
              CROSS JOIN rider
              WHERE r.status IN ('open', 'full')
                AND r.depart_at >= :window_start AND r.depart_at < :window_end
                AND (r.seats_offered - r.seats_taken) >= :seats
                AND ST_DWithin(sa.geog, rider.a, :radius_m)
                AND ST_DWithin(sb.geog, rider.b, :radius_m)
                AND sa.seq < sb.seq
                AND seats_visible_to(r.id, :viewer_id)
              GROUP BY r.id
            )
            SELECT r.*, l.board_seq, l.alight_seq
            FROM legs l
            JOIN rides r ON r.id = l.id
            ORDER BY {order}
            """
        )

        try:
            rows = db.execute(
                sql,
                {
                    "from_lat": from_lat,
                    "from_lon": from_lon,
                    "to_lat": to_lat,
                    "to_lon": to_lon,
                    "window_start": window_start,
                    "window_end": window_end,
                    "seats": seats,
                    "radius_m": radius_m,
                    "viewer_id": viewer.id,
                },
            ).mappings().all()
        except Exception:
            return []

        out: list[dict[str, Any]] = []
        for row in rows:
            if is_blocked(db, viewer.id, row["driver_id"]):
                continue
            stops = db.execute(
                select(RideStop).where(RideStop.ride_id == row["id"]).order_by(RideStop.seq)
            ).scalars().all()
            card = _ride_to_card(db, dict(row), viewer.id)
            card["stops"] = [
                {"seq": s.seq, "label": s.label, "lat": s.lat, "lon": s.lon} for s in stops
            ]
            out.append(card)
        return out

    @staticmethod
    def get_ride_detail(db: Session, viewer: User, ride_id: uuid.UUID) -> dict[str, Any]:
        visible = db.execute(
            text("SELECT seats_visible_to(:ride_id, :viewer)"),
            {"ride_id": ride_id, "viewer": viewer.id},
        ).scalar_one()
        if not visible:
            AppException.not_found("Ride not found")

        ride = db.execute(
            select(Ride).where(Ride.id == ride_id).options(selectinload(Ride.stops))
        ).scalar_one_or_none()
        if ride is None or is_blocked(db, viewer.id, ride.driver_id):
            AppException.not_found("Ride not found")

        driver = db.get(User, ride.driver_id)
        return {
            "id": str(ride.id),
            "depart_at": ride.depart_at.isoformat(),
            "arrive_est_at": ride.arrive_est_at.isoformat() if ride.arrive_est_at else None,
            "seats_offered": ride.seats_offered,
            "seats_free": ride.seats_offered - ride.seats_taken,
            "approval": ride.approval,
            "visibility": ride.visibility,
            "status": ride.status,
            "price_per_seat": format_money(ride.price_per_seat_paise),
            "max_per_seat": format_money(ride.max_per_seat_paise),
            "cost_total": format_money(ride.cost_total_paise),
            "note": ride.note,
            "driver": {
                "id": str(ride.driver_id),
                "name": driver.full_name if driver else "Driver",
                "verified": bool(driver and (driver.is_verified or driver.phone)),
                "rating": _driver_rating(db, ride.driver_id),
            },
            "trust_path": trust_path_for(db, viewer.id, ride.driver_id),
            "stops": [
                {"seq": s.seq, "label": s.label, "lat": s.lat, "lon": s.lon, "eta": s.eta.isoformat() if s.eta else None}
                for s in ride.stops
            ],
        }

    @staticmethod
    def preview_cost(
        db: Session,
        *,
        stops: list[dict[str, Any]],
        mileage_kmpl: float,
        seats_offered: int,
        tolls_paise: int | None,
        region: str = "IN-MH",
    ) -> dict[str, Any]:
        coords = [(float(s["lat"]), float(s["lon"])) for s in stops]
        distance = route_distance_km(coords)
        basis = compute_cost_for_region(
            db,
            distance_km=distance,
            mileage_kmpl=mileage_kmpl,
            tolls_paise=tolls_paise,
            seats_offered=seats_offered,
            region=region,
        )
        return {
            "cost_basis": basis.to_dict(),
            "cost_total": format_money(basis.cost_total_paise),
            "max_per_seat": format_money(basis.max_per_seat_paise),
            "distance_km": basis.distance_km,
        }

    @staticmethod
    def publish_ride(
        db: Session,
        driver: User,
        *,
        stops: list[dict[str, Any]],
        depart_at: datetime,
        arrive_est_at: datetime | None,
        seats_offered: int,
        visibility: str,
        approval: str,
        price_per_seat_paise: int,
        mileage_kmpl: float,
        vehicle_id: uuid.UUID | None,
        tolls_paise: int | None,
        note: str | None,
        region: str = "IN-MH",
        route_geometry: list[list[float]] | None = None,
        route_distance_meters: float | None = None,
        route_distance_miles: float | None = None,
        vehicle_body_type: str | None = None,
        route_option_id: str | None = None,
        route_label: str | None = None,
    ) -> Ride:
        if visibility not in ("groups", "fof", "public"):
            AppException.bad_request("Invalid visibility")
        if not driver.phone:
            AppException.bad_request("Phone verification required before offering rides")

        coords = [(float(s["lat"]), float(s["lon"])) for s in stops]
        if route_distance_meters is not None and route_distance_meters > 0:
            distance = float(route_distance_meters) / 1000.0
        else:
            distance = route_distance_km(coords)
        basis = compute_cost_for_region(
            db,
            distance_km=distance,
            mileage_kmpl=mileage_kmpl,
            tolls_paise=tolls_paise,
            seats_offered=seats_offered,
            region=region,
        )
        assert_price_within_cap(price_per_seat_paise, basis)

        cost_basis = basis.to_dict()
        if vehicle_body_type:
            cost_basis["vehicle_body_type"] = vehicle_body_type
        if route_option_id:
            cost_basis["route_option_id"] = route_option_id
        if route_label:
            cost_basis["route_label"] = route_label
        if route_distance_miles is not None:
            cost_basis["route_distance_miles"] = route_distance_miles
        elif route_distance_meters is not None:
            cost_basis["route_distance_miles"] = float(route_distance_meters) / 1609.344

        ride = Ride(
            driver_id=driver.id,
            vehicle_id=vehicle_id,
            region_code=region,
            depart_at=depart_at,
            arrive_est_at=arrive_est_at,
            seats_offered=seats_offered,
            visibility=visibility,
            approval=approval,
            status="open",
            distance_km=distance,
            cost_total_paise=basis.cost_total_paise,
            max_per_seat_paise=basis.max_per_seat_paise,
            price_per_seat_paise=price_per_seat_paise,
            cost_basis=cost_basis,
            note=note,
        )
        db.add(ride)
        db.flush()

        for i, s in enumerate(stops):
            db.execute(
                text(
                    """
                    INSERT INTO ride_stops (ride_id, seq, label, lat, lon, geog)
                    VALUES (
                      :ride_id, :seq, :label, :lat, :lon,
                      ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
                    )
                    """
                ),
                {
                    "ride_id": ride.id,
                    "seq": i,
                    "label": str(s["label"]),
                    "lat": float(s["lat"]),
                    "lon": float(s["lon"]),
                },
            )
        if route_geometry and len(route_geometry) >= 2:
            _set_route_geom_line(db, ride.id, route_geometry)
        else:
            _update_route_geom(db, ride.id)

        db.commit()
        db.refresh(ride)
        SeatsService._match_watches_on_publish(db, ride)
        db.commit()
        return ride

    @staticmethod
    def _match_watches_on_publish(db: Session, ride: Ride) -> None:
        sql = text(
            """
            SELECT w.*
            FROM ride_watches w
            WHERE w.active = true
              AND (w.date_from IS NULL OR w.date_from <= :depart_date)
              AND (w.date_to IS NULL OR w.date_to >= :depart_date)
              AND EXISTS (
                SELECT 1 FROM ride_stops sa, ride_stops sb
                WHERE sa.ride_id = :ride_id AND sb.ride_id = :ride_id
                  AND sa.seq < sb.seq
                  AND ST_DWithin(sa.geog, w.from_geog, w.radius_m)
                  AND ST_DWithin(sb.geog, w.to_geog, w.radius_m)
                  AND (SELECT seats_offered - seats_taken FROM rides WHERE id = :ride_id) >= w.seats
              )
            """
        )
        try:
            watches = db.execute(
                sql,
                {"ride_id": ride.id, "depart_date": ride.depart_at.date()},
            ).mappings().all()
        except Exception:
            return

        now = datetime.now(timezone.utc)
        for w in watches:
            last = w.get("last_alert_at")
            if last and (now - last).total_seconds() < 86400:
                continue
            NotificationService.append_in_app(
                db,
                w["user_id"],
                "seats_watch_match",
                "Seat opened on watched route",
                "A new ride matches your route watch",
                {"ride_id": str(ride.id), "watch_id": str(w["id"])},
            )
            db.execute(
                text("UPDATE ride_watches SET last_alert_at = :now WHERE id = :id"),
                {"now": now, "id": w["id"]},
            )

    @staticmethod
    def _rider_summary(db: Session, rider_id: uuid.UUID) -> dict[str, Any]:
        rider = db.get(User, rider_id)
        return {
            "id": str(rider_id),
            "name": rider.full_name if rider else "Rider",
            "username": rider.username if rider else None,
            "verified": bool(rider and (rider.is_verified or rider.phone)),
            "profile_public": bool(rider.profile_public) if rider else False,
        }

    @staticmethod
    def _driver_summary(db: Session, driver_id: uuid.UUID) -> dict[str, Any]:
        driver = db.get(User, driver_id)
        return {
            "id": str(driver_id),
            "name": driver.full_name if driver else "Driver",
            "username": driver.username if driver else None,
            "verified": bool(driver and (driver.is_verified or driver.phone)),
            "profile_public": bool(driver.profile_public) if driver else False,
        }

    @staticmethod
    def me_dashboard(db: Session, user: User) -> dict[str, Any]:
        driving = db.execute(
            select(Ride)
            .where(Ride.driver_id == user.id, Ride.status.in_(("open", "full", "departed")))
            .options(selectinload(Ride.bookings), selectinload(Ride.stops))
            .order_by(Ride.depart_at)
        ).scalars().all()

        riding = db.execute(
            select(RideBooking)
            .join(Ride)
            .where(
                RideBooking.rider_id == user.id,
                RideBooking.status.in_(("held", "confirmed")),
            )
            .options(selectinload(RideBooking.ride).selectinload(Ride.stops))
        ).scalars().all()

        history_driving = db.execute(
            select(Ride)
            .where(
                Ride.driver_id == user.id,
                Ride.status.in_(("completed", "cancelled")),
            )
            .options(selectinload(Ride.stops))
            .order_by(Ride.depart_at.desc())
            .limit(30)
        ).scalars().all()

        history_riding = db.execute(
            select(RideBooking)
            .join(Ride)
            .where(
                RideBooking.rider_id == user.id,
                RideBooking.status.in_(("completed", "cancelled", "declined", "expired")),
            )
            .options(selectinload(RideBooking.ride).selectinload(Ride.stops))
            .order_by(Ride.depart_at.desc())
            .limit(30)
        ).scalars().all()

        pending_requests: list[dict[str, Any]] = []
        for ride in driving:
            held = [b for b in ride.bookings if b.status == "held"]
            if not held:
                continue
            riders = []
            for b in held:
                riders.append(
                    {
                        "booking_id": str(b.id),
                        "rider": SeatsService._rider_summary(db, b.rider_id),
                        "seats": b.seats,
                        "trust_path": b.trust_path,
                    }
                )
            pending_requests.append(
                {
                    "ride_id": str(ride.id),
                    "depart_at": ride.depart_at.isoformat(),
                    "stops": [{"label": s.label} for s in ride.stops],
                    "request_count": len(held),
                    "requests": riders,
                }
            )

        return {
            "driving": [
                {
                    "ride_id": str(r.id),
                    "depart_at": r.depart_at.isoformat(),
                    "status": r.status,
                    "seats_free": r.seats_offered - r.seats_taken,
                    "pending_count": len([b for b in r.bookings if b.status == "held"]),
                }
                for r in driving
            ],
            "riding": [
                {
                    "booking_id": str(b.id),
                    "status": b.status,
                    "seats": b.seats,
                    "price_total": format_money(b.price_paise * b.seats),
                    "driver": SeatsService._driver_summary(db, b.ride.driver_id),
                    "ride": {
                        "id": str(b.ride.id),
                        "depart_at": b.ride.depart_at.isoformat(),
                        "stops": [{"label": s.label} for s in b.ride.stops],
                    },
                }
                for b in riding
            ],
            "history_driving": [
                {
                    "ride_id": str(r.id),
                    "depart_at": r.depart_at.isoformat(),
                    "status": r.status,
                    "stops": [{"label": s.label} for s in r.stops],
                }
                for r in history_driving
            ],
            "history_riding": [
                {
                    "booking_id": str(b.id),
                    "status": b.status,
                    "seats": b.seats,
                    "price_total": format_money(b.price_paise * b.seats),
                    "driver": SeatsService._driver_summary(db, b.ride.driver_id),
                    "ride": {
                        "id": str(b.ride.id),
                        "depart_at": b.ride.depart_at.isoformat(),
                        "stops": [{"label": s.label} for s in b.ride.stops],
                    },
                }
                for b in history_riding
            ],
            "pending_as_driver": pending_requests,
            "pending_count": sum(p["request_count"] for p in pending_requests),
            "profile_public": bool(user.profile_public),
        }

    @staticmethod
    def cancel_ride(db: Session, driver: User, ride_id: uuid.UUID) -> Ride:
        ride = db.execute(
            select(Ride)
            .where(Ride.id == ride_id)
            .options(selectinload(Ride.bookings))
            .with_for_update()
        ).scalar_one_or_none()
        if ride is None or ride.driver_id != driver.id:
            AppException.not_found("Ride not found")
        if ride.status not in ("open", "full"):
            AppException.conflict("Cannot cancel this ride")

        ride.status = "cancelled"
        ride.driver_cancel_count = (ride.driver_cancel_count or 0) + 1
        for booking in ride.bookings:
            if booking.status in ("held", "confirmed", "requested"):
                booking.status = "cancelled"
                booking.decided_at = datetime.now(timezone.utc)
        ride.seats_taken = 0
        db.commit()
        db.refresh(ride)
        return ride

    @staticmethod
    @staticmethod
    def list_watches(db: Session, user: User) -> list[RideWatch]:
        return list(
            db.execute(
                select(RideWatch)
                .where(RideWatch.user_id == user.id, RideWatch.active.is_(True))
                .order_by(RideWatch.created_at.desc())
            )
            .scalars()
            .all()
        )

    @staticmethod
    def create_watch(
        db: Session,
        user: User,
        *,
        from_lat: float,
        from_lon: float,
        to_lat: float,
        to_lon: float,
        from_label: str | None,
        to_label: str | None,
        date_from: date | None,
        date_to: date | None,
        seats: int,
    ) -> RideWatch:
        gh = _geohash_key(from_lat, from_lon, to_lat, to_lon)
        watch = RideWatch(
            user_id=user.id,
            from_lat=from_lat,
            from_lon=from_lon,
            to_lat=to_lat,
            to_lon=to_lon,
            from_label=(from_label or "").strip() or None,
            to_label=(to_label or "").strip() or None,
            geohash_key=gh,
            date_from=date_from,
            date_to=date_to,
            seats=seats,
        )
        db.add(watch)
        db.flush()
        db.execute(
            text(
                """
                UPDATE ride_watches SET
                  from_geog = ST_SetSRID(ST_MakePoint(:from_lon, :from_lat), 4326)::geography,
                  to_geog = ST_SetSRID(ST_MakePoint(:to_lon, :to_lat), 4326)::geography
                WHERE id = :id
                """
            ),
            {
                "id": watch.id,
                "from_lat": from_lat,
                "from_lon": from_lon,
                "to_lat": to_lat,
                "to_lon": to_lon,
            },
        )
        db.commit()
        db.refresh(watch)
        return watch

    @staticmethod
    def emit_split_on_complete(db: Session, booking_id: uuid.UUID) -> SplitEntry | None:
        booking = db.get(RideBooking, booking_id)
        if booking is None or booking.status != "completed":
            return None

        existing = db.execute(
            select(SplitEntry).where(
                SplitEntry.source_type == "ride_booking",
                SplitEntry.source_id == booking.id,
            )
        ).scalar_one_or_none()
        if existing:
            return existing

        ride = db.get(Ride, booking.ride_id)
        if ride is None:
            return None

        board = db.execute(
            select(RideStop.label).where(
                RideStop.ride_id == ride.id, RideStop.seq == booking.board_seq
            )
        ).scalar_one_or_none()
        alight = db.execute(
            select(RideStop.label).where(
                RideStop.ride_id == ride.id, RideStop.seq == booking.alight_seq
            )
        ).scalar_one_or_none()

        amount = booking.price_paise * booking.seats
        reason = f"Seat · {board or '?'} → {alight or '?'}"
        entry = SplitEntry(
            from_user_id=booking.rider_id,
            to_user_id=ride.driver_id,
            amount_paise=amount,
            reason=reason,
            source_type="ride_booking",
            source_id=booking.id,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry
