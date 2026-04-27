"""
app/services/notification_service.py — In-app feed, FCM push notifications

Firebase messaging only inside send_to_token. DB queries use injected Session.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.expense import Expense
from app.models.group import Group, GroupMember
from app.models.notification import Notification
from app.models.poll import Poll
from app.models.trip import Trip
from app.models.user import User
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)

_MAX_TITLE = 200
_MAX_BODY = 500


def _clip(s: str, n: int) -> str:
    t = s.strip() if s else ""
    if len(t) <= n:
        return t
    return t[: n - 1] + "…"


class NotificationService:

    @staticmethod
    def append_in_app(
        db: Session,
        user_id: uuid.UUID,
        notif_type: str,
        title: str,
        body: str,
        data: dict[str, Any] | None = None,
    ) -> Notification:
        """Add an in-app notification to the session; caller commits and sends FCM."""
        row = Notification(
            user_id=user_id,
            type=notif_type,
            title=_clip(title, _MAX_TITLE),
            body=_clip(body, _MAX_BODY),
            data=data,
        )
        db.add(row)
        return row

    @staticmethod
    def try_fcm_for_user(
        db: Session,
        user_id: uuid.UUID,
        title: str,
        body: str,
        *,
        notif_type: str,
        notification_id: uuid.UUID,
        data: dict[str, Any] | None = None,
    ) -> None:
        try:
            u = db.get(User, user_id)
            if u and u.fcm_token and u.fcm_token.strip():
                fcm_data: dict[str, str] = {
                    "type": notif_type,
                    "notification_id": str(notification_id),
                }
                if data:
                    fcm_data.update({k: str(v) for k, v in data.items()})
                NotificationService.send_to_token(
                    u.fcm_token,
                    _clip(title, _MAX_TITLE),
                    _clip(body, _MAX_BODY),
                    fcm_data,
                )
        except Exception as exc:  # noqa: BLE001
            logger.warning("FCM after in-app notification failed: %s", exc)

    @staticmethod
    def get_notifications(
        db: Session,
        current_user: User,
        *,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Notification]:
        return list(
            db.execute(
                select(Notification)
                .where(Notification.user_id == current_user.id)
                .order_by(Notification.created_at.desc())
                .offset(offset)
                .limit(limit),
            )
            .scalars()
            .all(),
        )

    @staticmethod
    def get_unread_count(db: Session, current_user: User) -> int:
        c = (
            db.execute(
                select(func.count())
                .select_from(Notification)
                .where(
                    Notification.user_id == current_user.id,
                    Notification.is_read.is_(False),
                ),
            ).scalar()
            or 0
        )
        return int(c)

    @staticmethod
    def mark_as_read(
        db: Session,
        notification_id: uuid.UUID,
        current_user: User,
    ) -> Notification:
        row = db.execute(
            select(Notification).where(Notification.id == notification_id),
        ).scalar_one_or_none()
        if not row:
            AppException.not_found("Notification not found")
        if row.user_id != current_user.id:
            AppException.forbidden("You cannot change this notification")
        if not row.is_read:
            row.is_read = True
            db.commit()
            db.refresh(row)
        return row

    @staticmethod
    def mark_all_read(db: Session, current_user: User) -> int:
        res = db.execute(
            update(Notification)
            .where(
                Notification.user_id == current_user.id,
                Notification.is_read.is_(False),
            )
            .values(is_read=True),
        )
        db.commit()
        return int(res.rowcount or 0)

    @staticmethod
    def create_notification(
        db: Session,
        user_id: uuid.UUID,
        notif_type: str,
        title: str,
        body: str,
        data: dict | None = None,
    ) -> Notification:
        row = Notification(
            user_id=user_id,
            type=notif_type,
            title=_clip(title, _MAX_TITLE),
            body=_clip(body, _MAX_BODY),
            data=data,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        try:
            u = db.get(User, user_id)
            if u and u.fcm_token and u.fcm_token.strip():
                fcm_data: dict[str, str] = {
                    "type": notif_type,
                    "notification_id": str(row.id),
                }
                if data:
                    fcm_data.update({k: str(v) for k, v in data.items()})
                NotificationService.send_to_token(
                    u.fcm_token,
                    row.title,
                    row.body,
                    fcm_data,
                )
        except Exception as exc:  # noqa: BLE001 — log and keep in-app record
            logger.warning("FCM after in-app notification failed: %s", exc)
        return row

    @staticmethod
    def on_user_joined_group(
        db: Session,
        group: Group,
        new_member: User,
    ) -> None:
        other = db.execute(
            select(GroupMember.user_id).where(
                GroupMember.group_id == group.id,
                GroupMember.user_id != new_member.id,
            )
        ).scalars().all()
        name = new_member.full_name
        gname = group.name
        for uid in other:
            NotificationService.create_notification(
                db,
                uid,
                "group_activity",
                f"New member in {gname}",
                f"{name} joined the group.",
                {"group_id": str(group.id)},
            )

    @staticmethod
    def on_trip_created(db: Session, trip: Trip, creator: User) -> None:
        other = db.execute(
            select(GroupMember.user_id).where(
                GroupMember.group_id == trip.group_id,
                GroupMember.user_id != creator.id,
            )
        ).scalars().all()
        for uid in other:
            NotificationService.create_notification(
                db,
                uid,
                "trip_activity",
                "New trip",
                f'{creator.full_name} created "{trip.title}".',
                {
                    "trip_id": str(trip.id),
                    "group_id": str(trip.group_id),
                },
            )

    @staticmethod
    def on_poll_created(
        db: Session,
        trip: Trip,
        poll: Poll,
        creator: User,
    ) -> None:
        other = db.execute(
            select(GroupMember.user_id).where(
                GroupMember.group_id == trip.group_id,
                GroupMember.user_id != creator.id,
            )
        ).scalars().all()
        for uid in other:
            NotificationService.create_notification(
                db,
                uid,
                "trip_activity",
                "New poll",
                f"{creator.full_name}: {poll.question}",
                {
                    "poll_id": str(poll.id),
                    "trip_id": str(trip.id),
                    "group_id": str(trip.group_id),
                },
            )

    @staticmethod
    def on_expense_added(
        db: Session,
        trip: Trip,
        expense: Expense,
        created_by: User,
    ) -> None:
        other = db.execute(
            select(GroupMember.user_id).where(
                GroupMember.group_id == trip.group_id,
                GroupMember.user_id != created_by.id,
            )
        ).scalars().all()
        amt = f"{expense.amount:.2f}"
        for uid in other:
            NotificationService.create_notification(
                db,
                uid,
                "trip_activity",
                "New expense",
                f"{created_by.full_name} added: {expense.description} "
                f"({expense.currency} {amt})",
                {
                    "expense_id": str(expense.id),
                    "trip_id": str(trip.id),
                    "group_id": str(trip.group_id),
                },
            )

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
