"""Duffel instant order booking from a selected offer."""

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class FlightPassengerInput(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    given_name: str = Field(..., min_length=1, max_length=80)
    family_name: str = Field(..., min_length=1, max_length=80)
    email: EmailStr
    phone_number: str = Field(..., min_length=8, max_length=24)
    born_on: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    title: str = Field(default="mr", pattern=r"^(mr|mrs|ms|miss|dr)$")
    gender: str = Field(default="m", pattern=r"^(m|f)$")


class FlightBookRequest(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    offer_id: str = Field(..., min_length=3, max_length=120)
    passengers: list[FlightPassengerInput] = Field(..., min_length=1, max_length=9)


class FlightBookResponse(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    order_id: str
    booking_reference: str
    total_amount: float
    currency: str
    live_mode: bool = False
    message: str = "Booking confirmed in Rovvy."


class FlightOrderPassenger(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    id: str = ""
    type: str = "adult"
    given_name: str = ""
    family_name: str = ""
    email: str = ""
    ticket_number: str = ""


class FlightOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    id: str
    booking_reference: str
    status: str = "confirmed"  # pending, confirmed, cancelled
    total_amount: float
    currency: str
    slices: list[dict] = Field(default_factory=list)
    passengers: list[FlightOrderPassenger] = Field(default_factory=list)
    available_actions: list[str] = Field(default_factory=list)
    live_mode: bool = False
    created_at: str = ""


class FlightCancelQuoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    cancellation_id: str
    order_id: str
    refund_amount: float
    currency: str
    expires_at: str = ""
    message: str = "Cancellation quote generated."


class FlightCancelConfirmResponse(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    cancellation_id: str
    order_id: str
    status: str = "confirmed"
    refund_amount: float
    currency: str
    message: str = "Order cancelled successfully."


class AssociateTripRequest(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    trip_id: str


class AssociateTripResponse(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    booking_id: str
    trip_id: str
    status: str
    message: str = "Booking associated with Trip Space."

