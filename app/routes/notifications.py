"""
app/routes/notifications.py — In-app notification feed
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationListOut, NotificationOut, UnreadCountOut
from app.utils.auth import get_current_user
from app.utils.database import get_db
from app.utils.exceptions import AppException

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _row_to_out(row: Notification) -> NotificationOut:
    return NotificationOut.model_validate(row)


@router.get(
    "",
    response_model=NotificationListOut,
    summary="List your notifications (newest first, paginated)",
)
def list_notifications(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    unread = (
        db.execute(
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.user_id == current_user.id,
                Notification.is_read.is_(False),
            )
        ).scalar()
        or 0
    )

    rows = (
        db.execute(
            select(Notification)
            .where(Notification.user_id == current_user.id)
            .order_by(Notification.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        .scalars()
        .all()
    )
    return NotificationListOut(
        notifications=[_row_to_out(r) for r in rows],
        unread_count=int(unread),
    )


@router.get(
    "/unread-count",
    response_model=UnreadCountOut,
    summary="Count of unread notifications",
)
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UnreadCountOut:
    c = (
        db.execute(
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.user_id == current_user.id,
                Notification.is_read.is_(False),
            )
        ).scalar()
        or 0
    )
    return UnreadCountOut(count=int(c))


@router.post(
    "/read-all",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Mark all notifications as read",
)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    db.execute(
        update(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.is_read.is_(False),
        )
        .values(is_read=True),
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationOut,
    summary="Mark one notification as read",
)
def mark_one_read(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    row = db.execute(
        select(Notification).where(Notification.id == notification_id)
    ).scalar_one_or_none()
    if not row or row.user_id != current_user.id:
        AppException.not_found("Notification not found")
    if not row.is_read:
        row.is_read = True
        db.commit()
        db.refresh(row)
    return _row_to_out(row)
