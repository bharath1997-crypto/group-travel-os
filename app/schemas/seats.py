"""Pydantic schemas for Seats API."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class MoneyOut(BaseModel):
    amount_paise: int
    display: str


class StopIn(BaseModel):
    label: str = Field(min_length=1, max_length=200)
    lat: float
    lon: float


class RideSearchQuery(BaseModel):
    from_lat: float
    from_lon: float
    to_lat: float
    to_lon: float
    date: date
    seats: int = Field(default=1, ge=1, le=4)
    sort: Literal["earliest", "cheapest", "rated"] = "earliest"


class CostPreviewIn(BaseModel):
    stops: list[StopIn] = Field(min_length=2)
    mileage_kmpl: float = Field(gt=0, le=40)
    seats_offered: int = Field(ge=1, le=6)
    tolls_paise: int | None = None
    region: str = "IN-MH"


VehicleBodyType = Literal["sedan", "suv", "compact_hatchback", "minivan"]
RideVisibility = Literal["groups", "fof", "public"]


class RidePublishIn(BaseModel):
    stops: list[StopIn] = Field(min_length=2)
    depart_at: datetime
    arrive_est_at: datetime | None = None
    seats_offered: int = Field(ge=1, le=6)
    visibility: RideVisibility = "public"
    approval: Literal["instant", "manual"]
    price_per_seat_paise: int = Field(ge=0)
    mileage_kmpl: float = Field(gt=0, le=40)
    vehicle_id: uuid.UUID | None = None
    tolls_paise: int | None = None
    note: str | None = Field(default=None, max_length=500)
    region: str = "IN-MH"
    route_geometry: list[list[float]] | None = Field(default=None, min_length=2)
    route_distance_meters: float | None = Field(default=None, gt=0)
    route_distance_miles: float | None = Field(default=None, gt=0)
    vehicle_body_type: VehicleBodyType | None = None
    route_option_id: str | None = Field(default=None, max_length=64)
    route_label: str | None = Field(default=None, max_length=120)


class BookingCreateIn(BaseModel):
    seats: int = Field(default=1, ge=1, le=4)
    board_seq: int = Field(ge=0)
    alight_seq: int = Field(ge=1)
    message: str | None = Field(default=None, max_length=300)


class BookingDecisionIn(BaseModel):
    action: Literal["approve", "decline", "withdraw"]


class WatchCreateIn(BaseModel):
    from_lat: float
    from_lon: float
    to_lat: float
    to_lon: float
    from_label: str | None = Field(default=None, max_length=200)
    to_label: str | None = Field(default=None, max_length=200)
    date_from: date | None = None
    date_to: date | None = None
    seats: int = Field(default=1, ge=1, le=4)


class WatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    from_lat: float
    from_lon: float
    to_lat: float
    to_lon: float
    from_label: str | None = None
    to_label: str | None = None
    date_from: date | None = None
    date_to: date | None = None
    seats: int
    active: bool
    last_alert_at: datetime | None = None
    created_at: datetime


class RidePatchIn(BaseModel):
    status: Literal["cancelled"] | None = None
    note: str | None = Field(default=None, max_length=500)
