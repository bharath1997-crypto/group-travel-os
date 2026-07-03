from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


PlaceMediaSource = Literal[
    "rovvy_user",
    "rovvy_admin",
    "licensed_partner",
    "open_license",
]
PlaceModerationStatus = Literal["pending", "approved", "rejected"]


class PlaceKeyInput(BaseModel):
    name: str = Field(min_length=1, max_length=300)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    city: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=120)
    country: str | None = Field(default=None, max_length=120)
    osm_type: str | None = Field(default=None, max_length=20)
    osm_id: int | None = None


class PlaceMediaItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    place_key: str
    thumbnail_url: str
    storage_url: str
    caption: str | None = None
    tags: list[str] = Field(default_factory=list)
    source: PlaceMediaSource
    attribution: str | None = None
    license: str | None = None
    moderation_status: PlaceModerationStatus


class PlaceMediaResolveResponse(BaseModel):
    place_key: str
    media: list[PlaceMediaItemOut] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
