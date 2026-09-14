"""Flight provider contract."""

from __future__ import annotations

from typing import Protocol

from app.schemas.flight_metasearch import RovvyFlightOffer
from app.services.flight_providers.types import (
    ProviderRedirect,
    ProviderSearchResult,
    ProviderStatus,
    RovvyFlightSearchRequest,
)


class FlightProvider(Protocol):
    provider_id: str

    def search(self, request: RovvyFlightSearchRequest) -> ProviderSearchResult:
        """Search and return normalized offers."""

    def refresh_offer(self, provider_offer_id: str) -> RovvyFlightOffer:
        """Refresh a single offer from the provider."""

    def get_redirect(self, provider_offer_id: str) -> ProviderRedirect | None:
        """Return an approved external redirect URL when available."""

    def health_check(self) -> ProviderStatus:
        """Return provider readiness without exposing secrets."""
