"""Production-safe Duffel-only flight journey search."""

from __future__ import annotations

import logging
import time
from datetime import date, datetime, timezone
from typing import Any

import httpx

from app.schemas.flight import FlightResult
from app.schemas.flight_journey import (
    FlightJourney,
    FlightJourneySearchResponse,
    FlightSearchPassengerRequest,
    FlightSearchRequest,
    FlightSearchSliceRequest,
)
from app.services.duffel_client import create_offer_request
from app.services.flight_journey_parser import (
    parse_duffel_journey,
    slice_matches_time_window,
)
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


def _dedupe_journeys(rows: list[FlightJourney], limit: int = 24) -> list[FlightJourney]:
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


def _rank_journeys(journeys: list[FlightJourney]) -> list[FlightJourney]:
    if len(journeys) <= 1:
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

    scored: list[tuple[float, FlightJourney]] = []
    for j in journeys:
        long_layover_penalty = 0.0
        overnight_penalty = 0.0
        airport_change_penalty = 0.0
        for sl in j.slices:
            for conn in sl.connections:
                if conn.layover_minutes is not None and conn.layover_minutes > 240:
                    long_layover_penalty += 0.08
                if conn.overnight:
                    overnight_penalty += 0.06
                if conn.airport_change:
                    airport_change_penalty += 0.12

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
            + norm_duration(j.total_duration_minutes or j.duration_minutes) * 0.28
            + j.stops * 0.06
            + long_layover_penalty
            + overnight_penalty
            + airport_change_penalty
            + baggage_bonus
            + flex_bonus
        )

        price_delta = j.price - cheapest.price
        duration_delta = (j.total_duration_minutes or j.duration_minutes) - (
            fastest.total_duration_minutes or fastest.duration_minutes
        )
        reason_parts: list[str] = []
        if j.id == cheapest.id:
            reason_parts.append("Lowest live fare in this result set")
        else:
            reason_parts.append(f"${price_delta:.0f} more than the cheapest option")
        if duration_delta < 0:
            hours = abs(duration_delta) // 60
            mins = abs(duration_delta) % 60
            reason_parts.append(f"but {hours}h {mins}m faster")
        elif duration_delta > 0 and j.id != fastest.id:
            hours = duration_delta // 60
            mins = duration_delta % 60
            reason_parts.append(f"and {hours}h {mins}m longer")
        if j.stops == 0:
            reason_parts.append("with a nonstop protected itinerary")
        elif j.stops == 1:
            reason_parts.append("with one protected connection")
        else:
            reason_parts.append(f"with {j.stops} protected connections")

        updated = j.model_copy(
            update={
                "recommendation_score": round(score, 4),
                "recommendation_reason": ", ".join(reason_parts) + ".",
            }
        )
        scored.append((score, updated))

    scored.sort(key=lambda item: item[0])
    return [item[1] for item in scored]


class FlightJourneyService:
    @staticmethod
    def search(body: FlightSearchRequest) -> FlightJourneySearchResponse:
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
                )

        checked_at = _utc_now_iso()
        try:
            data = create_offer_request(
                slices=_build_duffel_slices(body),
                passengers=_build_duffel_passengers(body.passengers),
                cabin_class=CABIN_TO_DUFFEL.get(body.cabin, "economy"),
                max_connections=body.maximum_connections,
            )
        except httpx.TimeoutException as exc:
            logger.warning("Duffel search timeout: %s", exc)
            AppException.service_unavailable("Flight search is temporarily unavailable")
        except httpx.HTTPStatusError as exc:
            logger.warning("Duffel search HTTP error: %s", exc)
            AppException.service_unavailable("Flight search is temporarily unavailable")
        except ValueError as exc:
            logger.warning("Duffel configuration error: %s", exc)
            AppException.service_unavailable("Flight search is not configured")
        except Exception as exc:
            logger.warning("Duffel search failed: %s", exc)
            AppException.service_unavailable("Flight search is temporarily unavailable")

        offers = data.get("offers") or []
        journeys: list[FlightJourney] = []
        for offer in offers:
            if not isinstance(offer, dict):
                continue
            parsed = parse_duffel_journey(
                offer,
                currency_preference=body.currency,
                checked_at=checked_at,
                maximum_connections=body.maximum_connections,
            )
            if parsed and _apply_post_time_filters(parsed, body):
                journeys.append(parsed)

        journeys.sort(key=lambda j: j.price)
        journeys = _dedupe_journeys(journeys)
        journeys = _rank_journeys(journeys)

        ttl = CACHE_TTL_SECONDS if journeys else _EMPTY_FAILURE_TTL_SECONDS
        _journey_cache[key] = (now + ttl, journeys)

        live_mode = journeys[0].live_mode if journeys else None
        message = None if journeys else "No matching live offers for this search"
        return FlightJourneySearchResponse(
            journeys=journeys,
            provider="duffel",
            live_mode=live_mode,
            message=message,
        )

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
