"""
app/services/notification_service.py — FCM push notifications

Firebase messaging only inside send_to_token. DB queries use injected Session.
"""
from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.group import GroupMember
from app.models.trip import Trip
from app.models.user import User

logger = logging.getLogger(__name__)


class NotificationService:

    @staticmethod
    def send_to_token(token: str, title: str, body: str, data: dict | None = None) -> bool:
        if not token or not token.strip():
            return False
        from firebase_admin import messaging

        data_str = {k: str(v) for k, v in (data or {}).items()}
        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data=data_str,
            token=token.strip(),
        )
        try:
            messaging.send(message)
            return True
        except messaging.UnregisteredError:
            return False
        except Exception as exc:
            logger.warning("FCM send failed: %s", exc)
            return False

    @staticmethod
    def _group_member_recipients(
        db: Session,
        group_id: uuid.UUID,
        exclude_user_id: uuid.UUID,
    ) -> list[User]:
        rows = db.execute(
            select(User)
            .join(GroupMember, GroupMember.user_id == User.id)
            .where(
                GroupMember.group_id == group_id,
                User.id != exclude_user_id,
                User.fcm_token.isnot(None),
            )
        ).scalars().all()
        return [u for u in rows if u.fcm_token and u.fcm_token.strip()]

    @staticmethod
    def notify_group_meet_point(
        db: Session,
        trip_id: uuid.UUID,
        proposer_id: uuid.UUID,
        meet_point_name: str,
    ) -> int:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            return 0

        users = NotificationService._group_member_recipients(
            db,
            trip.group_id,
            proposer_id,
        )
        payload = {"trip_id": str(trip_id), "type": "meet_point"}
        ok = 0
        for user in users:
            if NotificationService.send_to_token(
                user.fcm_token or "",
                "New Meet Point",
                f"Someone proposed: {meet_point_name}",
                payload,
            ):
                ok += 1
        return ok

    @staticmethod
    def notify_timer_started(
        db: Session,
        trip_id: uuid.UUID,
        started_by_id: uuid.UUID,
        duration_seconds: int,
    ) -> int:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            return 0

        users = NotificationService._group_member_recipients(
            db,
            trip.group_id,
            started_by_id,
        )
        minutes = duration_seconds // 60
        if minutes >= 1:
            body = f"A {minutes}-minute timer was started for your trip."
        else:
            body = f"A {duration_seconds}-second timer was started for your trip."

        payload = {
            "trip_id": str(trip_id),
            "type": "timer_started",
            "duration_seconds": str(duration_seconds),
        }
        ok = 0
        for user in users:
            if NotificationService.send_to_token(
                user.fcm_token or "",
                "Timer Started",
                body,
                payload,
            ):
                ok += 1
        return ok
