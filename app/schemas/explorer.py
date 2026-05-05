"""
Pydantic models for unified Explorer API responses.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ExplorerResultItem(BaseModel):
    """Single normalized item returned to the frontend."""

    source: str = Field(
        ...,
        description="Provider slug: ticketmaster, yelp, google_places, youtube, eventbrite, serpapi, apify, internal_db, ...",
    )
    type: Literal["event", "place", "video"] = Field(..., description="High-level card type")
    title: str
    description: str | None = None
    image_url: str | None = None
    external_url: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    price: float | None = Field(None, description="Numeric price when known (e.g. ticket from)")

    # Compatibility with existing Travello Explorer UI
    id: str = ""
    source_type: str = ""
    venue: str = ""
    city: str = ""
    date_str: str = ""
    dateLabel: str = ""
    price_from: float | None = None
    priceLabel: str = ""
    is_free: bool = False
    distanceLabel: str = "Near you"
    emoji: str = ""


class ExplorerSearchResponse(BaseModel):
    location: str
    query: str
    results: list[ExplorerResultItem]
    total: int
    source: str = Field(
        default="mixed",
        description="Primary source label for badges (or mixed when multiple providers returned data).",
    )
    wayra_suggestion: str | None = None

    # Aliases for older clients
    city: str = ""
