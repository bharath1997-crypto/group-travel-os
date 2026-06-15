"""
app/services/live_sos_service.py — Service layer for logging SOS events and sending notifications.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session
from twilio.rest import Client

from app.models.group import GroupMember
from app.models.sos_event import SOSEvent
from app.models.trip import Trip
from app.models.user import User
from app.services.notification_service import NotificationService
from app.utils.exceptions import AppException
from app.utils.firebase import get_rtdb
from config import settings

logger = logging.getLogger(__name__)


class LiveSOSService:

    @staticmethod
    def send_sos(
        db: Session,
        user_id: uuid.UUID,
        trip_id: uuid.UUID,
        latitude: float | None = None,
        longitude: float | None = None,
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

        # 2. Get last known location from Firebase RTDB
        loc_lat = None
        loc_lng = None
        try:
            loc_data = get_rtdb(f"trips/{trip_id}/locations/{user_id}")
            if loc_data:
                loc_lat = loc_data.get("lat") or loc_data.get("latitude")
                loc_lng = loc_data.get("lng") or loc_data.get("longitude")
        except Exception as exc:
            logger.warning("Failed to fetch location from Firebase RTDB for SOS: %s", exc)

        # Fallback to parameters passed from body
        if loc_lat is None:
            loc_lat = latitude
        if loc_lng is None:
            loc_lng = longitude

        # If still None, raise error
        if loc_lat is None or loc_lng is None:
            AppException.bad_request("GPS location not available")

        # 3. Log SOS event to DB
        now = datetime.now(timezone.utc)
        sos_event = SOSEvent(
            id=uuid.uuid4(),
            trip_id=trip_id,
            user_id=user_id,
            latitude=loc_lat,
            longitude=loc_lng,
            sent_at=now,
        )
        db.add(sos_event)
        try:
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.error("Failed to commit SOS event: %s", exc)
            AppException.internal_server_error("Could not record SOS event")

        # 4. Get all other group members
        other_members = db.execute(
            select(User)
            .join(GroupMember, GroupMember.user_id == User.id)
            .where(
                GroupMember.group_id == trip.group_id,
                User.id != user_id,
            )
        ).scalars().all()

        # Send FCM push notifications
        title = f"SOS from {sender.full_name or 'Group Member'}"
        body = f"Last location: {loc_lat}, {loc_lng} — {now.isoformat()}"
        payload = {
            "trip_id": str(trip_id),
            "type": "sos_alert",
            "sender_id": str(user_id),
            "sender_name": sender.full_name or "Group Member",
            "latitude": str(loc_lat),
            "longitude": str(loc_lng),
            "timestamp": now.isoformat(),
        }

        for u in other_members:
            if u.fcm_token and u.fcm_token.strip():
                try:
                    NotificationService.send_to_token(
                        u.fcm_token,
                        title,
                        body,
                        payload,
                    )
                except Exception as exc:
                    logger.warning("FCM always in try/except: SOS send failed for user %s: %s", u.id, exc)

        # Send Twilio SMS to other members
        from_num = (settings.twilio_phone_number or "").strip()
        has_twilio = bool(
            settings.twilio_account_sid
            and settings.twilio_auth_token
            and from_num
        )

        sms_body = (
            f"SOS ALERT: {sender.full_name or 'Group Member'} needs help. "
            f"Last GPS: {loc_lat},{loc_lng}. "
            f"Sent via Rovvy."
        )

        if has_twilio:
            if not from_num.startswith("+"):
                from_num = f"+{from_num.lstrip('+')}"
            try:
                client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
                for u in other_members:
                    if u.phone and u.phone.strip():
                        phone = u.phone.strip()
                        if not phone.startswith("+"):
                            phone = f"+{phone.lstrip('+')}"
                        try:
                            client.messages.create(
                                body=sms_body,
                                from_=from_num,
                                to=phone,
                            )
                        except Exception as e:
                            logger.warning("Failed to send Twilio SMS to %s: %s", phone, e)
            except Exception as e:
                logger.error("Failed to initialize Twilio client or send messages: %s", e)
