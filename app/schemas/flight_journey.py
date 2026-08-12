"""Structured flight journey search + normalized Duffel responses."""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.flight_offer import FlightSegmentDetail, FlightSliceDetail

TripType = Literal["one_way", "round_trip", "multi_city"]
PassengerType = Literal["adult", "child", "infant_without_seat"]
CabinClass = Literal["economy", "premium_economy", "business", "first"]


class FlightSearchSliceRequest(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    origin: str = Field(..., min_length=3, max_length=3)
    destination: str = Field(..., min_length=3, max_length=3)
    departure_date: date
    departure_time_from: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    departure_time_to: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")

    @field_validator("origin", "destination")
    @classmethod
    def uppercase_iata(cls, v: str) -> str:
        code = v.strip().upper()
        if code in {"ANYWHERE", "__ANYWHERE__"}:
            raise ValueError("A specific airport or city code is required")
        return code

    @model_validator(mode="after")
    def origin_not_destination(self) -> FlightSearchSliceRequest:
        if self.origin == self.destination:
            raise ValueError("Origin and destination must differ")
        return self


class FlightSearchPassengerRequest(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    type: PassengerType
    age: int | None = Field(default=None, ge=0, le=120)


class FlightSearchRequest(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    trip_type: TripType
    slices: list[FlightSearchSliceRequest] = Field(..., min_length=1, max_length=6)
    passengers: list[FlightSearchPassengerRequest] = Field(..., min_length=1, max_length=9)
    cabin: CabinClass = "economy"
    maximum_connections: int = Field(default=1, ge=0, le=3)
    currency: str = Field(default="USD", min_length=3, max_length=3)

    @field_validator("currency")
    @classmethod
    def uppercase_currency(cls, v: str) -> str:
        return v.strip().upper()

    @model_validator(mode="after")
    def validate_trip(self) -> FlightSearchRequest:
        slices = self.slices
        if self.trip_type == "one_way" and len(slices) != 1:
            raise ValueError("One-way searches require exactly one slice")
        if self.trip_type == "round_trip" and len(slices) != 2:
            raise ValueError("Round-trip searches require exactly two slices")
        if self.trip_type == "multi_city" and len(slices) < 2:
            raise ValueError("Multi-city searches require at least two slices")

        if self.trip_type == "round_trip":
            out, ret = slices[0], slices[1]
            if out.origin != ret.destination or out.destination != ret.origin:
                raise ValueError("Round-trip slices must be reciprocal")

        today = date.today()
        prev_date: date | None = None
        for sl in slices:
            if sl.departure_date < today:
                raise ValueError("Departure dates cannot be in the past")
            if prev_date is not None and sl.departure_date < prev_date:
                raise ValueError("Slice departure dates must be chronological")
            prev_date = sl.departure_date

        adults = sum(1 for p in self.passengers if p.type == "adult")
        if adults < 1:
            raise ValueError("At least one adult passenger is required")
        if len(self.passengers) > 9:
            raise ValueError("Maximum 9 travelers per search")

        return self


class FlightConnectionDetail(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    airport: str
    airport_name: str = ""
    arrival_at: str | None = None
    next_departure_at: str | None = None
    layover_minutes: int | None = None
    overnight: bool | None = None
    same_airport: bool | None = None
    airport_change: bool | None = None
    terminal_change: bool | None = None
    protected: bool | None = None


class FlightJourneySegment(FlightSegmentDetail):
    operating_airline_code: str = ""
    operating_airline_name: str = ""


class FlightJourneySlice(FlightSliceDetail):
    segments: list[FlightJourneySegment] = Field(default_factory=list)
    connections: list[FlightConnectionDetail] = Field(default_factory=list)


class FlightJourney(BaseModel):
    """One complete Duffel offer as a bookable journey."""

    model_config = ConfigDict(from_attributes=False)

    id: str
    provider: str = "duffel"
    provider_offer_id: str
    price: float
    currency: str
    checked_at: str
    expires_at: str
    live_mode: bool
    slices: list[FlightJourneySlice] = Field(default_factory=list)
    total_duration_minutes: int = 0
    maximum_connections: int = 0
    protected_connection: bool | None = None
    bookable_in_rovvy: bool = True
    airlines: list[str] = Field(default_factory=list)
    carry_on_included: bool | None = None
    checked_bag_included: bool | None = None
    refundable: bool | None = None
    changeable: bool | None = None
    recommendation_score: float | None = None
    recommendation_reason: str | None = None
    # Summary fields for cards, sorting, and legacy GET consumers
    departure_at: str = ""
    arrival_at: str = ""
    origin: str = ""
    destination: str = ""
    duration_minutes: int = 0
    stops: int = 0
    deep_link: str = ""


class FlightJourneySearchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    journeys: list[FlightJourney] = Field(default_factory=list)
    provider: str = "duffel"
    live_mode: bool | None = None
    message: str | None = None
