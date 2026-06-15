"""
app/schemas/trip_item.py — Trip item (saved explore event) schemas
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TripItemCreate(BaseModel):
    event_id: str = Field(..., min_length=1, max_length=300)
    title: str = Field(..., min_length=1, max_length=300)
    category: str | None = Field(None, max_length=100)
    venue: str | None = Field(None, max_length=300)
    city: str | None = Field(None, max_length=200)
    state: str | None = Field(None, max_length=100)
    start_date: str | None = Field(None, max_length=20)
    start_time: str | None = Field(None, max_length=20)
    price_min: float | None = None
    price_max: float | None = None
    image_url: str | None = Field(None, max_length=2000)
    ticket_url: str | None = Field(None, max_length=2000)
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)


class TripItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    trip_id: UUID
    location_id: UUID
    event_id: str
    title: str
    added_at: datetime


class TripListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    group_id: UUID
    group_name: str | None = None
    title: str
    description: str | None
    status: str
    start_date: str | None = None
    end_date: str | None = None
    created_by: UUID
    created_at: datetime
    updated_at: datetime
