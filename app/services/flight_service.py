"""
app/services/flight_service.py — Rovvy flight meta-search (Skyscanner / Google Flights model).

Live search (when configured):
  - Kiwi Tequila: real itineraries + Kiwi deep links (KIWI_API_KEY)
  - Travelpayouts Aviasales prices API (TRAVELPAYOUTS_API_TOKEN) — optional merge

Fallback: route estimates when no live provider returns results.
"""
from __future__ import annotations

import logging
import re
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote

import httpx
from fastapi import HTTPException

from app.schemas.flight import FlightResult
from app.services.duffel_client import create_offer_request
from app.services.flight_meta_providers import (
    merge_flight_results,
    search_kiwi,
    search_travelpayouts_prices,
)
from app.utils.exceptions import AppException
from config import settings

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 1_800  # 30 minutes

_flight_cache: dict[
    tuple[str, str, str, str, int, int, int, str, str, str, int],
    tuple[float, list[FlightResult]],
] = {}

_FLY_LOCATION_ALIASES: dict[str, str] = {
    "CHICAGO": "CHI",
    "NEWYORK": "NYC",
    "NEWYORKCITY": "NYC",
    "SANFRANCISCO": "SFO",
    "MIAMI": "MIA",
    "LONDON": "LON",
    "PARIS": "PAR",
    "HYDERABAD": "HYD",
    "GUNTUR": "VGA",
    "VIJAYAWADA": "VGA",
    "DELHI": "DEL",
    "NEWDELHI": "DEL",
    "MUMBAI": "BOM",
    "BENGALURU": "BLR",
    "BANGALORE": "BLR",
    "CHENNAI": "MAA",
    "KOLKATA": "CCU",
    "DUBAI": "DXB",
    "SINGAPORE": "SIN",
    "ATLANTA": "ATL",
    "BOSTON": "BOS",
    "SEATTLE": "SEA",
    "LOSANGELES": "LAX",
}

_ROUTE_TEMPLATES: dict[tuple[str, str], list[dict[str, Any]]] = {
    ("CHI", "HYD"): [
        {"price": 899.0, "duration": 1080, "stops": 1, "airlines": ["Typical 1-stop via Middle East / Europe"]},
        {"price": 1049.0, "duration": 960, "stops": 0, "airlines": ["Non-stop when available"]},
    ],
    ("CHI", "DEL"): [
        {"price": 849.0, "duration": 960, "stops": 1, "airlines": ["Typical 1-stop via Europe / Middle East"]},
    ],
    ("NYC", "LON"): [
        {"price": 520.0, "duration": 420, "stops": 0, "airlines": ["Transatlantic non-stop"]},
        {"price": 399.0, "duration": 540, "stops": 1, "airlines": ["1-stop option"]},
    ],
    ("CHI", "LON"): [
        {"price": 580.0, "duration": 480, "stops": 0, "airlines": ["Transatlantic"]},
    ],
    ("LAX", "SEA"): [
        {"price": 89.0, "duration": 165, "stops": 0, "airlines": ["West coast shuttle"]},
    ],
}


def _normalize_fly_term(term: str) -> str:
    raw = term.strip()
    if not raw:
        return raw
    letters = "".join(c for c in raw.upper() if c.isalpha())
    if len(letters) >= 3:
        hit = _FLY_LOCATION_ALIASES.get(letters)
        if hit:
            return hit
    return raw.upper()


def _cache_key(
    fly_from: str,
    fly_to: str,
    outbound_start: date,
    outbound_end: date,
    adults: int,
    children: int,
    infants: int,
    currency: str,
    cabin_token: str,
    return_from: date | None,
    return_to: date | None,
    maximum_connections: int = 1,
) -> tuple[str, str, str, str, int, int, int, str, str, str, int]:
    ret_leg = ""
    if return_from is not None and return_to is not None:
        ret_leg = f"{return_from.isoformat()}_{return_to.isoformat()}"
    return (
        fly_from.strip().upper(),
        fly_to.strip().upper(),
        outbound_start.isoformat(),
        outbound_end.isoformat(),
        adults,
        children,
        infants,
        currency.strip().upper(),
        cabin_token.strip().upper(),
        ret_leg,
        maximum_connections,
    )


def _parse_iso_duration_to_minutes(duration_str: str | None) -> int:
    if not duration_str:
        return 0
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?", duration_str)
    if not match:
        return 0
    hours = int(match.group(1)) if match.group(1) else 0
    minutes = int(match.group(2)) if match.group(2) else 0
    return hours * 60 + minutes


def _skyscanner_booking_link(origin: str, destination: str, depart: date) -> str:
    return (
        f"https://www.skyscanner.net/transport/flights/"
        f"{origin.lower()}/{destination.lower()}/{depart.isoformat()}/"
    )


def _aviasales_affiliate_link(origin: str, destination: str, depart: date) -> str:
    marker = (settings.travelpayouts_marker or "").strip() or "727732"
    # Aviasales search deep link — no API, affiliate via tp.media
    inner = (
        f"https://www.aviasales.com/search/"
        f"{origin}{depart.strftime('%d%m')}{destination}1"
    )
    return f"https://tp.media/r?marker={marker}&p=4114&u={quote(inner, safe='')}"


def _discovery_flight_results(
    fly_from: str,
    fly_to: str,
    date_from: date,
    currency: str,
) -> list[FlightResult]:
    """Rovvy-owned discovery — estimates + partner booking links, no flight API."""
    pair = (fly_from.upper(), fly_to.upper())
    templates = _ROUTE_TEMPLATES.get(pair)
    if not templates:
        templates = [
            {
                "price": 750.0,
                "duration": 900,
                "stops": 1,
                "airlines": ["Typical connecting route"],
            }
        ]

    depart = datetime(date_from.year, date_from.month, date_from.day, 8, 0, tzinfo=timezone.utc)
    skyscanner = _skyscanner_booking_link(fly_from, fly_to, date_from)
    aviasales = _aviasales_affiliate_link(fly_from, fly_to, date_from)

    rows: list[FlightResult] = []
    for idx, tpl in enumerate(templates, start=1):
        duration = int(tpl["duration"])
        arrive = depart + timedelta(minutes=duration)
        rows.append(
            FlightResult(
                id=f"rovvy-route-{fly_from}-{fly_to}-{idx}",
                price=float(tpl["price"]),
                currency=currency,
                airlines=list(tpl.get("airlines") or ["Route estimate"]),
                departure_at=depart.isoformat().replace("+00:00", "Z"),
                arrival_at=arrive.isoformat().replace("+00:00", "Z"),
                origin=fly_from,
                destination=fly_to,
                duration_minutes=duration,
                deep_link=skyscanner,
                stops=int(tpl.get("stops") or 0),
            )
        )

    min_price = min(float(t["price"]) for t in templates)
    rows.append(
        FlightResult(
            id=f"rovvy-partner-skyscanner-{fly_from}-{fly_to}",
            price=min_price,
            currency=currency,
            airlines=["Book live prices on Skyscanner"],
            departure_at=depart.isoformat().replace("+00:00", "Z"),
            arrival_at=(depart + timedelta(minutes=int(templates[0]["duration"])))
            .isoformat()
            .replace("+00:00", "Z"),
            origin=fly_from,
            destination=fly_to,
            duration_minutes=int(templates[0]["duration"]),
            deep_link=skyscanner,
            stops=int(templates[0].get("stops") or 0),
        )
    )
    rows.append(
        FlightResult(
            id=f"rovvy-partner-aviasales-{fly_from}-{fly_to}",
            price=min_price,
            currency=currency,
            airlines=["Search on Aviasales (Travelpayouts)"],
            departure_at=depart.isoformat().replace("+00:00", "Z"),
            arrival_at=(depart + timedelta(minutes=int(templates[0]["duration"])))
            .isoformat()
            .replace("+00:00", "Z"),
            origin=fly_from,
            destination=fly_to,
            duration_minutes=int(templates[0]["duration"]),
            deep_link=aviasales,
            stops=int(templates[0].get("stops") or 0),
        )
    )
    return rows


def _live_provider_mode() -> str:
    explicit = (settings.flight_live_provider or "duffel").strip().lower()
    if explicit and explicit not in {"auto", ""}:
        return explicit
    if (settings.duffel_api_key or "").strip():
        return "duffel"
    return "discovery"


def _discovery_allowed() -> bool:
    return bool(getattr(settings, "allow_estimated_flights", False))


def _duffel_offer_booking_url(offer_id: str) -> str:
    return f"https://app.duffel.com/search/offers/{offer_id}"


def _live_provider_enabled() -> bool:
    return bool((settings.duffel_api_key or "").strip())


def _search_live_meta(
    fly_from: str,
    fly_to: str,
    date_from: date,
    date_to: date,
    adults: int,
    currency: str,
    return_from: date | None,
    return_to: date | None,
) -> list[FlightResult]:
    mode = _live_provider_mode()
    kiwi_rows: list[FlightResult] = []
    tp_rows: list[FlightResult] = []

    if mode in {"kiwi", "meta", "auto"} and (settings.kiwi_api_key or "").strip():
        kiwi_rows = search_kiwi(
            fly_from=fly_from,
            fly_to=fly_to,
            date_from=date_from,
            date_to=date_to,
            adults=adults,
            currency=currency,
            return_from=return_from,
            return_to=return_to,
        )

    if mode in {"meta", "travelpayouts"} and (settings.travelpayouts_api_token or "").strip():
        tp_rows = search_travelpayouts_prices(
            fly_from=fly_from,
            fly_to=fly_to,
            date_from=date_from,
            currency=currency,
        )

    if kiwi_rows or tp_rows:
        return merge_flight_results(kiwi_rows, tp_rows)

    if mode == "kiwi" and not (settings.kiwi_api_key or "").strip():
        logger.warning("FLIGHT_LIVE_PROVIDER=kiwi but KIWI_API_KEY is missing")
    return []


def _dedupe_flight_rows(rows: list[FlightResult], limit: int = 12) -> list[FlightResult]:
    """Collapse near-duplicate offers (same route, times, price)."""
    seen: set[tuple[str, ...]] = set()
    unique: list[FlightResult] = []
    for row in rows:
        key = (
            row.origin.upper(),
            row.destination.upper(),
            row.departure_at[:16],
            row.arrival_at[:16],
            str(row.stops),
            str(int(row.price)),
            ",".join(row.airlines),
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)
        if len(unique) >= limit:
            break
    return unique


def _parse_duffel_offer(offer: dict[str, Any], currency_preference: str) -> FlightResult | None:
    try:
        rid = offer.get("id")
        price_str = offer.get("total_amount")
        if not rid or not price_str:
            return None
        price_f = float(price_str)
        currency = offer.get("total_currency") or currency_preference

        slices = offer.get("slices") or []
        if not slices:
            return None

        airlines: list[str] = []
        for sl in slices:
            if not isinstance(sl, dict):
                continue
            for seg in sl.get("segments") or []:
                if not isinstance(seg, dict):
                    continue
                carrier = seg.get("marketing_carrier") or {}
                code = str(carrier.get("iata_code") or "").strip().upper()
                if code and code not in airlines:
                    airlines.append(code)

        first_slice = slices[0] if isinstance(slices[0], dict) else {}
        segments = first_slice.get("segments") or []
        first_seg = segments[0] if segments else {}
        if not first_seg:
            return None
        departure_at = str(first_seg.get("departing_at") or "")

        last_seg_outbound = segments[-1] if segments else first_seg
        arrival_at = str(last_seg_outbound.get("arriving_at") or "")

        origin_obj = first_slice.get("origin") or {}
        dest_obj = first_slice.get("destination") or {}
        origin = str(origin_obj.get("iata_code") or "")
        destination = str(dest_obj.get("iata_code") or "")

        duration_minutes = _parse_iso_duration_to_minutes(str(first_slice.get("duration") or ""))
        stops = max(0, len(segments) - 1)

        return FlightResult(
            id=str(rid),
            price=price_f,
            currency=currency.strip().upper(),
            airlines=airlines,
            departure_at=departure_at,
            arrival_at=arrival_at,
            origin=origin,
            destination=destination,
            duration_minutes=duration_minutes,
            deep_link="",
            stops=stops,
        )
    except Exception as exc:
        logger.warning("Error parsing Duffel offer: %s", exc)
        return None


def _search_duffel(
    fly_from: str,
    fly_to: str,
    date_from: date,
    adults: int,
    currency: str,
    cabins: str,
    return_from: date | None,
    children: int = 0,
    infants: int = 0,
) -> list[FlightResult]:
    slices: list[dict[str, str]] = [
        {
            "origin": fly_from,
            "destination": fly_to,
            "departure_date": date_from.isoformat(),
        }
    ]
    if return_from is not None:
        slices.append(
            {
                "origin": fly_to,
                "destination": fly_from,
                "departure_date": return_from.isoformat(),
            }
        )

    passengers: list[dict[str, str]] = [{"type": "adult"} for _ in range(adults)]
    passengers.extend({"type": "child"} for _ in range(children))
    passengers.extend({"type": "infant_without_seat"} for _ in range(infants))
    cabin_map = {"M": "economy", "W": "premium_economy", "C": "business", "F": "first"}
    duffel_cabin = cabin_map.get(cabins, "economy")

    data = create_offer_request(
        slices=slices,
        passengers=passengers,
        cabin_class=duffel_cabin,
    )

    offers = data.get("offers") or []
    out: list[FlightResult] = []
    for offer in offers:
        if not isinstance(offer, dict):
            continue
        parsed = _parse_duffel_offer(offer, currency)
        if parsed:
            out.append(parsed)
    out.sort(key=lambda row: row.price)
    return _dedupe_flight_rows(out, limit=12)


class FlightService:
    @staticmethod
    def search_flights(
        fly_from: str,
        fly_to: str,
        date_from: date,
        date_to: date,
        adults: int = 1,
        children: int = 0,
        infants: int = 0,
        currency: str = "USD",
        cabins: str = "M",
        return_from: date | None = None,
        return_to: date | None = None,
    ) -> list[FlightResult]:
        """
        Live flight search via Duffel (default when DUFFEL_API_KEY is set).
        Optional: Kiwi / Travelpayouts when FLIGHT_LIVE_PROVIDER=kiwi|meta.
        Discovery estimates only when FLIGHT_LIVE_PROVIDER=discovery explicitly.
        """
        raw_from = fly_from.strip()
        raw_to = fly_to.strip()
        a = _normalize_fly_term(raw_from)
        b = _normalize_fly_term(raw_to)

        if not a:
            AppException.bad_request("Origin is required")
        if not b or b == "__ANYWHERE__" or b == "ANYWHERE":
            AppException.bad_request("A specific destination airport or city code is required")

        if adults < 1 or adults > 9:
            AppException.bad_request("Adults must be between 1 and 9")
        if children < 0 or children > 8:
            AppException.bad_request("Children must be between 0 and 8")
        if infants < 0 or infants > 4:
            AppException.bad_request("Infants must be between 0 and 4")
        if adults + children + infants > 9:
            AppException.bad_request("Maximum 9 travelers per search")

        if date_from > date_to:
            AppException.bad_request("Invalid outbound date range")

        if return_from is not None and return_to is not None and return_from > return_to:
            AppException.bad_request("Invalid return date range")

        cabin_token = (cabins or "M").strip().upper()
        if cabin_token not in {"M", "W", "C", "F"}:
            cabin_token = "M"

        curr = (currency or "USD").strip().upper()

        key = _cache_key(
            a,
            b,
            date_from,
            date_to,
            adults,
            children,
            infants,
            curr,
            cabin_token,
            return_from,
            return_to,
        )
        now = time.time()
        cached = _flight_cache.get(key)
        if cached is not None:
            expires_at, rows = cached
            if now < expires_at:
                return list(rows)

        mode = _live_provider_mode()
        live_rows: list[FlightResult] = []

        if mode == "duffel":
            if not _live_provider_enabled():
                AppException.service_unavailable("Flight search is not configured")
            try:
                from app.services.flight_journey_service import FlightJourneyService

                req = FlightJourneyService.search_request_from_legacy_get(
                    fly_from=a,
                    fly_to=b,
                    date_from=date_from,
                    adults=adults,
                    children=children,
                    infants=infants,
                    currency=curr,
                    cabins=cabin_token,
                    return_from=return_from,
                )
                response = FlightJourneyService.search(req)
                live_rows = FlightJourneyService.journeys_to_flight_results(response.journeys)
            except HTTPException:
                raise
            except Exception as exc:
                _flight_cache[key] = (now + CACHE_TTL_SECONDS, [])
                return []
        elif mode not in {"discovery"}:
            logger.info("Flight live provider: %s", mode)
            live_rows = _search_live_meta(
                fly_from=a,
                fly_to=b,
                date_from=date_from,
                date_to=date_to,
                adults=adults,
                currency=curr,
                return_from=return_from,
                return_to=return_to,
            )

        if live_rows:
            _flight_cache[key] = (now + CACHE_TTL_SECONDS, live_rows)
            return live_rows

        if mode != "discovery" or not _discovery_allowed():
            logger.warning("Live provider %s returned no offers (no mock fallback)", mode)
            _flight_cache[key] = (now + CACHE_TTL_SECONDS, [])
            return []

        results = _discovery_flight_results(a, b, date_from, curr)
        _flight_cache[key] = (now + CACHE_TTL_SECONDS, results)
        return results
