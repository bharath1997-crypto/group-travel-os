"""Concurrent provider-neutral flight search coordinator."""

from __future__ import annotations

import logging
from concurrent.futures import Future, ThreadPoolExecutor, TimeoutError as FuturesTimeoutError, as_completed
from datetime import datetime, timezone

from app.schemas.flight_journey import FlightJourneySearchResponse, FlightSearchRequest
from app.schemas.flight_metasearch import ProviderStatusRecord
from app.services.flight_providers.normalizer import group_offers_into_itineraries, group_to_legacy_journey
from app.services.flight_providers.protocol import FlightProvider
from app.services.flight_providers.registry import enabled_providers, record_provider_search
from app.services.flight_providers.types import ProviderSearchResult, ProviderStatus, RovvyFlightSearchRequest

logger = logging.getLogger(__name__)

DEFAULT_PROVIDER_TIMEOUT_SECONDS = 55


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _enabled_providers() -> list[FlightProvider]:
    return enabled_providers()


def _safe_provider_message(message: str | None) -> str | None:
    if not message:
        return None
    lowered = message.lower()
    if any(token in lowered for token in ("token", "api_key", "secret", "client_id", "client_secret", "access_token", "http://", "https://", "duffel.com", "amadeus.com")):
        return "Flight search is temporarily unavailable"
    return message


def _timeout_status(provider_id: str) -> ProviderStatusRecord:
    return ProviderStatusRecord(
        provider_id=provider_id,
        status="timeout",
        offer_count=0,
        message="Flight search is temporarily unavailable",
    )


def _record_provider_result(
    result: ProviderSearchResult,
    provider_id: str,
    *,
    statuses: list[ProviderStatusRecord],
    counters: dict[str, int],
) -> None:
    status = result.status
    if status is not None:
        record_provider_search(status)
    if status and status.status == "ok":
        counters["succeeded"] += 1
    else:
        counters["failed"] += 1
    statuses.append(
        ProviderStatusRecord(
            provider_id=provider_id,
            status=status.status if status else "error",
            offer_count=len(result.offers),
            environment=status.environment if status else None,
            message=_safe_provider_message(status.message if status else result.message),
            elapsed_ms=status.elapsed_ms if status else None,
        )
    )


def _handle_future(
    future: Future[ProviderSearchResult],
    provider: FlightProvider,
    *,
    results: list[ProviderSearchResult],
    statuses: list[ProviderStatusRecord],
    counters: dict[str, int],
) -> None:
    try:
        result = future.result()
    except Exception as exc:
        counters["failed"] += 1
        logger.warning("Provider %s failed: %s", provider.provider_id, exc.__class__.__name__)
        statuses.append(
            ProviderStatusRecord(
                provider_id=provider.provider_id,
                status="error",
                offer_count=0,
                message="Flight search is temporarily unavailable",
            )
        )
        record_provider_search(
            ProviderStatus(
                provider_id=provider.provider_id,
                status="error",
                message="Flight search is temporarily unavailable",
            )
        )
        return

    results.append(result)
    _record_provider_result(result, provider.provider_id, statuses=statuses, counters=counters)


class FlightSearchCoordinator:
    @staticmethod
    def search(
        body: FlightSearchRequest,
        *,
        timeout_seconds: int = DEFAULT_PROVIDER_TIMEOUT_SECONDS,
    ) -> FlightJourneySearchResponse:
        providers = _enabled_providers()
        requested = len(providers)
        if requested == 0:
            return FlightJourneySearchResponse(
                journeys=[],
                itinerary_groups=[],
                provider_statuses=[],
            providers_requested=0,
            providers_succeeded=0,
            providers_failed=0,
            offers_before_grouping=0,
            unique_itinerary_count=0,
            partial_results=False,
                searched_at=_utc_now_iso(),
                message="No flight providers are enabled",
                provider="none",
                live_mode=None,
                environment=None,
            )

        results: list[ProviderSearchResult] = []
        statuses: list[ProviderStatusRecord] = []
        counters = {"succeeded": 0, "failed": 0}

        pool = ThreadPoolExecutor(max_workers=max(1, requested))
        future_map: dict[Future[ProviderSearchResult], FlightProvider] = {
            pool.submit(provider.search, RovvyFlightSearchRequest(body=body)): provider
            for provider in providers
        }
        processed: set[Future[ProviderSearchResult]] = set()

        try:
            try:
                for future in as_completed(future_map, timeout=timeout_seconds):
                    processed.add(future)
                    _handle_future(
                        future,
                        future_map[future],
                        results=results,
                        statuses=statuses,
                        counters=counters,
                    )
            except FuturesTimeoutError:
                logger.warning(
                    "Flight provider search deadline exceeded after %ss",
                    timeout_seconds,
                )

            for future, provider in future_map.items():
                if future in processed:
                    continue
                if future.done():
                    processed.add(future)
                    _handle_future(
                        future,
                        provider,
                        results=results,
                        statuses=statuses,
                        counters=counters,
                    )
                    continue

                future.cancel()
                counters["failed"] += 1
                statuses.append(_timeout_status(provider.provider_id))
                record_provider_search(
                    ProviderStatus(
                        provider_id=provider.provider_id,
                        status="timeout",
                        message="Flight search is temporarily unavailable",
                    )
                )
        finally:
            pool.shutdown(wait=False, cancel_futures=True)

        succeeded = counters["succeeded"]
        failed = counters["failed"]

        all_offers = []
        for result in results:
            all_offers.extend(result.offers)

        groups = group_offers_into_itineraries(all_offers)
        journeys = [group_to_legacy_journey(g) for g in groups]
        offers_before_grouping = len(all_offers)
        unique_itinerary_count = len(groups)

        live_values = {s.environment for s in statuses if s.environment}
        environment = next(iter(live_values)) if len(live_values) == 1 else None
        live_mode = None
        if environment == "live":
            live_mode = True
        elif environment == "test":
            live_mode = False
        elif not live_values and journeys:
            live_mode = journeys[0].live_mode

        partial = succeeded > 0 and failed > 0
        message = None
        search_metadata = None
        for result in results:
            if result.search_metadata is not None:
                search_metadata = result.search_metadata
                break
        if not journeys:
            if failed == requested:
                message = "Flight search is temporarily unavailable"
            else:
                message = "No matching live offers for this search"

        successful_provider_ids = [status.provider_id for status in statuses if status.status == "ok"]
        provider_summary = successful_provider_ids[0] if len(successful_provider_ids) == 1 else (
            "multiple" if successful_provider_ids else "none"
        )

        return FlightJourneySearchResponse(
            journeys=journeys,
            itinerary_groups=groups,
            provider_statuses=statuses,
            providers_requested=requested,
            providers_succeeded=succeeded,
            providers_failed=failed,
            offers_before_grouping=offers_before_grouping,
            unique_itinerary_count=unique_itinerary_count,
            partial_results=partial,
            searched_at=_utc_now_iso(),
            message=message,
            provider=provider_summary,
            live_mode=live_mode,
            environment=environment,
            search_metadata=search_metadata,
        )
