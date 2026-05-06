"""
app/schemas/explore.py — Pydantic schemas for the Explore Feed.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ExploreEventResponse(BaseModel):
    id: UUID
    external_id: str
    source_name: str
    title: str
    description: str | None = None
    city: str
    venue_name: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    category: str
    is_free: bool = False
    price_from: float | None = None
    image_url: str | None = None
    booking_url: str | None = None
    fetched_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExploreFeedResponse(BaseModel):
    events: list[ExploreEventResponse]
    total: int
    city: str
    source: str = "cached"
