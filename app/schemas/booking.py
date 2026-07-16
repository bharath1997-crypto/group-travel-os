"""Booking request and response schemas (Pydantic v2)."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.booking import BookingProvider, BookingStatus


class BookingCreate(BaseModel):
    provider_reference: str = Field(..., min_length=1, max_length=255)
    amount: float = Field(..., gt=0)
    currency: str = Field("USD", min_length=3, max_length=3)


class BookingConfirm(BaseModel):
    note: str | None = Field(None, max_length=500)


class BookingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    trip_id: UUID
    created_by: UUID
    provider: BookingProvider
    provider_reference: str | None
    status: BookingStatus
    booking_url: str | None
    amount: float
    currency: str
    created_at: datetime
    updated_at: datetime
