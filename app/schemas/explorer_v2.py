from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict


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
