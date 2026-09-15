"""Pydantic models for flight search (Kiwi Tequila) — no SQLAlchemy."""

from pydantic import BaseModel, ConfigDict, Field


class ProviderOffer(BaseModel):
    """Single booking seller offer for a flight option."""

    model_config = ConfigDict(from_attributes=False)

    provider_name: str
    price: float
    currency: str = "USD"
    booking_url: str


class FlightResult(BaseModel):
    """One bookable itinerary from search providers with N seller solutions."""

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
    deep_link: str = ""
    stops: int = 0
    provider: str = "Aviasales"
    provider_offers: list[ProviderOffer] = Field(default_factory=list)

