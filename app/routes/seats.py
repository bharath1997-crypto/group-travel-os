"""Seats API routes — thin handlers."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.seats import (
    BookingCreateIn,
    BookingDecisionIn,
    CostPreviewIn,
    RidePatchIn,
    RidePublishIn,
    WatchCreateIn,
    WatchOut,
)
from app.services.seats_booking_service import (
    create_booking,
    decide_booking,
    withdraw_booking,
)
from app.services.seats_service import SeatsService
from app.utils.auth import get_current_user
from app.utils.database import get_db
from app.utils.exceptions import AppException

seats_router = APIRouter(prefix="/seats", tags=["Seats"])


@seats_router.get("/rides")
def search_rides(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    from_lat: float = Query(...),
    from_lon: float = Query(...),
    to_lat: float = Query(...),
    to_lon: float = Query(...),
    date: str = Query(..., description="YYYY-MM-DD"),
    seats: int = Query(1, ge=1, le=4),
    sort: str = Query("earliest"),
):
    from datetime import date as date_type

    try:
        day = date_type.fromisoformat(date)
    except ValueError:
        AppException.bad_request("Invalid date")
    return SeatsService.search_rides(
        db,
        current_user,
        from_lat=from_lat,
        from_lon=from_lon,
        to_lat=to_lat,
        to_lon=to_lon,
        day=day,
        seats=seats,
        sort=sort,
    )


@seats_router.post("/rides", status_code=status.HTTP_201_CREATED)
def publish_ride(
    body: RidePublishIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ride = SeatsService.publish_ride(
        db,
        current_user,
        stops=[s.model_dump() for s in body.stops],
        depart_at=body.depart_at,
        arrive_est_at=body.arrive_est_at,
        seats_offered=body.seats_offered,
        visibility=body.visibility,
        approval=body.approval,
        price_per_seat_paise=body.price_per_seat_paise,
        mileage_kmpl=body.mileage_kmpl,
        vehicle_id=body.vehicle_id,
        tolls_paise=body.tolls_paise,
        note=body.note,
        region=body.region,
        route_geometry=body.route_geometry,
        route_distance_meters=body.route_distance_meters,
        route_distance_miles=body.route_distance_miles,
        vehicle_body_type=body.vehicle_body_type,
        route_option_id=body.route_option_id,
        route_label=body.route_label,
    )
    return {"id": str(ride.id), "status": ride.status}


@seats_router.get("/rides/{ride_id}")
def get_ride(
    ride_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return SeatsService.get_ride_detail(db, current_user, ride_id)


@seats_router.patch("/rides/{ride_id}")
def patch_ride(
    ride_id: uuid.UUID,
    body: RidePatchIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.status == "cancelled":
        ride = SeatsService.cancel_ride(db, current_user, ride_id)
        return {"id": str(ride.id), "status": ride.status}
    AppException.bad_request("No changes applied")


@seats_router.post("/rides/{ride_id}/cost")
def preview_cost(
    ride_id: uuid.UUID,
    body: CostPreviewIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = ride_id  # wizard may call before ride exists; id reserved for future edit flow
    return SeatsService.preview_cost(
        db,
        stops=[s.model_dump() for s in body.stops],
        mileage_kmpl=body.mileage_kmpl,
        seats_offered=body.seats_offered,
        tolls_paise=body.tolls_paise,
        region=body.region,
    )


@seats_router.post("/rides/{ride_id}/bookings", status_code=status.HTTP_201_CREATED)
def book_ride(
    ride_id: uuid.UUID,
    body: BookingCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = create_booking(
        db,
        ride_id=ride_id,
        rider_id=current_user.id,
        seats=body.seats,
        board_seq=body.board_seq,
        alight_seq=body.alight_seq,
        message=body.message,
    )
    return {
        "id": str(booking.id),
        "status": booking.status,
        "expires_at": booking.expires_at.isoformat() if booking.expires_at else None,
    }


@seats_router.patch("/bookings/{booking_id}")
def patch_booking(
    booking_id: uuid.UUID,
    body: BookingDecisionIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.action == "withdraw":
        booking = withdraw_booking(db, booking_id=booking_id, rider_id=current_user.id)
    elif body.action == "approve":
        booking = decide_booking(
            db, booking_id=booking_id, driver_id=current_user.id, approve=True
        )
    else:
        booking = decide_booking(
            db, booking_id=booking_id, driver_id=current_user.id, approve=False
        )
    return {"id": str(booking.id), "status": booking.status}


@seats_router.get("/me")
def seats_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return SeatsService.me_dashboard(db, current_user)


@seats_router.get("/watches", response_model=list[WatchOut])
def list_watches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return SeatsService.list_watches(db, current_user)


@seats_router.post("/watches", status_code=status.HTTP_201_CREATED)
def create_watch(
    body: WatchCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    watch = SeatsService.create_watch(
        db,
        current_user,
        from_lat=body.from_lat,
        from_lon=body.from_lon,
        to_lat=body.to_lat,
        to_lon=body.to_lon,
        from_label=body.from_label,
        to_label=body.to_label,
        date_from=body.date_from,
        date_to=body.date_to,
        seats=body.seats,
    )
    return {"id": str(watch.id), "active": watch.active}


@seats_router.get("/watches/unread-alerts")
def seats_watch_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.notification_service import NotificationService

    rows = NotificationService.get_notifications(db, current_user, limit=100, offset=0)
    unread_seats = sum(
        1
        for r in rows
        if not r.is_read and r.type == "seats_watch_match"
    )
    watch_count = len(SeatsService.list_watches(db, current_user))
    return {"unread_alerts": unread_seats, "active_watches": watch_count}


@seats_router.delete("/watches/{watch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_watch(
    watch_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.seats import RideWatch

    watch = db.get(RideWatch, watch_id)
    if watch is None or watch.user_id != current_user.id:
        AppException.not_found("Watch not found")
    watch.active = False
    db.commit()
