"""Pydantic models for flight search (Kiwi Tequila) — no SQLAlchemy."""

from pydantic import BaseModel, ConfigDict, Field


class FlightResult(BaseModel):
    """One bookable itinerary from the search provider."""

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
