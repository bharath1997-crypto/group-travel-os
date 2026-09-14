"""Duffel adapter implementing the provider-neutral flight contract."""

from __future__ import annotations

import logging
import time

import httpx

from app.schemas.flight_metasearch import ProviderEnvironment, RovvyFlightOffer
from app.services.flight_journey_service import FlightJourneyService
from app.services.flight_providers.normalizer import journey_to_offer
from app.services.flight_providers.types import (
    ProviderRedirect,
    ProviderSearchResult,
    ProviderStatus,
    RovvyFlightSearchRequest,
)
from app.utils.exceptions import AppException
from config import settings

logger = logging.getLogger(__name__)


class DuffelFlightProvider:
    provider_id = "duffel"

    def search(self, request: RovvyFlightSearchRequest) -> ProviderSearchResult:
        started = time.perf_counter()
        if not (settings.duffel_api_key or "").strip():
            elapsed = int((time.perf_counter() - started) * 1000)
            return ProviderSearchResult(
                provider_id=self.provider_id,
                offers=[],
                status=ProviderStatus(
                    provider_id=self.provider_id,
                    status="unconfigured",
                    message="Flight search is not configured",
                    elapsed_ms=elapsed,
                ),
            )

        try:
            response = FlightJourneyService.search_duffel(request.body)
            offers = [journey_to_offer(j, cabin=request.body.cabin) for j in response.journeys]
            environment: ProviderEnvironment | None = response.environment
            elapsed = int((time.perf_counter() - started) * 1000)
            return ProviderSearchResult(
                provider_id=self.provider_id,
                offers=offers,
                message=response.message,
                search_metadata=response.search_metadata,
                status=ProviderStatus(
                    provider_id=self.provider_id,
                    status="ok",
                    environment=environment,
                    message=response.message,
                    elapsed_ms=elapsed,
                ),
            )
        except httpx.TimeoutException:
            elapsed = int((time.perf_counter() - started) * 1000)
            logger.warning("Duffel provider search timeout")
            return ProviderSearchResult(
                provider_id=self.provider_id,
                offers=[],
                status=ProviderStatus(
                    provider_id=self.provider_id,
                    status="timeout",
                    message="Flight search is temporarily unavailable",
                    elapsed_ms=elapsed,
                ),
            )
        except AppException as exc:
            elapsed = int((time.perf_counter() - started) * 1000)
            detail = str(getattr(exc, "detail", "") or "")
            if isinstance(detail, dict):
                detail = str(detail.get("message") or detail.get("detail") or "")
            message = detail or "Flight search is temporarily unavailable"
            if "not configured" in message.lower():
                status = "unconfigured"
            else:
                status = "error"
            return ProviderSearchResult(
                provider_id=self.provider_id,
                offers=[],
                status=ProviderStatus(
                    provider_id=self.provider_id,
                    status=status,  # type: ignore[arg-type]
                    message=message if status == "unconfigured" else "Flight search is temporarily unavailable",
                    elapsed_ms=elapsed,
                ),
            )
        except Exception as exc:
            elapsed = int((time.perf_counter() - started) * 1000)
            logger.warning("Duffel provider search failed: %s", exc.__class__.__name__)
            return ProviderSearchResult(
                provider_id=self.provider_id,
                offers=[],
                status=ProviderStatus(
                    provider_id=self.provider_id,
                    status="error",
                    message="Flight search is temporarily unavailable",
                    elapsed_ms=elapsed,
                ),
            )

    def refresh_offer(self, provider_offer_id: str) -> RovvyFlightOffer:
        from app.services.flight_offer_service import FlightOfferService
        from datetime import datetime, timezone
        from app.schemas.flight_journey import FlightJourney

        offer = FlightOfferService.get_offer_detail(provider_offer_id)
        checked_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        journey = FlightJourney(
            id=provider_offer_id,
            provider="duffel",
            provider_offer_id=provider_offer_id,
            price=offer.price,
            currency=offer.currency,
            checked_at=checked_at,
            expires_at=offer.expires_at,
            live_mode=offer.live_mode,
            slices=offer.slices,  # type: ignore[arg-type]
            total_duration_minutes=offer.duration_minutes,
            maximum_connections=offer.stops,
            protected_connection=None,
            bookable_in_rovvy=False,
            airlines=offer.airlines,
            carry_on_included=offer.carry_on_included,
            checked_bag_included=offer.checked_bag_included,
            refundable=offer.refundable,
            changeable=offer.changeable,
            departure_at=offer.departure_at,
            arrival_at=offer.arrival_at,
            origin=offer.origin,
            destination=offer.destination,
            duration_minutes=offer.duration_minutes,
            stops=offer.stops,
            deep_link="",
        )
        return journey_to_offer(journey)

    def get_redirect(self, provider_offer_id: str) -> ProviderRedirect | None:
        del provider_offer_id
        return None

    def health_check(self) -> ProviderStatus:
        api_key = (settings.duffel_api_key or "").strip()
        if not api_key:
            return ProviderStatus(
                provider_id=self.provider_id,
                status="unconfigured",
                message="Duffel is not configured",
            )
        environment: ProviderEnvironment = "test" if api_key.startswith("duffel_test_") else "live"
        return ProviderStatus(provider_id=self.provider_id, status="ok", environment=environment)
