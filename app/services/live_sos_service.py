"""
app/services/live_sos_service.py — Service layer for logging SOS events and sending notifications.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.group import GroupMember
from app.models.sos_event import SOSEvent
from app.models.trip import Trip
from app.models.user import User
from app.services.notification_service import NotificationService
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)


class LiveSOSService:

    @staticmethod
    def send_sos(
        db: Session,
        user_id: uuid.UUID,
        trip_id: uuid.UUID,
        latitude: float,
        longitude: float,
    ) -> None:
        # 1. Verify trip and user membership
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

        sender = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
        if not sender:
            AppException.not_found("Sender user not found")

        # 2. Log SOS event to DB
        now = datetime.now(timezone.utc)
        sos_event = SOSEvent(
            id=uuid.uuid4(),
            trip_id=trip_id,
            user_id=user_id,
            latitude=latitude,
            longitude=longitude,
            sent_at=now,
        )
        db.add(sos_event)
        try:
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.error("Failed to commit SOS event: %s", exc)
            AppException.internal_server_error("Could not record SOS event")

        # 3. Get all other group members' FCM tokens and send push notifications
        try:
            recipients = NotificationService._group_member_recipients(
                db,
                trip.group_id,
                exclude_user_id=user_id,
            )
        except Exception as exc:
            logger.error("Failed to query group member recipients for SOS: %s", exc)
            recipients = []

        title = "Emergency SOS Alert!"
        timestamp_str = now.isoformat()
        body = f"SOS from {sender.full_name} — [{latitude},{longitude}] — {timestamp_str}"
        payload = {
            "trip_id": str(trip_id),
            "type": "sos_alert",
            "sender_id": str(user_id),
            "sender_name": sender.full_name,
            "latitude": str(latitude),
            "longitude": str(longitude),
            "timestamp": timestamp_str,
        }

        for user in recipients:
            if user.fcm_token and user.fcm_token.strip():
                try:
                    NotificationService.send_to_token(
                        user.fcm_token,
                        title,
                        body,
                        payload,
                    )
                except Exception as exc:
                    logger.warning("FCM always in try/except: SOS send failed for user %s: %s", user.id, exc)
