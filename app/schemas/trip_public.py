"""Public trip preview and roster payloads."""
from __future__ import annotations

from pydantic import BaseModel, Field


class TripPublicLocationOut(BaseModel):
    id: str
    name: str
    address: str | None
    latitude: float
    longitude: float
    category: str | None


class TripPublicTripOut(BaseModel):
    id: str
    group_id: str
    title: str
    description: str | None
    status: str
    start_date: str | None
    end_date: str | None


class TripPublicParticipantOut(BaseModel):
    user_id: str
    full_name: str
    avatar_url: str | None
    trip_note: str | None
    is_online: bool


class TripPublicPreviewOut(BaseModel):
    trip: TripPublicTripOut
    locations: list[TripPublicLocationOut]
    member_count_total: int
    member_count_private: int
    member_count_public: int
    public_participants: list[TripPublicParticipantOut]
    viewer_is_member: bool
    viewer_has_pending_request: bool
    viewer_is_group_admin: bool


class TripRosterUpdate(BaseModel):
    note: str | None = Field(None, max_length=500)


class TripJoinRequestCreate(BaseModel):
    message: str | None = Field(None, max_length=500)


class TripJoinRequestOut(BaseModel):
    id: str
    trip_id: str
    user_id: str
    message: str | None
    status: str


class PendingTripJoinOut(BaseModel):
    id: str
    trip_id: str
    user_id: str
    message: str | None
    status: str
    created_at: str
    user_full_name: str
    user_email: str
