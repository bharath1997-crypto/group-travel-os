"""Response schemas for Phase 1 travel intel endpoints."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class TravelWeatherOut(BaseModel):
    temp: float
    description: str
    humidity: int
    wind_speed: float


class TravelEventOut(BaseModel):
    name: str
    date: str = ""
    venue: str = ""
    url: str = ""


class TravelPlaceOut(BaseModel):
    name: str
    rating: float | None = None
    address: str = ""
    photo_reference: str = ""


class TravelIntelOut(BaseModel):
    city: str
    weather: TravelWeatherOut | None = None
    events: list[TravelEventOut] = Field(default_factory=list)
    places: list[TravelPlaceOut] = Field(default_factory=list)
    generated_at: datetime
