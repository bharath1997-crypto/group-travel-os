"""
app/schemas/location_share.py — Location sharing request/response schemas (Pydantic v2)
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class StartSharingRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class UpdateLocationRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class LocationShareOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    trip_id: UUID
    is_active: bool
    started_at: datetime
    last_updated: datetime


class ActiveSharerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    is_active: bool
    last_updated: datetime
