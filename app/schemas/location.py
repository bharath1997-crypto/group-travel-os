"""
app/schemas/location.py — Location request and response schemas (Pydantic v2)
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LocationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    address: str | None = Field(None, max_length=500)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    place_id: str | None = Field(None, max_length=300)
    category: str | None = Field(None, max_length=100)
    notes: str | None = Field(None, max_length=500)


class LocationUpdate(BaseModel):
    notes: str | None = Field(None, max_length=500)
    is_visited: bool | None = None
    category: str | None = Field(None, max_length=100)


class LocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    saved_by: UUID
    name: str
    address: str | None
    latitude: float
    longitude: float
    place_id: str | None
    category: str | None
    notes: str | None
    is_visited: bool
    created_at: datetime


class TripLocationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    trip_id: UUID
    location_id: UUID
    status: str
    added_by: UUID
    added_at: datetime


class AddToTripRequest(BaseModel):
    location_id: UUID
