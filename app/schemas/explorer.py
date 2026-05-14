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

    # Compatibility with existing Rovvy Explorer UI
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


# --- New Explorer Architecture ---

import hashlib
import re
from typing import Any, Dict, List, Optional


class ExplorerLocation(BaseModel):
    name: str | None = None
    lat: float | None = None
    lon: float | None = None


class ExplorerCard(BaseModel):
    id: str
    source: str
    title: str
    type: Literal["event", "place"]
    category: str | None = None
    datetime: str | None = None
    location: ExplorerLocation = Field(default_factory=ExplorerLocation)
    images: List[str] = Field(default_factory=list)
    links: Dict[str, str] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    # Location
    country_code: str | None = None
    city: str | None = None
    state: str | None = None

    # Context
    group_tags: List[str] = Field(default_factory=list)
    popularity_score: float | None = None

    # Fingerprints
    normalized_title: str
    normalized_venue: str
    normalized_city: str


def normalize_text(text: str | None) -> str:
    """Normalize text for fingerprinting: lowercase, alphanumeric only, stripped."""
    if not text:
        return ""
    # Convert to lowercase
    text = text.lower()
    # Remove non-alphanumeric characters except spaces
    text = re.sub(r"[^a-z0-9\s]", "", text)
    # Collapse multiple spaces and strip
    text = re.sub(r"\s+", " ", text).strip()
    return text


def create_explorer_card(
    source: str,
    title: str,
    item_type: Literal["event", "place"],
    venue_name: str | None = None,
    city_name: str | None = None,
    **kwargs,
) -> ExplorerCard:
    """Helper to create an ExplorerCard with automatic fingerprinting."""
    normalized_title = normalize_text(title)
    normalized_venue = normalize_text(venue_name)
    normalized_city = normalize_text(city_name)

    # Generate a fallback ID if not provided
    card_id = kwargs.pop("id", None)
    if not card_id:
        raw_str = f"{source}:{normalized_title}:{normalized_venue}:{normalized_city}"
        card_id = hashlib.md5(raw_str.encode()).hexdigest()

    # Extract location
    location_data = kwargs.pop("location", {})
    if isinstance(location_data, dict):
        location = ExplorerLocation(
            name=venue_name or location_data.get("name"),
            lat=location_data.get("lat"),
            lon=location_data.get("lon"),
        )
    elif isinstance(location_data, ExplorerLocation):
        location = location_data
    else:
        location = ExplorerLocation()

    return ExplorerCard(
        id=card_id,
        source=source,
        title=title,
        type=item_type,
        location=location,
        city=city_name,
        normalized_title=normalized_title,
        normalized_venue=normalized_venue,
        normalized_city=normalized_city,
        **kwargs,
    )

