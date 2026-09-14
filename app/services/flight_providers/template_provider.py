"""Base class for future authorized flight-provider adapters.

Adapters must normalize real provider responses into ``RovvyFlightOffer``.
They must never synthesize prices, redirects, protection, or baggage rules.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.schemas.flight_metasearch import RovvyFlightOffer
from app.services.flight_providers.types import (
    ProviderRedirect,
    ProviderSearchResult,
    ProviderStatus,
    RovvyFlightSearchRequest,
)


class FlightProviderAdapterBase(ABC):
    provider_id: str

    @abstractmethod
    def is_configured(self) -> bool:
        """Return true only when required credentials/configuration exist."""

    @abstractmethod
    def search(self, request: RovvyFlightSearchRequest) -> ProviderSearchResult:
        """Return only normalized offers received from the provider."""

    @abstractmethod
    def refresh_offer(self, provider_offer_id: str) -> RovvyFlightOffer:
        """Refresh a provider offer before redirect or checkout."""

    def get_redirect(self, provider_offer_id: str) -> ProviderRedirect | None:
        """Return None until the provider supplies an approved HTTPS URL."""
        del provider_offer_id
        return None

    def health_check(self) -> ProviderStatus:
        if not self.is_configured():
            return ProviderStatus(
                provider_id=self.provider_id,
                status="unconfigured",
                message="Provider is not configured",
            )
        return ProviderStatus(provider_id=self.provider_id, status="ok")

