"""Agoda-style hotel search results (Pydantic only)."""

from pydantic import BaseModel, ConfigDict, Field


class HotelResult(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    id: str
    name: str
    location: str
    address: str
    price_per_night: float = Field(ge=0)
    currency: str = "USD"
    rating: float | None = Field(None, ge=0, le=5)
    review_count: int | None = Field(None, ge=0)
    stars: int | None = Field(None, ge=1, le=5)
    image_url: str | None = None
    amenities: list[str] = Field(default_factory=list)
    booking_url: str
    provider: str = "Agoda"
