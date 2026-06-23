"""Pydantic models for Live coordination endpoints."""
from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.group import MemberRole


class LiveSessionCreate(BaseModel):
    trip_id: UUID
    mode: str = "GROUP"


class LiveChecklistItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    is_accepted: bool
    accepted_at: datetime | None
    full_name: str | None = None
    avatar_url: str | None = None


class LiveSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    trip_id: UUID
    started_by: UUID
    session_code: str
    status: str
    meet_radius_meters: int
    started_at: datetime | None
    ended_at: datetime | None
    mode: str
    created_at: datetime


class AssignCoordinatorBody(BaseModel):
    user_id: UUID = Field(..., description="Trip group member receiving coordinator role")


class LiveMeetPointBody(BaseModel):
    lat: float
    lng: float
    name: str = Field(..., max_length=200)


class QuickStatusBody(BaseModel):
    status: str = Field(..., max_length=80)


class UpcomingTripMemberOut(BaseModel):
    user_id: UUID
    avatar_url: str | None


class UpcomingTripOut(BaseModel):
    trip_id: UUID
    title: str
    destination_hint: str | None
    start_date: date | None
    end_date: date | None
    group_id: UUID
    member_count: int
    members_preview: list[UpcomingTripMemberOut]
    my_role: MemberRole


class MyActiveLiveOut(BaseModel):
    active: bool
    session_id: UUID | None = None
    trip_id: UUID | None = None
    status: str | None = None
    member_count: int = 0


class SOSRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    latitude: float
    longitude: float

