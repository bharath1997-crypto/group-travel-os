"""Authorization dependencies for route handlers."""
from __future__ import annotations

from uuid import UUID

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.booking import Booking
from app.models.group import GroupMember, MemberRole
from app.models.poll import Poll
from app.models.trip import Trip
from app.models.user import User
from app.utils.auth import get_current_user
from app.utils.database import get_db
from app.utils.exceptions import AppException


async def require_trip_admin(
    trip_id: UUID | None = None,
    poll_id: UUID | None = None,
    booking_id: UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Trip creator or group admin only.
    Pass trip_id (lock route), poll_id (resolve route), or booking_id (confirm route).
    """
    resolved_trip_id = trip_id
    if resolved_trip_id is None:
        if poll_id is not None:
            poll = db.execute(select(Poll).where(Poll.id == poll_id)).scalar_one_or_none()
            if not poll:
                AppException.not_found("Poll not found")
            resolved_trip_id = poll.trip_id
        elif booking_id is not None:
            booking = db.execute(
                select(Booking).where(Booking.id == booking_id)
            ).scalar_one_or_none()
            if not booking:
                AppException.not_found("Booking not found")
            resolved_trip_id = booking.trip_id
        else:
            AppException.bad_request("trip_id, poll_id, or booking_id is required")

    trip = db.execute(select(Trip).where(Trip.id == resolved_trip_id)).scalar_one_or_none()
    if not trip:
        AppException.not_found("Trip not found")

    if trip.created_by == current_user.id:
        return current_user

    admin = db.execute(
        select(GroupMember).where(
            GroupMember.group_id == trip.group_id,
            GroupMember.user_id == current_user.id,
            GroupMember.role == MemberRole.admin,
        )
    ).scalar_one_or_none()
    if admin:
        return current_user

    AppException.forbidden("Admin access required for this trip")
