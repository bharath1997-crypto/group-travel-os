"""GetYourGuide-style activity search results (Pydantic only)."""

from pydantic import BaseModel, ConfigDict, Field


class ActivityResult(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    id: str
    title: str
    description: str
    location: str
    price: float = Field(ge=0)
    currency: str = "USD"
    duration_minutes: int | None = None
    rating: float | None = Field(None, ge=0, le=5)
    image_url: str | None = None
    booking_url: str
    provider: str = "GetYourGuide"
    category: str | None = None
