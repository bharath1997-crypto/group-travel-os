from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

LivePlaceReportTypeLiteral = Literal[
    "long_line",
    "packed",
    "quiet",
    "price_changed",
    "closed_early",
    "no_parking",
]


class LivePlaceReportCreateRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    reportType: LivePlaceReportTypeLiteral
    placeName: str | None = Field(None, max_length=200)
    placeKey: str | None = Field(None, max_length=200)


class LivePlaceReportCreateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    reportType: LivePlaceReportTypeLiteral
    lat: float
    lng: float
    placeName: str | None = None
    expiresAt: datetime
    matchCount: int
    confirmed: bool


class LivePlaceReportSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    reportType: LivePlaceReportTypeLiteral
    lat: float
    lng: float
    placeName: str | None = None
    placeKey: str | None = None
    matchCount: int
    confirmed: bool
    latestAt: datetime


class LivePlaceReportNearbyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    reports: list[LivePlaceReportSummary]
    ttlMinutes: int
    confirmThreshold: int
