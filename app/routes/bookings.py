"""Trip booking endpoints."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.dependencies.authz import require_trip_admin
from app.models.user import User
from app.schemas.booking import BookingConfirm, BookingCreate, BookingOut
from app.services.booking_service import BookingService
from app.utils.auth import get_current_user
from app.utils.database import get_db

trip_bookings_router = APIRouter(prefix="/trips", tags=["Bookings"])
bookings_router = APIRouter(prefix="/bookings", tags=["Bookings"])


@trip_bookings_router.post(
    "/{trip_id}/bookings",
    response_model=BookingOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a pending booking for a locked trip",
)
def create_booking(
    trip_id: uuid.UUID,
    data: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = BookingService.create_booking(db, trip_id, current_user, data)
    return booking


@trip_bookings_router.get(
    "/{trip_id}/bookings",
    response_model=list[BookingOut],
    status_code=status.HTTP_200_OK,
    summary="List bookings for a trip",
)
def list_trip_bookings(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = BookingService.list_trip_bookings(db, trip_id, current_user)
    return rows


@bookings_router.patch(
    "/{booking_id}/confirm",
    response_model=BookingOut,
    status_code=status.HTTP_200_OK,
    summary="Confirm a pending booking and create the trip expense",
)
def confirm_booking(
    booking_id: uuid.UUID,
    data: BookingConfirm | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trip_admin),
):
    body = data or BookingConfirm()
    booking = BookingService.confirm_booking(
        db,
        booking_id,
        current_user,
        note=body.note,
    )
    return booking
