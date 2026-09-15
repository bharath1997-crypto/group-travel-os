"""Adaptive connection expansion and flexible-date search orchestration."""

from __future__ import annotations

import logging
import time
from copy import deepcopy
from datetime import timedelta
from typing import Any

import httpx

from app.schemas.flight_disclosure import AdaptiveSearchAttemptRecord, FlightSearchMetadata
from app.schemas.flight_journey import FlightJourney, FlightSearchRequest
from app.services.flight_disclosure_service import build_offer_provenance, store_offer_provenance
from app.services.flight_journey_parser import parse_duffel_journey

logger = logging.getLogger(__name__)

DUFFEL_MAX_CONNECTIONS = 2
MIN_GROUPS_BEFORE_EXPAND = 5
MAX_MERGED_RESULTS = 40
ADAPTIVE_RETRY_TIMEOUT_SECONDS = 25


def resolve_adaptive_limits(body: FlightSearchRequest) -> list[int]:
    """Return Duffel-supported connection limits to attempt in order."""
    requested_limit = min(body.maximum_connections, DUFFEL_MAX_CONNECTIONS)
    if requested_limit == 0:
        return [0]
    if body.strict_connection_limit:
        return [requested_limit]
    first = max(1, requested_limit)
    limits = [first]
    for candidate in range(first + 1, DUFFEL_MAX_CONNECTIONS + 1):
        if candidate > first:
            limits.append(candidate)
    return limits


def _apply_post_time_filters(journey: FlightJourney, body: FlightSearchRequest) -> bool:
    from app.services.flight_journey_parser import slice_matches_time_window

    for idx, sl_req in enumerate(body.slices):
        if idx >= len(journey.slices):
            return False
        if not slice_matches_time_window(
            journey.slices[idx],
            sl_req.departure_time_from,
            sl_req.departure_time_to,
        ):
            return False
    return True


def _merge_journeys(existing: list[FlightJourney], incoming: list[FlightJourney]) -> list[FlightJourney]:
    from app.services.flight_providers.itinerary_fingerprint import itinerary_key_from_journey

    seen_ids: set[str] = set()
    seen_keys: set[str] = set()
    merged: list[FlightJourney] = []

    for row in existing + incoming:
        if row.id in seen_ids:
            continue
        key = itinerary_key_from_journey(row)
        if key in seen_keys:
            continue
        seen_ids.add(row.id)
        seen_keys.add(key)
        merged.append(row)
        if len(merged) >= MAX_MERGED_RESULTS:
            break
    return merged


def _flexible_date_offsets(body: FlightSearchRequest) -> list[int]:
    if not body.flexible_dates:
        return [0]
    return [-2, -1, 0, 1, 2]


def _body_for_date_offset(body: FlightSearchRequest, offset_days: int) -> FlightSearchRequest:
    if offset_days == 0:
        return body
    clone = deepcopy(body)
    for sl in clone.slices:
        sl.departure_date = sl.departure_date + timedelta(days=offset_days)
    return clone


def execute_adaptive_duffel_search(
    body: FlightSearchRequest,
    *,
    create_offer_request,
    build_duffel_slices,
    build_duffel_passengers,
    cabin_to_duffel: dict[str, str],
    apply_post_time_filters,
    rank_journeys,
    checked_at: str,
) -> tuple[list[FlightJourney], FlightSearchMetadata]:
    """Run adaptive connection expansion (+ optional flexible dates) against Duffel."""
    limits = resolve_adaptive_limits(body)
    attempts: list[AdaptiveSearchAttemptRecord] = []
    all_journeys: list[FlightJourney] = []
    date_offsets = _flexible_date_offsets(body)
    attempt_number = 0

    def _group_count(journeys: list[FlightJourney]) -> int:
        from app.services.flight_providers.normalizer import group_offers_into_itineraries, journey_to_offer

        return len(group_offers_into_itineraries([journey_to_offer(j) for j in journeys]))

    for offset in date_offsets:
        offset_body = _body_for_date_offset(body, offset)
        actual_date_str = str(offset_body.slices[0].departure_date) if offset_body.slices else ""
        date_journeys: list[FlightJourney] = []

        for max_conn in limits:
            current_date_groups = _group_count(date_journeys)
            if body.strict_connection_limit is False and current_date_groups >= MIN_GROUPS_BEFORE_EXPAND:
                attempts.append(
                    AdaptiveSearchAttemptRecord(
                        attempt_number=attempt_number + 1,
                        maximum_connections=max_conn,
                        date_offset=offset,
                        departure_date=actual_date_str,
                        group_count=current_date_groups,
                        status="skipped",
                    )
                )
                continue

            attempt_number += 1
            started = time.perf_counter()
            status: str = "ok"
            offer_count = 0

            try:
                data = create_offer_request(
                    slices=build_duffel_slices(offset_body),
                    passengers=build_duffel_passengers(offset_body.passengers),
                    cabin_class=cabin_to_duffel.get(offset_body.cabin, "economy"),
                    max_connections=max_conn,
                    timeout=ADAPTIVE_RETRY_TIMEOUT_SECONDS,
                )
                offers = data.get("offers") or []
                batch: list[FlightJourney] = []
                for offer in offers:
                    if not isinstance(offer, dict):
                        continue
                    parsed = parse_duffel_journey(
                        offer,
                        currency_preference=offset_body.currency,
                        checked_at=checked_at,
                        maximum_connections=max_conn,
                    )
                    if parsed and apply_post_time_filters(parsed, offset_body):
                        batch.append(parsed)
                        store_offer_provenance(
                            build_offer_provenance(
                                parsed,
                                offer,
                                search_attempt_number=attempt_number,
                                requested_maximum_connections=max_conn,
                                search_timestamp=checked_at,
                            )
                        )
                offer_count = len(batch)
                date_journeys = _merge_journeys(date_journeys, batch)
            except httpx.TimeoutException:
                status = "timeout"
                logger.warning("Adaptive Duffel attempt timed out at max_connections=%s", max_conn)
            except Exception as exc:
                status = "error"
                logger.warning(
                    "Adaptive Duffel attempt failed at max_connections=%s: %s",
                    max_conn,
                    exc.__class__.__name__,
                )

            date_group_count = _group_count(date_journeys)
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            attempts.append(
                AdaptiveSearchAttemptRecord(
                    attempt_number=attempt_number,
                    maximum_connections=max_conn,
                    date_offset=offset,
                    departure_date=actual_date_str,
                    offer_count=offer_count,
                    group_count=date_group_count,
                    status=status,  # type: ignore[arg-type]
                    elapsed_ms=elapsed_ms,
                )
            )

            if body.strict_connection_limit:
                break
            if status == "ok" and date_group_count >= MIN_GROUPS_BEFORE_EXPAND:
                break

        all_journeys = _merge_journeys(all_journeys, date_journeys)

    all_journeys.sort(key=lambda j: j.price)
    final_journeys = rank_journeys(all_journeys[:MAX_MERGED_RESULTS])
    metadata = FlightSearchMetadata(
        strict_connection_limit=body.strict_connection_limit,
        adaptive_attempts=attempts,
        merged_offer_count=len(final_journeys),
        merged_group_count=_group_count(final_journeys),
        requested_destinations=[sl.destination for sl in body.slices],
    )
    return final_journeys, metadata
