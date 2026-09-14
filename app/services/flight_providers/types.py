"""Provider-layer result types."""

from __future__ import annotations

from dataclasses import dataclass, field

from app.schemas.flight_disclosure import FlightSearchMetadata
from app.schemas.flight_metasearch import ProviderEnvironment, ProviderHealth, RovvyFlightOffer
from app.schemas.flight_journey import FlightSearchRequest


@dataclass
class ProviderRedirect:
    url: str
    seller_name: str | None = None


@dataclass
class ProviderStatus:
    provider_id: str
    status: ProviderHealth
    environment: ProviderEnvironment | None = None
    message: str | None = None
    elapsed_ms: int | None = None


@dataclass
class ProviderSearchResult:
    provider_id: str
    offers: list[RovvyFlightOffer] = field(default_factory=list)
    status: ProviderStatus | None = None
    message: str | None = None
    search_metadata: FlightSearchMetadata | None = None


@dataclass
class RovvyFlightSearchRequest:
    """Alias wrapper for normalized search input."""

    body: FlightSearchRequest
