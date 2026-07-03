from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field


class PlaceResolveRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    clickedName: str | None = None
    featureProperties: dict[str, Any] | None = None
    radiusMeters: int = Field(default=75, ge=10, le=150)


class EnrichedPlace(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    placeKey: str
    name: str
    category: str
    address: str | None = None
    lat: float
    lng: float
    distanceMeters: float
    source: Literal["map_feature", "osm_enriched", "reverse_geocode", "dropped_pin"]
    tags: dict[str, Any] = Field(default_factory=dict)


class PlaceResolveResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    place: EnrichedPlace
    candidates: list[EnrichedPlace] = Field(default_factory=list)
