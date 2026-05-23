"""Buddy trip API schemas."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BuddyTripCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    destination: str = Field(..., min_length=1, max_length=200)
    date_from: date
    date_to: date
    max_size: int = Field(10, ge=2, le=500)
    vibe_tags: list[str] = Field(default_factory=list)
    description: str | None = Field(None, max_length=5_000)


class OrganizerBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str
    avatar_url: str | None = None


class BuddyTripRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organizer_id: UUID
    organizer: OrganizerBrief | None = None
    destination: str
    date_from: date
    date_to: date
    max_size: int
    current_size: int
    vibe_tags: list[str]
    description: str | None
    status: str
    created_at: datetime
    updated_at: datetime


class BuddyJoinRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    buddy_trip_id: UUID
    requester_id: UUID
    status: str
    message: str | None
    created_at: datetime


class BuddyJoinWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str | None = Field(None, max_length=2_000)


class BuddyRespondWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    approve: bool


class RequesterBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str
    avatar_url: str | None = None


class BuddyJoinRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    buddy_trip_id: UUID
    requester_id: UUID
    user_id: UUID
    user: RequesterBrief | None = None
    status: str
    message: str | None
    created_at: datetime

