"""Provider-neutral flight metasearch models."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.flight_disclosure import (
    BaggageTransfer,
    ConnectionProtection,
    TicketType,
)
from app.schemas.flight_journey import FlightJourneySlice

SellerActionType = Literal["external_redirect", "provider_checkout", "unavailable"]
ProviderEnvironment = Literal["test", "live"]
ProviderHealth = Literal["ok", "timeout", "error", "disabled", "unconfigured"]


class RovvyFareConditions(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    refundable: bool | None = None
    changeable: bool | None = None
    summary: str | None = None


class RovvyBaggageSummary(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    carry_on_included: bool | None = None
    checked_bag_included: bool | None = None
    summary: str | None = None


class RovvyFlightOffer(BaseModel):
    """Normalized offer from any flight provider."""

    model_config = ConfigDict(from_attributes=False)

    provider_id: str
    provider_offer_id: str
    itinerary_key: str
    seller_id: str
    seller_name: str
    marketing_airlines: list[str] = Field(default_factory=list)
    operating_airlines: list[str] = Field(default_factory=list)
    slices: list[FlightJourneySlice] = Field(default_factory=list)
    total_price: float
    currency: str
    baggage: RovvyBaggageSummary = Field(default_factory=RovvyBaggageSummary)
    fare_conditions: RovvyFareConditions = Field(default_factory=RovvyFareConditions)
    protected_connection: bool | None = None
    ticket_type: TicketType = "unknown"
    connection_protection: ConnectionProtection = "unknown"
    baggage_transfer: BaggageTransfer = "unknown"
    separate_tickets: bool | None = None
    self_transfer: bool | None = None
    redirect_url: str | None = None
    action_type: SellerActionType = "unavailable"
    checked_at: str
    expires_at: str | None = None
    last_ticketing_date: str | None = None
    environment: ProviderEnvironment | None = None
    # Card/summary helpers
    departure_at: str = ""
    arrival_at: str = ""
    origin: str = ""
    destination: str = ""
    total_duration_minutes: int = 0
    stops: int = 0
    recommendation_score: float | None = None
    recommendation_reason: str | None = None


class RovvySellerOption(BaseModel):
    """One bookable/compare option for an itinerary group."""

    model_config = ConfigDict(from_attributes=False)

    provider_id: str
    provider_offer_id: str
    seller_id: str
    seller_name: str
    total_price: float
    currency: str
    baggage: RovvyBaggageSummary = Field(default_factory=RovvyBaggageSummary)
    fare_conditions: RovvyFareConditions = Field(default_factory=RovvyFareConditions)
    protected_connection: bool | None = None
    ticket_type: TicketType = "unknown"
    connection_protection: ConnectionProtection = "unknown"
    baggage_transfer: BaggageTransfer = "unknown"
    separate_tickets: bool | None = None
    self_transfer: bool | None = None
    redirect_url: str | None = None
    action_type: SellerActionType = "unavailable"
    checked_at: str
    expires_at: str | None = None
    last_ticketing_date: str | None = None
    environment: ProviderEnvironment | None = None


class RovvyItineraryGroup(BaseModel):
    """One itinerary with one or more seller options."""

    model_config = ConfigDict(from_attributes=False)

    itinerary_key: str
    marketing_airlines: list[str] = Field(default_factory=list)
    operating_airlines: list[str] = Field(default_factory=list)
    slices: list[FlightJourneySlice] = Field(default_factory=list)
    total_duration_minutes: int = 0
    stops: int = 0
    departure_at: str = ""
    arrival_at: str = ""
    origin: str = ""
    destination: str = ""
    seller_options: list[RovvySellerOption] = Field(default_factory=list)
    lowest_price: float | None = None
    currency: str | None = None
    recommendation_score: float | None = None
    recommendation_reason: str | None = None


class ProviderStatusRecord(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    provider_id: str
    status: ProviderHealth
    offer_count: int = 0
    environment: ProviderEnvironment | None = None
    message: str | None = None
    elapsed_ms: int | None = None


def _rebuild_cross_schema_models() -> None:
    from app.schemas.flight_journey import FlightJourneySearchResponse

    FlightJourneySearchResponse.model_rebuild(
        _types_namespace={
            "RovvyItineraryGroup": RovvyItineraryGroup,
            "ProviderStatusRecord": ProviderStatusRecord,
        },
    )


_rebuild_cross_schema_models()
