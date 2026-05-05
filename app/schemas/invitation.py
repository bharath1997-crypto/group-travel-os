"""
app/schemas/invitation.py — Group invitation request/response shapes
"""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class InviteUserIn(BaseModel):
    user_id: UUID


class GroupInvitationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    group_id: UUID
    invited_by: UUID
    invited_user_id: UUID
    status: str
    created_at: datetime
    responded_at: datetime | None = None


class PendingInvitationListItemOut(BaseModel):
    """One pending invite for the current user (inbox)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    group_id: UUID
    group_name: str
    invited_by_id: UUID
    invited_by_name: str
    created_at: datetime


class GroupPendingInviteRowOut(BaseModel):
    """Admin view: pending invite to a group."""

    id: UUID
    invited_user_id: UUID
    invited_user_name: str
    invited_user_email: str
    created_at: datetime
