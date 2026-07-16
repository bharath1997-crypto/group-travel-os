"""Invite link context for guest poll voting."""
from __future__ import annotations

import uuid

from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.poll import PollOut
from app.schemas.trip import TripOut


class InviteContextOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    group_id: UUID
    group_name: str
    trip: TripOut
    polls: list[PollOut]
    guest_token: str
    guest_identifier: str
