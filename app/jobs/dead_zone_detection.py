"""Detect group live members who have not updated location in 30+ minutes."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.models.group import GroupMember
from app.models.live_session import LiveMode, LiveSession
from app.models.trip import Trip
from app.models.user import User
from app.services.notification_service import NotificationService
from app.utils.database import SessionLocal
from app.utils.firebase import get_rtdb

logger = logging.getLogger(__name__)

_dead_zone_alerted: set[str] = set()


def detect_dead_zones() -> None:
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(minutes=30)
        sessions = db.execute(
            select(LiveSession).where(
                LiveSession.is_active.is_(True),
                LiveSession.mode == LiveMode.group,
                LiveSession.trip_id.isnot(None),
            )
        ).scalars().all()

        active_trip_ids = {session.trip_id for session in sessions if session.trip_id}

        for trip_id in active_trip_ids:
            if trip_id is None:
                continue
            trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
            if not trip:
                continue

            members_rtdb = get_rtdb(f"trips/{trip_id}/live/members") or {}
            if not isinstance(members_rtdb, dict):
                continue

            name_by_id: dict[str, str] = {}
            member_rows = db.execute(
                select(GroupMember, User)
                .join(User, User.id == GroupMember.user_id)
                .where(GroupMember.group_id == trip.group_id)
            ).all()
            for _gm, user in member_rows:
                name_by_id[str(user.id)] = user.full_name

            for user_id_str, loc_data in members_rtdb.items():
                if not isinstance(loc_data, dict):
                    continue
                alert_key = f"{trip_id}:{user_id_str}"
                last_seen_raw = loc_data.get("last_seen")
                if not last_seen_raw:
                    continue

                try:
                    last_seen = datetime.fromisoformat(str(last_seen_raw))
                    if last_seen.tzinfo is None:
                        last_seen = last_seen.replace(tzinfo=timezone.utc)
                except ValueError:
                    continue

                if last_seen >= cutoff:
                    _dead_zone_alerted.discard(alert_key)
                    continue

                if alert_key in _dead_zone_alerted:
                    continue

                member_name = name_by_id.get(user_id_str, "A member")
                users = NotificationService._group_members_with_fcm_tokens(
                    db,
                    trip.group_id,
                )
                payload = {
                    "trip_id": str(trip_id),
                    "type": "live_member_offline",
                }
                for user in users:
                    try:
                        NotificationService.send_to_token(
                            user.fcm_token or "",
                            "⚠️ Member offline",
                            f"{member_name} hasn't updated location in 30 minutes",
                            payload,
                        )
                    except Exception as exc:  # noqa: BLE001
                        logger.warning("FCM dead zone alert failed: %s", exc)
                _dead_zone_alerted.add(alert_key)
    finally:
        db.close()
