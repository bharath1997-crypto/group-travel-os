from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PlaceResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    category: str | None
    subcategory: str | None
    lat: float
    lng: float
    address: dict | None
    website: str | None
    phone: str | None
    opening_hours: str | None
    photo_url: str | None
    source: str
    distance_m: float | None


class ExploreNearbyResponse(BaseModel):
    places: list[PlaceResult]
    cached: bool
    total: int


class ExploreViewportResponse(BaseModel):
    places: list[PlaceResult]
    cached: bool
    total: int


class SearchLogRequest(BaseModel):
    query: str
    source: str
    results_count: int = Field(default=0, ge=0)
    lat: float | None = None
    lng: float | None = None


class ExternalCallsRemainingResponse(BaseModel):
    remaining: int
    limit: int
    reset: str


class EventResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str | None
    start_time: datetime | None
    end_time: datetime | None
    ticket_url: str | None
    price_min: float | None
    price_max: float | None
    category: str | None
    lat: float | None
    lng: float | None

