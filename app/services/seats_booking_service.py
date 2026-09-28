"""Seat booking transactions and lifecycle."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.seats import Ride, RideBooking
from app.services.notification_service import NotificationService
from app.services.seats_visibility_service import is_blocked, trust_path_for
from app.utils.exceptions import AppException

_ACTIVE_STATUSES = frozenset({"requested", "held", "confirmed"})


def _hold_expires_at(depart_at: datetime) -> datetime:
    now = datetime.now(timezone.utc)
    cap = now + timedelta(hours=24)
    depart_cap = depart_at - timedelta(hours=2)
    return min(cap, depart_cap)


def adjust_seats_taken(db: Session, ride_id: uuid.UUID, delta: int) -> None:
    ride = db.execute(
        select(Ride).where(Ride.id == ride_id).with_for_update()
    ).scalar_one()
    new_taken = ride.seats_taken + delta
    if new_taken < 0 or new_taken > ride.seats_offered:
        AppException.conflict("Not enough seats available")
    ride.seats_taken = new_taken
    if new_taken >= ride.seats_offered:
        ride.status = "full"
    elif ride.status == "full":
        ride.status = "open"


def create_booking(
    db: Session,
    *,
    ride_id: uuid.UUID,
    rider_id: uuid.UUID,
    seats: int,
    board_seq: int,
    alight_seq: int,
    message: str | None = None,
) -> RideBooking:
    try:
        ride = db.execute(
            select(Ride).where(Ride.id == ride_id).with_for_update()
        ).scalar_one_or_none()
    except Exception:
        ride = None

    if ride is None or ride.status not in ("open", "full"):
        AppException.not_found("Ride not found")

    if is_blocked(db, rider_id, ride.driver_id):
        AppException.not_found("Ride not found")

    # visibility check via SQL function
    visible = db.execute(
        text("SELECT seats_visible_to(:ride_id, :viewer)"),
        {"ride_id": ride_id, "viewer": rider_id},
    ).scalar_one()
    if not visible:
        AppException.not_found("Ride not found")

    free = ride.seats_offered - ride.seats_taken
    if seats > free:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Not enough seats", "seats_free": free},
        )

    pending_count = db.execute(
        select(RideBooking.id).where(
            RideBooking.rider_id == rider_id,
            RideBooking.status.in_(("requested", "held")),
        )
    ).scalars().all()
    if len(pending_count) >= 5:
        AppException.bad_request("Too many pending seat requests")

    status = "confirmed" if ride.approval == "instant" else "held"
    expires = None if status == "confirmed" else _hold_expires_at(ride.depart_at)

    booking = RideBooking(
        ride_id=ride_id,
        rider_id=rider_id,
        seats=seats,
        board_seq=board_seq,
        alight_seq=alight_seq,
        status=status,
        price_paise=ride.price_per_seat_paise,
        expires_at=expires,
        message=message,
        trust_path=trust_path_for(db, rider_id, ride.driver_id),
    )

    try:
        ride.seats_taken += seats
        if ride.seats_taken >= ride.seats_offered:
            ride.status = "full"
        db.add(booking)
        db.flush()
    except IntegrityError:
        db.rollback()
        AppException.conflict("Seat just taken")

    if status == "held":
        NotificationService.append_in_app(
            db,
            ride.driver_id,
            "seats_request",
            "New seat request",
            f"Someone asked to join your ride",
            {"ride_id": str(ride_id), "booking_id": str(booking.id)},
        )

    db.commit()
    db.refresh(booking)
    return booking


def decide_booking(
    db: Session,
    *,
    booking_id: uuid.UUID,
    driver_id: uuid.UUID,
    approve: bool,
) -> RideBooking:
    booking = db.execute(
        select(RideBooking).where(RideBooking.id == booking_id).with_for_update()
    ).scalar_one_or_none()
    if booking is None:
        AppException.not_found("Booking not found")

    ride = db.get(Ride, booking.ride_id)
    if ride is None or ride.driver_id != driver_id:
        AppException.not_found("Booking not found")

    if booking.status != "held":
        AppException.conflict("Booking is not pending approval")

    booking.decided_at = datetime.now(timezone.utc)
    if approve:
        booking.status = "confirmed"
        booking.expires_at = None
        NotificationService.append_in_app(
            db,
            booking.rider_id,
            "seats_approved",
            "Seat approved",
            "Your seat request was approved",
            {"booking_id": str(booking.id), "ride_id": str(ride.id)},
        )
    else:
        booking.status = "declined"
        adjust_seats_taken(db, ride.id, -booking.seats)
        NotificationService.append_in_app(
            db,
            booking.rider_id,
            "seats_declined",
            "Request declined",
            "The driver declined your seat request",
            {"booking_id": str(booking.id)},
        )

    db.commit()
    db.refresh(booking)
    return booking


def withdraw_booking(db: Session, *, booking_id: uuid.UUID, rider_id: uuid.UUID) -> RideBooking:
    booking = db.execute(
        select(RideBooking).where(RideBooking.id == booking_id).with_for_update()
    ).scalar_one_or_none()
    if booking is None or booking.rider_id != rider_id:
        AppException.not_found("Booking not found")

    if booking.status not in ("held", "requested"):
        AppException.conflict("Cannot withdraw this booking")

    booking.status = "cancelled_rider"
    booking.decided_at = datetime.now(timezone.utc)
    adjust_seats_taken(db, booking.ride_id, -booking.seats)
    db.commit()
    db.refresh(booking)
    return booking


def release_stale_holds(db: Session) -> int:
    now = datetime.now(timezone.utc)
    stale = db.execute(
        select(RideBooking).where(
            RideBooking.status == "held",
            RideBooking.expires_at.is_not(None),
            RideBooking.expires_at < now,
        )
    ).scalars().all()

    count = 0
    for booking in stale:
        booking.status = "cancelled_rider"
        booking.decided_at = now
        try:
            adjust_seats_taken(db, booking.ride_id, -booking.seats)
            count += 1
        except Exception:
            continue
    if count:
        db.commit()
    return count
