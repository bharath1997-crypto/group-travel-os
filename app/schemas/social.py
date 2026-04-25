"""
app/schemas/social.py — User search, friend requests, connections
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

FriendRequestStatus = Literal["pending", "accepted", "declined"]

FriendStatus = Literal[
    "none",
    "pending_sent",
    "pending_received",
    "accepted",
    "blocked",
]


class FriendRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    sender_id: UUID
    receiver_id: UUID
    status: str
    created_at: datetime


class UserSearchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str
    username: str | None
    avatar_url: str | None
    profile_picture: str | None
    is_verified: bool
    whatsapp_verified: bool
    plan: str
    friend_status: FriendStatus


class UserPublicProfileOut(BaseModel):
    """Minimal profile for clients (e.g. DM display)."""

    id: UUID
    full_name: str
    username: str | None
    avatar_url: str | None
    profile_picture: str | None


class FriendRequestCreate(BaseModel):
    receiver_id: UUID


class BlockUserBody(BaseModel):
    user_id: UUID
