"""
app/schemas/meet_point.py — Meet point request/response schemas (Pydantic v2)
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProposeMeetPointRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    address: str | None = None
    meet_at: datetime | None = None
    location_id: UUID | None = None


class AttendanceRequest(BaseModel):
    status: str = Field(..., pattern=r"^(confirmed|declined)$")


class MeetPointOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    trip_id: UUID
    proposed_by: UUID
    name: str
    latitude: float
    longitude: float
    address: str | None
    meet_at: datetime | None
    is_official: bool
    location_id: UUID | None
    created_at: datetime


class MeetPointAttendanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    meet_point_id: UUID
    user_id: UUID
    status: str
    responded_at: datetime
