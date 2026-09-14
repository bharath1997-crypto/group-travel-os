from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.live_routing import (
    RouteCoordinateDestination,
    RouteCoordinateOrigin,
    RoutePreviewResponse,
)


class LiveAddLocationRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    name: str = Field(..., min_length=1, max_length=200)
    address: str | None = Field(None, max_length=500)
    categoryLabel: str | None = Field(None, max_length=120)
    placeKey: str | None = Field(None, max_length=200)


class LiveAddLocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    pinId: uuid.UUID
    name: str
    latitude: float
    longitude: float
    created: bool


class LiveStartDirectionRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    origin: RouteCoordinateOrigin
    destination: RouteCoordinateDestination
    travelMode: Literal["Drive", "Bike", "Walk", "Trek"]


class LiveStartDirectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: Literal["ready", "failed"]
    sessionId: uuid.UUID | None = None
    route: RoutePreviewResponse | None = None
    message: str | None = None
