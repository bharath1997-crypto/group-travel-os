"""
app/services/timer_service.py — Ephemeral trip timers (Firebase RTDB only)

Rules:
- Session is always injected — never created here
- All errors raised via AppException
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.group import GroupMember
from app.models.trip import Trip
from app.utils.exceptions import AppException
from app.utils.firebase import delete_rtdb, get_rtdb, set_rtdb

logger = logging.getLogger(__name__)


class TimerService:

    @staticmethod
    def _verify_membership(db: Session, user_id: uuid.UUID, trip_id: uuid.UUID) -> None:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        member = db.execute(
            select(GroupMember).where(
                GroupMember.group_id == trip.group_id,
                GroupMember.user_id == user_id,
            )
        ).scalar_one_or_none()
        if not member:
            AppException.forbidden("Not a member of this trip's group")

    @staticmethod
    def start_timer(
        db: Session,
        user_id: uuid.UUID,
        trip_id: uuid.UUID,
        duration_seconds: int,
    ) -> dict:
        TimerService._verify_membership(db, user_id, trip_id)

        if duration_seconds < 30 or duration_seconds > 86400:
            AppException.bad_request("Duration must be between 30 seconds and 24 hours")

        timer_data: dict = {
            "started_by": str(user_id),
            "started_at": int(datetime.now(timezone.utc).timestamp()),
            "duration_seconds": duration_seconds,
            "is_active": True,
        }
        set_rtdb(f"trips/{trip_id}/timer", timer_data)

        try:
            from app.services.notification_service import NotificationService

            NotificationService.notify_timer_started(db, trip_id, user_id, duration_seconds)
        except Exception as exc:
            logger.debug("Timer start notification skipped: %s", exc)

        return timer_data

    @staticmethod
    def get_timer_state(db: Session, user_id: uuid.UUID, trip_id: uuid.UUID) -> dict | None:
        TimerService._verify_membership(db, user_id, trip_id)
        return get_rtdb(f"trips/{trip_id}/timer")

    @staticmethod
    def cancel_timer(db: Session, user_id: uuid.UUID, trip_id: uuid.UUID) -> None:
        TimerService._verify_membership(db, user_id, trip_id)

        state = get_rtdb(f"trips/{trip_id}/timer")
        if state is None:
            AppException.not_found("No active timer found")

        delete_rtdb(f"trips/{trip_id}/timer")
