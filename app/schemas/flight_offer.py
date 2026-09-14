"""Detailed flight offer + reprice responses (Duffel-backed)."""

from pydantic import BaseModel, ConfigDict, Field


class FlightSegmentDetail(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    origin: str
    origin_name: str = ""
    destination: str
    destination_name: str = ""
    departure_at: str
    arrival_at: str
    duration_minutes: int = 0
    airline_code: str = ""
    airline_name: str = ""
    flight_number: str = ""
    aircraft: str = ""
    origin_terminal: str = ""
    destination_terminal: str = ""


class FlightSliceDetail(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    origin: str
    destination: str
    duration_minutes: int = 0
    stops: int = 0
    segments: list[FlightSegmentDetail] = Field(default_factory=list)


class FlightOfferDetail(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    id: str
    price: float
    currency: str
    airlines: list[str] = Field(default_factory=list)
    departure_at: str
    arrival_at: str
    origin: str
    destination: str
    duration_minutes: int = 0
    stops: int = 0
    slices: list[FlightSliceDetail] = Field(default_factory=list)
    cabin_class: str = "economy"
    fare_brand: str = ""
    expires_at: str = ""
    live_mode: bool = False
    carry_on_included: bool | None = None
    checked_bag_included: bool | None = None
    refundable: bool | None = None
    changeable: bool | None = None


class FlightOfferPriceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    offer_id: str
    previous_price: float | None = None
    current_price: float
    currency: str
    price_changed: bool = False
    price_increased: bool = False
    expires_at: str = ""
    live_mode: bool = False
    message: str = ""
