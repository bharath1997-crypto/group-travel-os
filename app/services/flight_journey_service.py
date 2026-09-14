"""Production-safe Duffel-only flight journey search."""

from __future__ import annotations

import logging
import time
from datetime import date, datetime, timezone
from typing import Any

from app.schemas.flight import FlightResult
from app.schemas.flight_journey import (
    FlightJourney,
    FlightJourneySearchResponse,
    FlightSearchPassengerRequest,
    FlightSearchRequest,
    FlightSearchSliceRequest,
)
from app.services.duffel_client import create_offer_request
from app.services.flight_adaptive_search import execute_adaptive_duffel_search
from app.services.flight_journey_parser import slice_matches_time_window
from app.services.flight_service import _normalize_fly_term
from app.utils.exceptions import AppException
from config import settings

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 1_800
_EMPTY_FAILURE_TTL_SECONDS = 120
_journey_cache: dict[str, tuple[float, list[FlightJourney]]] = {}

CABIN_TO_DUFFEL = {
    "economy": "economy",
    "premium_economy": "premium_economy",
    "business": "business",
    "first": "first",
}

CABIN_CODE_MAP = {
    "M": "economy",
    "W": "premium_economy",
    "C": "business",
    "F": "first",
}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _duffel_configured() -> bool:
    return bool((settings.duffel_api_key or "").strip())


def _production_safe_mode() -> bool:
    explicit = (settings.flight_live_provider or "duffel").strip().lower()
    if explicit == "discovery":
        return bool(getattr(settings, "allow_estimated_flights", False))
    return True


def _build_cache_key(body: FlightSearchRequest) -> str:
    slice_parts: list[str] = []
    for sl in body.slices:
        tw = f"{sl.departure_time_from or ''}-{sl.departure_time_to or ''}"
        slice_parts.append(
            f"{sl.origin}:{sl.destination}:{sl.departure_date.isoformat()}:{tw}"
        )
    pax_parts = sorted(f"{p.type}:{p.age or ''}" for p in body.passengers)
    return "|".join(
        [
            body.trip_type,
            ";".join(slice_parts),
            ",".join(pax_parts),
            body.cabin,
            str(body.maximum_connections),
            str(body.strict_connection_limit),
            str(body.flexible_dates),
            body.currency.upper(),
            "duffel",
            "live" if _duffel_configured() else "none",
        ]
    )


def _build_duffel_slices(body: FlightSearchRequest) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for sl in body.slices:
        origin = _normalize_fly_term(sl.origin)
        dest = _normalize_fly_term(sl.destination)
        item: dict[str, Any] = {
            "origin": origin,
            "destination": dest,
            "departure_date": sl.departure_date.isoformat(),
        }
        if sl.departure_time_from or sl.departure_time_to:
            dep_time: dict[str, str] = {}
            if sl.departure_time_from:
                dep_time["from"] = sl.departure_time_from
            if sl.departure_time_to:
                dep_time["to"] = sl.departure_time_to
            item["departure_time"] = dep_time
        out.append(item)
    return out


def _build_duffel_passengers(passengers: list[FlightSearchPassengerRequest]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    default_ages = {"adult": 30, "child": 10, "infant_without_seat": 1}
    for p in passengers:
        if p.type == "adult" and p.age is None:
            out.append({"type": "adult"})
        elif p.age is not None:
            out.append({"age": p.age})
        else:
            out.append({"age": default_ages.get(p.type, 30)})
    return out


def _apply_post_time_filters(journey: FlightJourney, body: FlightSearchRequest) -> bool:
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


def _dedupe_journeys(rows: list[FlightJourney], limit: int = 40) -> list[FlightJourney]:
    seen: set[str] = set()
    unique: list[FlightJourney] = []
    for row in rows:
        if row.id in seen:
            continue
        seen.add(row.id)
        unique.append(row)
        if len(unique) >= limit:
            break
    return unique


def _longest_layover_minutes(journey: FlightJourney) -> int:
    longest = 0
    for sl in journey.slices:
        for conn in sl.connections:
            if conn.layover_minutes is not None and conn.layover_minutes > longest:
                longest = conn.layover_minutes
    return longest


def _format_minutes_delta(minutes: int) -> str:
    hours = minutes // 60
    mins = minutes % 60
    if hours > 0 and mins > 0:
        return f"{hours}h {mins}m"
    if hours > 0:
        return f"{hours}h"
    return f"{mins}m"


def _rank_journeys(journeys: list[FlightJourney]) -> list[FlightJourney]:
    if len(journeys) <= 1:
        if journeys and not journeys[0].recommendation_reason:
            only = journeys[0]
            only_dur = only.total_duration_minutes or only.duration_minutes
            dur_str = f"{_format_minutes_delta(only_dur)} total journey" if only_dur > 0 else ""
            stops_str = "nonstop" if only.stops == 0 else (f"with {only.stops} connection" if only.stops == 1 else f"with {only.stops} connections")
            reason_items = ["Lowest price", stops_str]
            if dur_str:
                reason_items.append(dur_str)
            return [
                only.model_copy(
                    update={
                        "recommendation_score": 0.0,
                        "recommendation_reason": "; ".join(reason_items) + ".",
                    }
                )
            ]
        return journeys

    prices = [j.price for j in journeys]
    durations = [j.total_duration_minutes or j.duration_minutes for j in journeys]
    min_p, max_p = min(prices), max(prices)
    min_d, max_d = min(durations), max(durations)

    def norm_price(p: float) -> float:
        if max_p == min_p:
            return 0.0
        return (p - min_p) / (max_p - min_p)

    def norm_duration(d: int) -> float:
        if max_d == min_d:
            return 0.0
        return (d - min_d) / (max_d - min_d)

    cheapest = min(journeys, key=lambda j: j.price)
    fastest = min(journeys, key=lambda j: j.total_duration_minutes or j.duration_minutes)

    cheapest_dur = cheapest.total_duration_minutes or cheapest.duration_minutes
    fastest_dur = fastest.total_duration_minutes or fastest.duration_minutes

    scored: list[tuple[float, FlightJourney]] = []
    for j in journeys:
        j_dur = j.total_duration_minutes or j.duration_minutes
        long_layover_penalty = 0.0
        overnight_penalty = 0.0
        airport_change_penalty = 0.0
        has_overnight = False
        for sl in j.slices:
            for conn in sl.connections:
                if conn.layover_minutes is not None and conn.layover_minutes > 240:
                    long_layover_penalty += 0.08
                if conn.overnight:
                    overnight_penalty += 0.06
                    has_overnight = True
                if conn.airport_change:
                    airport_change_penalty += 0.12

        separate_ticket_penalty = 0.10 if j.ticket_type == "separate_tickets" else 0.0
        self_transfer_penalty = 0.12 if j.baggage_transfer == "self_transfer" else 0.0
        unknown_protection_penalty = (
            0.04 if j.connection_protection == "unknown" and j.stops > 0 else 0.0
        )
        unprotected_penalty = 0.10 if j.connection_protection == "unprotected" else 0.0

        baggage_bonus = 0.0
        if j.carry_on_included is True:
            baggage_bonus -= 0.03
        if j.checked_bag_included is True:
            baggage_bonus -= 0.05

        flex_bonus = 0.0
        if j.changeable is True:
            flex_bonus -= 0.04
        if j.refundable is True:
            flex_bonus -= 0.04

        score = (
            norm_price(j.price) * 0.42
            + norm_duration(j_dur) * 0.28
            + j.stops * 0.06
            + long_layover_penalty
            + overnight_penalty
            + airport_change_penalty
            + separate_ticket_penalty
            + self_transfer_penalty
            + unknown_protection_penalty
            + unprotected_penalty
            + baggage_bonus
            + flex_bonus
        )

        price_delta = j.price - cheapest.price
        longest_layover = _longest_layover_minutes(j)

        reason_parts: list[str] = []
        is_lowest_price = (j.id == cheapest.id or abs(j.price - cheapest.price) < 0.01)

        if is_lowest_price:
            reason_parts.append("Lowest price")
            if j.stops == 0:
                reason_parts.append("nonstop")
            elif j.stops == 1:
                reason_parts.append("with one overnight connection" if has_overnight else "with one connection")
            else:
                stops_word = "two" if j.stops == 2 else f"{j.stops}"
                reason_parts.append(f"with {stops_word} connections")
            if j_dur > 0:
                reason_parts.append(f"{_format_minutes_delta(j_dur)} total journey")
        else:
            if j_dur < cheapest_dur:
                faster_by = cheapest_dur - j_dur
                reason_parts.append(f"{_format_minutes_delta(faster_by)} faster than the cheapest option")
            else:
                reason_parts.append(f"${price_delta:.0f} more")

            if j.stops == 0:
                reason_parts.append("nonstop")
            elif j.stops == 1:
                reason_parts.append("with one overnight connection" if has_overnight else "with one connection")
            else:
                stops_word = "two" if j.stops == 2 else f"{j.stops}"
                reason_parts.append(f"with {stops_word} connections")

            if j_dur > 0 and (j.id == fastest.id or j_dur <= fastest_dur):
                reason_parts.append(f"and a {_format_minutes_delta(j_dur)} total journey")
            elif j_dur > 0:
                reason_parts.append(f"and a {_format_minutes_delta(j_dur)} total journey")

        if longest_layover >= 180 and not has_overnight:
            reason_parts.append(f"and a {_format_minutes_delta(longest_layover)} longest layover")

        if j.ticket_type == "separate_tickets" or j.baggage_transfer == "self_transfer":
            hub = next(
                (conn.airport_name or conn.airport for sl in j.slices for conn in sl.connections),
                "connection point",
            )
            if j.ticket_type == "separate_tickets" and j.baggage_transfer == "self_transfer":
                reason_parts.append(f"Separate tickets and self-transfer required in {hub}")
            elif j.ticket_type == "separate_tickets":
                reason_parts.append(f"Separate tickets in {hub}")
            else:
                reason_parts.append(f"Self-transfer required in {hub}")

        if is_lowest_price and j.stops == 0:
            final_reason = "; ".join(reason_parts) + "."
        else:
            final_reason = ", ".join(reason_parts) + "."

        updated = j.model_copy(
            update={
                "recommendation_score": round(score, 4),
                "recommendation_reason": final_reason,
            }
        )
        scored.append((score, updated))

    scored.sort(key=lambda item: item[0])
    return [item[1] for item in scored]


class FlightJourneyService:
    @staticmethod
    def search_duffel(body: FlightSearchRequest) -> FlightJourneySearchResponse:
        """Execute Duffel-only search (used by the Duffel provider adapter)."""
        if not _duffel_configured():
            AppException.service_unavailable("Flight search is not configured")

        if not _production_safe_mode():
            AppException.service_unavailable(
                "Estimated flight results are disabled in production",
            )

        key = _build_cache_key(body)
        now = time.time()
        cached = _journey_cache.get(key)
        if cached is not None:
            expires_at, rows = cached
            if now < expires_at:
                return FlightJourneySearchResponse(
                    journeys=list(rows),
                    provider="duffel",
                    live_mode=rows[0].live_mode if rows else None,
                    environment="live" if rows and rows[0].live_mode else ("test" if rows else None),
                )

        checked_at = _utc_now_iso()
        try:
            journeys, search_metadata = execute_adaptive_duffel_search(
                body,
                create_offer_request=create_offer_request,
                build_duffel_slices=_build_duffel_slices,
                build_duffel_passengers=_build_duffel_passengers,
                cabin_to_duffel=CABIN_TO_DUFFEL,
                apply_post_time_filters=_apply_post_time_filters,
                rank_journeys=_rank_journeys,
                checked_at=checked_at,
            )
        except ValueError as exc:
            logger.warning("Duffel configuration error: %s", exc)
            AppException.service_unavailable("Flight search is not configured")
        except Exception as exc:
            logger.warning("Duffel search failed: %s", exc)
            AppException.service_unavailable("Flight search is temporarily unavailable")

        ttl = CACHE_TTL_SECONDS if journeys else _EMPTY_FAILURE_TTL_SECONDS
        _journey_cache[key] = (now + ttl, journeys)

        live_mode = journeys[0].live_mode if journeys else None
        environment = "live" if live_mode is True else ("test" if live_mode is False else None)
        message = None if journeys else "No matching live offers for this search"
        return FlightJourneySearchResponse(
            journeys=journeys,
            provider="duffel",
            live_mode=live_mode,
            environment=environment,
            message=message,
            searched_at=checked_at,
            search_metadata=search_metadata,
        )

    @staticmethod
    def search(body: FlightSearchRequest) -> FlightJourneySearchResponse:
        from app.services.flight_providers.coordinator import FlightSearchCoordinator
        from app.services.flight_providers.registry import configured_provider_ids, provider_registry_records

        response = FlightSearchCoordinator.search(body)
        if not response.journeys:
            from app.services.flight_route_recovery_service import FlightRouteRecoveryService

            response.route_recovery = FlightRouteRecoveryService.build(body)
        enabled_ids = configured_provider_ids()
        if enabled_ids and response.providers_requested == 0:
            configured = [
                record
                for record in provider_registry_records(include_disabled=False)
                if record.provider_id in enabled_ids and record.configured
            ]
            if not configured:
                AppException.service_unavailable("Flight search is not configured")
        if (
            response.providers_requested > 0
            and response.providers_succeeded == 0
            and response.provider_statuses
            and all(status.status == "unconfigured" for status in response.provider_statuses)
        ):
            AppException.service_unavailable("Flight search is not configured")
        return response

    @staticmethod
    def search_request_from_legacy_get(
        *,
        fly_from: str,
        fly_to: str,
        date_from: date,
        adults: int,
        children: int,
        infants: int,
        currency: str,
        cabins: str,
        return_from: date | None,
        maximum_connections: int = 1,
    ) -> FlightSearchRequest:
        cabin = CABIN_CODE_MAP.get(cabins.strip().upper(), "economy")
        passengers: list[FlightSearchPassengerRequest] = []
        passengers.extend(FlightSearchPassengerRequest(type="adult") for _ in range(adults))
        passengers.extend(
            FlightSearchPassengerRequest(type="child", age=10) for _ in range(children)
        )
        passengers.extend(
            FlightSearchPassengerRequest(type="infant_without_seat", age=1)
            for _ in range(infants)
        )

        origin = _normalize_fly_term(fly_from)
        dest = _normalize_fly_term(fly_to)
        slices = [
            FlightSearchSliceRequest(
                origin=origin,
                destination=dest,
                departure_date=date_from,
            )
        ]
        trip_type = "one_way"
        if return_from is not None:
            trip_type = "round_trip"
            slices.append(
                FlightSearchSliceRequest(
                    origin=dest,
                    destination=origin,
                    departure_date=return_from,
                )
            )

        return FlightSearchRequest(
            trip_type=trip_type,  # type: ignore[arg-type]
            slices=slices,
            passengers=passengers,
            cabin=cabin,  # type: ignore[arg-type]
            maximum_connections=maximum_connections,
            currency=currency,
        )

    @staticmethod
    def journeys_to_flight_results(journeys: list[FlightJourney]) -> list[FlightResult]:
        rows: list[FlightResult] = []
        for j in journeys:
            rows.append(
                FlightResult(
                    id=j.id,
                    price=j.price,
                    currency=j.currency,
                    airlines=j.airlines,
                    departure_at=j.departure_at,
                    arrival_at=j.arrival_at,
                    origin=j.origin,
                    destination=j.destination,
                    duration_minutes=j.duration_minutes,
                    deep_link=j.deep_link,
                    stops=j.stops,
                )
            )
        return rows

    @staticmethod
    def clear_cache() -> None:
        _journey_cache.clear()
