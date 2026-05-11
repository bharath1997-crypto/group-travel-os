"""User flight alert preferences."""

import re

from pydantic import BaseModel, ConfigDict, Field

_IATA_PATTERN = re.compile(r"^[A-Z]{3}$")


class FlightPreferencesRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    home_airport: str | None = None
    deal_price_threshold: float | None = Field(
        None,
        description="Alert threshold in USD; null means unset (scanner uses 300).",
    )
    deal_alerts_enabled: bool = False


class FlightPreferencesWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    home_airport: str = Field(
        ...,
        min_length=3,
        max_length=3,
        pattern=r"^[A-Za-z]{3}$",
    )
    deal_price_threshold: float = Field(..., gt=0, le=1_000_000)
    deal_alerts_enabled: bool


def coerce_and_validate_iata(value: str) -> str | None:
    """Return uppercase 3-letter IATA or None when invalid."""
    s = value.strip().upper()
    if not _IATA_PATTERN.match(s):
        return None
    return s
