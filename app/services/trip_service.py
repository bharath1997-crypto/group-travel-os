"""
app/services/trip_service.py — Trip business logic

Rules:
- Session is always injected — never created here
- All errors raised via AppException
"""
from __future__ import annotations

import logging
import uuid
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.group import GroupMember, MemberRole
from app.models.trip import Trip, TripStatus
from app.models.user import User
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)


def _validate_start_end(start: date | None, end: date | None) -> None:
    if start is not None and end is not None and start > end:
        AppException.bad_request("start_date must be on or before end_date")


def _trip_update_payload(data: Any) -> dict[str, Any]:
    """Normalize Pydantic models, dicts, or plain objects to a field dict."""
    if hasattr(data, "model_dump"):
        return data.model_dump(exclude_unset=True)
    if isinstance(data, dict):
        return dict(data)
    out: dict[str, Any] = {}
    for key in ("title", "description", "start_date", "end_date"):
        if hasattr(data, key):
            out[key] = getattr(data, key)
    return out


class TripService:

    @staticmethod
    def _verify_membership(db: Session, group_id: uuid.UUID, user_id: uuid.UUID) -> GroupMember:
        row = db.execute(
            select(GroupMember).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == user_id,
            )
        ).scalar_one_or_none()
        if not row:
            AppException.forbidden("You are not a member of this group")
        return row

    @staticmethod
    def _is_creator_or_admin(db: Session, trip: Trip, user_id: uuid.UUID) -> bool:
        if trip.created_by == user_id:
            return True
        admin = db.execute(
            select(GroupMember).where(
                GroupMember.group_id == trip.group_id,
                GroupMember.user_id == user_id,
                GroupMember.role == MemberRole.admin,
            )
        ).scalar_one_or_none()
        return admin is not None

    @staticmethod
    def create_trip(
        db: Session,
        group_id: uuid.UUID,
        data: Any,
        current_user: User,
    ) -> Trip:
        TripService._verify_membership(db, group_id, current_user.id)

        title = getattr(data, "title", None)
        if title is None or (isinstance(title, str) and not title.strip()):
            AppException.bad_request("title is required")

        start_date = getattr(data, "start_date", None)
        end_date = getattr(data, "end_date", None)
        _validate_start_end(start_date, end_date)

        trip = Trip(
            group_id=group_id,
            title=title.strip() if isinstance(title, str) else title,
            description=getattr(data, "description", None),
            status=TripStatus.planning,
            start_date=start_date,
            end_date=end_date,
            created_by=current_user.id,
        )
        db.add(trip)
        db.commit()
        db.refresh(trip)
        logger.info("Trip created: %s in group %s", trip.id, group_id)
        return trip

    @staticmethod
    def get_trip(db: Session, trip_id: uuid.UUID, current_user: User) -> Trip:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        TripService._verify_membership(db, trip.group_id, current_user.id)
        return trip

    @staticmethod
    def list_group_trips(
        db: Session,
        group_id: uuid.UUID,
        current_user: User,
        status_filter: TripStatus | None = None,
    ) -> list[Trip]:
        TripService._verify_membership(db, group_id, current_user.id)

        stmt = select(Trip).where(Trip.group_id == group_id)
        if status_filter is not None:
            stmt = stmt.where(Trip.status == status_filter)
        rows = db.execute(stmt).scalars().all()
        return list(rows)

    @staticmethod
    def update_trip(
        db: Session,
        trip_id: uuid.UUID,
        data: Any,
        current_user: User,
    ) -> Trip:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        if not TripService._is_creator_or_admin(db, trip, current_user.id):
            AppException.forbidden("Only the trip creator or a group admin can update this trip")

        payload = _trip_update_payload(data)
        allowed = {"title", "description", "start_date", "end_date"}
        for key, value in payload.items():
            if key in allowed:
                setattr(trip, key, value)

        _validate_start_end(trip.start_date, trip.end_date)

        db.commit()
        db.refresh(trip)
        logger.info("Trip updated: %s", trip.id)
        return trip

    @staticmethod
    def delete_trip(db: Session, trip_id: uuid.UUID, current_user: User) -> None:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        if not TripService._is_creator_or_admin(db, trip, current_user.id):
            AppException.forbidden("Only the trip creator or a group admin can delete this trip")

        db.delete(trip)
        db.commit()
        logger.info("Trip deleted: %s", trip_id)

    @staticmethod
    def change_status(
        db: Session,
        trip_id: uuid.UUID,
        new_status: TripStatus,
        current_user: User,
    ) -> Trip:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        if not TripService._is_creator_or_admin(db, trip, current_user.id):
            AppException.forbidden("Only the trip creator or a group admin can change trip status")

        trip.status = new_status
        db.commit()
        db.refresh(trip)
        logger.info("Trip %s status -> %s", trip.id, new_status.value)
        return trip
