"""
app/routes/notifications.py — In-app notification feed
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.notification import NotificationListOut, NotificationOut, UnreadCountOut
from app.services.notification_service import NotificationService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _row_to_out(row: Any) -> NotificationOut:
    return NotificationOut.model_validate(row)


class MarkAllReadOut(BaseModel):
    ok: bool = True


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
    unread = NotificationService.get_unread_count(db, current_user)
    rows = NotificationService.get_notifications(
        db, current_user, limit=limit, offset=offset
    )
    return NotificationListOut(
        notifications=[_row_to_out(r) for r in rows],
        unread_count=unread,
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
    c = NotificationService.get_unread_count(db, current_user)
    return UnreadCountOut(count=c)


@router.post(
    "/read-all",
    response_model=MarkAllReadOut,
    status_code=status.HTTP_200_OK,
    summary="Mark all notifications as read",
)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MarkAllReadOut:
    NotificationService.mark_all_read(db, current_user)
    return MarkAllReadOut(ok=True)


@router.api_route(
    "/{notification_id}/read",
    methods=["POST", "PATCH"],
    response_model=NotificationOut,
    summary="Mark one notification as read (POST or PATCH)",
)
def mark_one_read(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    row = NotificationService.mark_as_read(db, notification_id, current_user)
    return _row_to_out(row)
