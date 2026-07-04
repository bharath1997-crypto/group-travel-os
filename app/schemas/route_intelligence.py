"""
Rovi Travel Route Intelligence — Pydantic schemas.

Backend resolver produces RouteIntelligenceResponse.
Rovi AI receives compact JSON subset and returns RoviRouteExplanation.
"""
from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ── Enums ─────────────────────────────────────────────────────────────────────

class RouteOptionType(StrEnum):
    ROAD_TRIP = "road_trip"
    FLIGHT_CONNECTION = "flight_connection"
    FLIGHT_MULTIMODAL = "flight_multimodal"
    TRAIN_ROUTE = "train_route"
    BUS_ROUTE = "bus_route"
    BUDGET_ROUTE = "budget_route"
    COMFORT_ROUTE = "comfort_route"
    PRIVATE_VEHICLE = "private_vehicle"


class RouteSegmentType(StrEnum):
    DRIVE = "drive"
    WALK = "walk"
    FLIGHT = "flight"
    TRAIN = "train"
    BUS = "bus"
    TRANSFER = "transfer"
    BORDER_CROSSING = "border_crossing"
    LOCAL_TRANSPORT = "local_transport"


ProviderStatus = Literal["estimated", "live_provider_required", "complete"]


# ── Segment & Option ───────────────────────────────────────────────────────────

class RouteSegment(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    id: str
    type: RouteSegmentType
    from_name: str = Field(alias="fromName")
    to_name: str = Field(alias="toName")
    title: str
    estimated_duration: str | None = Field(None, alias="estimatedDuration")
    estimated_cost: str | None = Field(None, alias="estimatedCost")
    provider_status: ProviderStatus = Field("estimated", alias="providerStatus")
    notes: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=False, populate_by_name=True)


class RouteOption(BaseModel):
    model_config = ConfigDict(from_attributes=False, populate_by_name=True)

    id: str
    title: str
    type: RouteOptionType
    recommended: bool = False
    best_for: str | None = Field(None, alias="bestFor")
    estimated_duration: str | None = Field(None, alias="estimatedDuration")
    estimated_cost_range: str | None = Field(None, alias="estimatedCostRange")
    provider_status: ProviderStatus = Field("live_provider_required", alias="providerStatus")
    segments: list[RouteSegment]
    notes: list[str] = Field(default_factory=list)


# ── Request / Response ─────────────────────────────────────────────────────────

class LocationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    name: str
    country: str | None = None
    lat: float
    lng: float


class RouteIntelligenceRequest(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    origin: LocationSummary
    destination: LocationSummary
    user_preference: str | None = Field(None, alias="userPreference")

    model_config = ConfigDict(from_attributes=False, populate_by_name=True)


class RouteIntelligenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    origin: LocationSummary
    destination: LocationSummary
    route_options: list[RouteOption]
    distance_km: float | None = None
    is_international: bool = False
    requires_border_crossing: bool = False
    rovi_explanation: str | None = None
