"""
app/schemas/trip.py — Trip request and response schemas (Pydantic v2)
"""
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.trip import TripStatus


class TripCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: str | None = Field(None, max_length=1000)
    start_date: date | None = None
    end_date: date | None = None


class TripUpdate(BaseModel):
    title: str | None = Field(None, min_length=2, max_length=200)
    description: str | None = Field(None, max_length=1000)
    start_date: date | None = None
    end_date: date | None = None


class TripStatusUpdate(BaseModel):
    status: TripStatus


class TripOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    group_id: UUID
    title: str
    description: str | None
    status: TripStatus
    start_date: date | None
    end_date: date | None
    created_by: UUID
    created_at: datetime
    updated_at: datetime
