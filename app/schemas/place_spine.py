"""Place panel detail — Overture data-spine row by gers_id."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class PlaceSpinePhoto(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    key_prefix: str
    w: int = 1200
    h: int = 800


class PlaceSpineGroupTag(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    label: str
    tone: str = "neutral"


class PlaceSpineHours(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    is_open: bool = False
    closes_at: str | None = None
    opens_at: str | None = None


class PlaceSpineReviewStub(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    author_initials: str
    author_name: str
    text: str
    visited_at: str
    wait_minutes: int | None = None


class PlaceSpineDetail(BaseModel):
    """Matches frontend place-panel-types Place (snake_case)."""

    model_config = ConfigDict(from_attributes=True)

    gers_id: str
    name: str
    category: str
    category_label: str
    lat: float
    lon: float
    neighborhood: str | None = None
    city_slug: str | None = None
    address: str | None = None
    depth_tier: int = Field(default=0, ge=0, le=2)
    short_description: str | None = None
    description_source: str | None = None
    description_url: str | None = None
    website: str | None = None
    instagram: str | None = None
    hours: PlaceSpineHours | None = None
    claimed: bool = False
    photos: list[PlaceSpinePhoto] = Field(default_factory=list)
    would_return_pct: float | None = None
    review_count: int = 0
    group_tags: list[PlaceSpineGroupTag] = Field(default_factory=list)
    latest_review: PlaceSpineReviewStub | None = None
    bookable: bool = False
    next_slot: str | None = None
    slots_tonight: int | None = None
    updated_at: str = ""
