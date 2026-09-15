from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class RouteCoordinateOrigin(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    source: Literal["gps", "search", "map_pick", "map_center"]
    country: str | None = None


class RouteCoordinateDestination(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    name: str | None = None
    country: str | None = None


class RoutePreviewRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    origin: RouteCoordinateOrigin
    destination: RouteCoordinateDestination
    travelMode: Literal["Drive", "Bike", "Walk", "Trek"]


class GeoJSONGeometry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    type: Literal["LineString"]
    coordinates: list[list[float]]  # List of [lng, lat] pairs


class RouteManeuverOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    instruction: str
    location: list[float]  # [lng, lat]


class BorderCrossingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    latitude: float
    longitude: float
    fromCountry: str
    toCountry: str
    label: str
    approximate: bool = False
    highlightGeometry: list[list[float]] | None = None


class RoutePreviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: Literal["ready", "failed"]
    distanceMeters: float | None = None
    durationSeconds: float | None = None
    geometry: GeoJSONGeometry | None = None
    maneuvers: list[RouteManeuverOut] | None = None
    provider: str = "osrm"
    message: str | None = None
    """When driving cannot reach the exact pin, OSRM routes to the nearest road and foot routing covers the gap."""
    lastMileMode: Literal["walk"] | None = None
    lastMileDistanceMeters: float | None = None
    lastMileDurationSeconds: float | None = None
    lastMileNotice: str | None = None
    """Index in geometry.coordinates where the walk/hike segment begins (drive ends at index-1)."""
    walkStartIndex: int | None = None
    """True when the walk segment is approximate (no trail graph found)."""
    lastMileApproximate: bool | None = None
    borderCrossings: list[BorderCrossingOut] | None = None
    borderNotice: str | None = None
    alternatives: list["RouteAlternativeOut"] | None = None


class RouteAlternativeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    label: str
    tollLabel: str | None = None
    hasTolls: bool | None = None
    distanceMeters: float | None = None
    durationSeconds: float | None = None
    geometry: GeoJSONGeometry | None = None
    provider: str = "osrm"
