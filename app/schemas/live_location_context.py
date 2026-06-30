"""Schemas for Live Tab deterministic location context engine."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

LocationClassification = Literal[
    "local_place",
    "far_destination",
    "very_far_destination",
    "country_mismatch",
    "incomplete_place_data",
]

RoviRiskLevel = Literal["normal", "far", "very_far"]


class LiveLocationInput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    lat: float | None = None
    lng: float | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None


class LiveSelectedPlaceInput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(..., min_length=1)
    address: str | None = None
    lat: float
    lng: float
    city: str | None = None
    state: str | None = None
    country: str | None = None
    category: str | None = None
    source: str | None = None
    has_opening_hours: bool | None = None


class LiveLocationContextRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    user_location: LiveLocationInput | None = None
    selected_place: LiveSelectedPlaceInput
    workflow_type: str | None = None
    travel_mode: str | None = None
    live_stage: str | None = None


class LocationContextTemplate(BaseModel):
    summary: str
    recommendation: str


class LiveLocationContextResponse(BaseModel):
    distance_miles: float | None = None
    same_country: bool | None = None
    same_state: bool | None = None
    same_city: bool | None = None
    country_mismatch: bool = False
    state_mismatch: bool = False
    missing_address: bool = False
    missing_hours: bool = False
    missing_distance: bool = False
    data_quality_score: float = Field(ge=0, le=1)
    classification: LocationClassification
    future_trip_candidate: bool = False
    live_safe: bool = True
    user_area: str
    place_area: str
    recommended_actions: list[str]
    template: LocationContextTemplate
    compact: dict[str, object]


class RoviCompactContext(BaseModel):
    model_config = ConfigDict(extra="ignore")

    user_area: str
    place_name: str
    place_area: str
    distance_miles: float | None = None
    classification: LocationClassification
    travel_mode: str
    workflow_type: str
    live_safe: bool
    recommended_actions: list[str]


class LivePlaceExplanationRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    compact_context: RoviCompactContext


class LivePlaceExplanationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    summary: str
    recommendation: str
    actions: list[str]
    risk_level: RoviRiskLevel
