from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class BusResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    operator: str = Field(description="Bus company name")
    origin: str
    destination: str
    departure_at: str = Field(description="ISO datetime")
    arrival_at: str = Field(description="ISO datetime")
    duration_minutes: int
    price: float
    currency: str = "USD"
    available_seats: int | None = None
    booking_url: str = Field(description="Travelpayouts link")
    provider: str = "Busbud"
    amenities: list[str] = []


class BusSearchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    origin: str
    destination: str
    date: str
    results: list[BusResult]
