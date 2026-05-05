"""
app/schemas/notification.py — In-app notification API shapes (Pydantic v2)
"""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    type: str
    title: str
    body: str
    data: dict[str, Any] | None
    is_read: bool
    created_at: datetime


class NotificationListOut(BaseModel):
    notifications: list[NotificationOut] = Field(default_factory=list)
    unread_count: int


class UnreadCountOut(BaseModel):
    count: int
