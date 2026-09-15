"""Travelpayouts/Aviasales cached-fare adapter for redirect-only comparison."""

from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone

from app.schemas.flight_journey import FlightJourneySegment, FlightJourneySlice
from app.schemas.flight_metasearch import RovvyBaggageSummary, RovvyFareConditions, RovvyFlightOffer
from app.services.flight_meta_providers import search_travelpayouts_prices
from app.services.flight_providers.template_provider import FlightProviderAdapterBase
from app.services.flight_providers.types import ProviderSearchResult, ProviderStatus, RovvyFlightSearchRequest
from config import settings


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class TravelpayoutsFlightProvider(FlightProviderAdapterBase):
    provider_id = "travelpayouts"

    def is_configured(self) -> bool:
        return bool((settings.travelpayouts_api_token or "").strip())

    def search(self, request: RovvyFlightSearchRequest) -> ProviderSearchResult:
        started = time.perf_counter()
        body = request.body
        if not self.is_configured():
            return ProviderSearchResult(
                provider_id=self.provider_id,
                status=ProviderStatus(provider_id=self.provider_id, status="unconfigured", message="Travelpayouts is not configured"),
            )
        if body.trip_type != "one_way":
            return ProviderSearchResult(
                provider_id=self.provider_id,
                status=ProviderStatus(provider_id=self.provider_id, status="ok", environment="live", message="Cached-fare comparison currently supports one-way searches"),
            )

        outbound = body.slices[0]
        rows = search_travelpayouts_prices(
            fly_from=outbound.origin,
            fly_to=outbound.destination,
            date_from=outbound.departure_date,
            currency=body.currency,
        )
        checked_at = _utc_now_iso()
        offers: list[RovvyFlightOffer] = []
        for row in rows:
            # Cached Aviasales data may substitute a city or nearby airport. Keep
            # those out of the exact-result list; route recovery presents
            # alternatives explicitly instead of silently changing the search.
            if row.origin != outbound.origin or row.destination != outbound.destination:
                continue
            if not row.deep_link.startswith("https://") or not row.departure_at or row.duration_minutes <= 0:
                continue
            try:
                departure = datetime.fromisoformat(row.departure_at.replace("Z", "+00:00"))
            except ValueError:
                continue
            arrival_at = (departure + timedelta(minutes=row.duration_minutes)).isoformat().replace("+00:00", "Z")
            airline = row.airlines[0] if row.airlines else ""
            segment = FlightJourneySegment(
                origin=row.origin,
                destination=row.destination,
                departure_at=row.departure_at,
                arrival_at=arrival_at,
                duration_minutes=row.duration_minutes,
                airline_code=airline,
                airline_name=airline,
                operating_airline_code=airline,
                operating_airline_name=airline,
                flight_number="",
            )
            flight_slice = FlightJourneySlice(
                origin=row.origin,
                destination=row.destination,
                duration_minutes=row.duration_minutes,
                stops=row.stops,
                segments=[segment],
            )
            seller_name = row.provider_offers[0].provider_name if row.provider_offers else "Aviasales"
            offers.append(RovvyFlightOffer(
                provider_id=self.provider_id,
                provider_offer_id=row.id,
                itinerary_key="",
                seller_id=seller_name.lower().replace(" ", "-"),
                seller_name=seller_name,
                marketing_airlines=row.airlines,
                operating_airlines=row.airlines,
                slices=[flight_slice],
                total_price=row.price,
                currency=row.currency,
                baggage=RovvyBaggageSummary(summary="Not supplied by provider"),
                fare_conditions=RovvyFareConditions(summary="Confirm with seller"),
                redirect_url=row.deep_link,
                action_type="external_redirect",
                checked_at=checked_at,
                environment="live",
                departure_at=row.departure_at,
                arrival_at=arrival_at,
                origin=row.origin,
                destination=row.destination,
                total_duration_minutes=row.duration_minutes,
                stops=row.stops,
            ))
        elapsed = int((time.perf_counter() - started) * 1000)
        message = None if offers else "No cached Aviasales fares were available for this route and date"
        return ProviderSearchResult(
            provider_id=self.provider_id,
            offers=offers,
            status=ProviderStatus(provider_id=self.provider_id, status="ok", environment="live", message=message, elapsed_ms=elapsed),
            message=message,
        )

    def refresh_offer(self, provider_offer_id: str) -> RovvyFlightOffer:
        raise LookupError(f"Cached Travelpayouts offer cannot be refreshed: {provider_offer_id}")
