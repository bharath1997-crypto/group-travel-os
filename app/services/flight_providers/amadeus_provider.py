"""Amadeus Self-Service adapter implementing the provider-neutral flight contract."""

from __future__ import annotations

import logging
import time
from datetime import date

import httpx

from app.schemas.flight_metasearch import ProviderEnvironment, RovvyFlightOffer
from app.services.flight_providers.amadeus_normalizer import normalize_amadeus_offers
from app.services.flight_providers.amadeus_oauth import AmadeusOAuthClient, AmadeusOAuthError, get_amadeus_oauth_client
from app.services.flight_providers.normalizer import journey_to_offer
from app.services.flight_providers.template_provider import FlightProviderAdapterBase
from app.services.flight_providers.types import (
    ProviderRedirect,
    ProviderSearchResult,
    ProviderStatus,
    RovvyFlightSearchRequest,
)
from config import settings

logger = logging.getLogger(__name__)

_CABIN_TO_AMADEUS = {
    "economy": "ECONOMY",
    "premium_economy": "PREMIUM_ECONOMY",
    "business": "BUSINESS",
    "first": "FIRST",
}


class AmadeusFlightProvider(FlightProviderAdapterBase):
    provider_id = "amadeus"

    def __init__(self, oauth_client: AmadeusOAuthClient | None = None) -> None:
        self._oauth = oauth_client or get_amadeus_oauth_client()

    def is_configured(self) -> bool:
        return self._oauth.is_configured()

    def _environment(self) -> ProviderEnvironment:
        return "live" if self._oauth.resolve_environment() == "production" else "test"

    def _timeout(self) -> float:
        return float(settings.amadeus_timeout_seconds or 15)

    def _build_search_params(self, request: RovvyFlightSearchRequest) -> dict[str, str | int]:
        body = request.body
        outbound = body.slices[0]
        adults = sum(1 for passenger in body.passengers if passenger.type == "adult")
        children = sum(1 for passenger in body.passengers if passenger.type == "child")
        infants = sum(1 for passenger in body.passengers if passenger.type == "infant_without_seat")

        params: dict[str, str | int] = {
            "originLocationCode": outbound.origin,
            "destinationLocationCode": outbound.destination,
            "departureDate": outbound.departure_date.isoformat(),
            "adults": max(adults, 1),
            "currencyCode": body.currency,
            "max": 50,
            "travelClass": _CABIN_TO_AMADEUS.get(body.cabin, "ECONOMY"),
        }
        if children:
            params["children"] = children
        if infants:
            params["infants"] = infants
        if body.trip_type == "round_trip" and len(body.slices) > 1:
            params["returnDate"] = body.slices[1].departure_date.isoformat()
        if body.maximum_connections == 0:
            params["nonStop"] = "true"
        return params

    def _unsupported_result(self, *, elapsed_ms: int, message: str) -> ProviderSearchResult:
        return ProviderSearchResult(
            provider_id=self.provider_id,
            offers=[],
            status=ProviderStatus(
                provider_id=self.provider_id,
                status="ok",
                environment=self._environment(),
                message=message,
                elapsed_ms=elapsed_ms,
            ),
        )

    def search(self, request: RovvyFlightSearchRequest) -> ProviderSearchResult:
        started = time.perf_counter()
        if not self.is_configured():
            elapsed = int((time.perf_counter() - started) * 1000)
            return ProviderSearchResult(
                provider_id=self.provider_id,
                offers=[],
                status=ProviderStatus(
                    provider_id=self.provider_id,
                    status="unconfigured",
                    message="Amadeus is not configured",
                    elapsed_ms=elapsed,
                ),
            )

        if request.body.trip_type == "multi_city":
            elapsed = int((time.perf_counter() - started) * 1000)
            return self._unsupported_result(
                elapsed_ms=elapsed,
                message="Multi-city search is not supported by Amadeus in this adapter",
            )

        try:
            self._oauth.resolve_environment()
        except AmadeusOAuthError as exc:
            elapsed = int((time.perf_counter() - started) * 1000)
            return ProviderSearchResult(
                provider_id=self.provider_id,
                offers=[],
                status=ProviderStatus(
                    provider_id=self.provider_id,
                    status="error",
                    message=str(exc),
                    elapsed_ms=elapsed,
                ),
            )

        base_url = self._oauth.resolve_base_url()
        params = self._build_search_params(request)
        timeout = self._timeout()

        try:
            with httpx.Client(timeout=timeout) as client:
                access_token = self._oauth.get_access_token(client=client)
                response = client.get(
                    f"{base_url}/v2/shopping/flight-offers",
                    params=params,
                    headers={"Authorization": f"Bearer {access_token}"},
                )
        except httpx.TimeoutException:
            elapsed = int((time.perf_counter() - started) * 1000)
            logger.warning("Amadeus provider search timeout")
            return ProviderSearchResult(
                provider_id=self.provider_id,
                offers=[],
                status=ProviderStatus(
                    provider_id=self.provider_id,
                    status="timeout",
                    environment=self._environment(),
                    message="Flight search is temporarily unavailable",
                    elapsed_ms=elapsed,
                ),
            )
        except AmadeusOAuthError:
            elapsed = int((time.perf_counter() - started) * 1000)
            logger.warning("Amadeus provider authentication failed")
            return ProviderSearchResult(
                provider_id=self.provider_id,
                offers=[],
                status=ProviderStatus(
                    provider_id=self.provider_id,
                    status="error",
                    environment=self._environment(),
                    message="Flight search is temporarily unavailable",
                    elapsed_ms=elapsed,
                ),
            )
        except httpx.HTTPError:
            elapsed = int((time.perf_counter() - started) * 1000)
            logger.warning("Amadeus provider network failure")
            return ProviderSearchResult(
                provider_id=self.provider_id,
                offers=[],
                status=ProviderStatus(
                    provider_id=self.provider_id,
                    status="error",
                    environment=self._environment(),
                    message="Flight search is temporarily unavailable",
                    elapsed_ms=elapsed,
                ),
            )

        elapsed = int((time.perf_counter() - started) * 1000)
        if response.status_code in {401, 403}:
            self._oauth.invalidate()
            logger.warning("Amadeus provider authentication rejected during search")
            return ProviderSearchResult(
                provider_id=self.provider_id,
                offers=[],
                status=ProviderStatus(
                    provider_id=self.provider_id,
                    status="error",
                    environment=self._environment(),
                    message="Flight search is temporarily unavailable",
                    elapsed_ms=elapsed,
                ),
            )
        if response.status_code == 429:
            logger.warning("Amadeus provider rate limited")
            return ProviderSearchResult(
                provider_id=self.provider_id,
                offers=[],
                status=ProviderStatus(
                    provider_id=self.provider_id,
                    status="error",
                    environment=self._environment(),
                    message="Flight search is temporarily unavailable",
                    elapsed_ms=elapsed,
                ),
            )
        if response.status_code >= 500:
            logger.warning("Amadeus provider upstream unavailable: %s", response.status_code)
            return ProviderSearchResult(
                provider_id=self.provider_id,
                offers=[],
                status=ProviderStatus(
                    provider_id=self.provider_id,
                    status="error",
                    environment=self._environment(),
                    message="Flight search is temporarily unavailable",
                    elapsed_ms=elapsed,
                ),
            )
        if response.status_code >= 400:
            logger.warning("Amadeus provider rejected search request: %s", response.status_code)
            return ProviderSearchResult(
                provider_id=self.provider_id,
                offers=[],
                status=ProviderStatus(
                    provider_id=self.provider_id,
                    status="error",
                    environment=self._environment(),
                    message="Flight search is temporarily unavailable",
                    elapsed_ms=elapsed,
                ),
            )

        try:
            payload = response.json()
        except ValueError:
            logger.warning("Amadeus provider returned invalid JSON")
            return ProviderSearchResult(
                provider_id=self.provider_id,
                offers=[],
                status=ProviderStatus(
                    provider_id=self.provider_id,
                    status="error",
                    environment=self._environment(),
                    message="Flight search is temporarily unavailable",
                    elapsed_ms=elapsed,
                ),
            )

        live_mode = self._environment() == "live"
        journeys = normalize_amadeus_offers(payload, live_mode=live_mode)
        offers: list[RovvyFlightOffer] = [
            journey_to_offer(journey, cabin=request.body.cabin) for journey in journeys
        ]
        return ProviderSearchResult(
            provider_id=self.provider_id,
            offers=offers,
            status=ProviderStatus(
                provider_id=self.provider_id,
                status="ok",
                environment=self._environment(),
                elapsed_ms=elapsed,
            ),
        )

    def refresh_offer(self, provider_offer_id: str) -> RovvyFlightOffer:
        del provider_offer_id
        raise NotImplementedError("Amadeus refresh_offer is not supported in search-only mode")

    def get_redirect(self, provider_offer_id: str) -> ProviderRedirect | None:
        del provider_offer_id
        return None

    def health_check(self) -> ProviderStatus:
        if not self.is_configured():
            return ProviderStatus(
                provider_id=self.provider_id,
                status="unconfigured",
                message="Amadeus is not configured",
            )
        try:
            self._oauth.resolve_environment()
        except AmadeusOAuthError as exc:
            return ProviderStatus(
                provider_id=self.provider_id,
                status="error",
                message=str(exc),
            )
        return ProviderStatus(
            provider_id=self.provider_id,
            status="ok",
            environment=self._environment(),
        )
