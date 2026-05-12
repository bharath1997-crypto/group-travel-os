"""Multi-modal route discovery (flights + ground) — Pydantic only."""

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class TransportMode(StrEnum):
    FLIGHT = "flight"
    TRANSIT = "transit"
    BUS = "bus"
    TRAIN = "train"
    DRIVE = "drive"


class TransportOption(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    mode: TransportMode
    summary: str
    duration_minutes: int = Field(ge=0)
    price_estimate: float | None = None
    currency: str | None = None
    steps: list[str] = Field(default_factory=list)
    booking_url: str | None = None
    provider: str | None = None


class RouteSearchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    origin: str
    destination: str
    options: list[TransportOption]
