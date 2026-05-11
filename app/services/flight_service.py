"""
app/services/flight_service.py — Kiwi.com Tequila flight search

TTL in-memory cache (30 min); key includes outbound window, cabin, currency, pax, return leg.
"""
from __future__ import annotations

import logging
import time
from datetime import date
from typing import Any

import httpx

from app.schemas.flight import FlightResult
from app.utils.exceptions import AppException
from config import settings

logger = logging.getLogger(__name__)

KIWI_SEARCH_URL = "https://api.tequila.kiwi.com/v2/search"
CACHE_TTL_SECONDS = 1_800  # 30 minutes

_flight_cache: dict[
    tuple[str, str, str, str, int, str, str, str],
    tuple[float, list[FlightResult]],
] = {}


def _to_kiwi_ddmmyyyy(d: date) -> str:
    return d.strftime("%d/%m/%Y")


# Common free-text → Tequila-friendly location ids (metro / multi-airport codes)
_FLY_LOCATION_ALIASES: dict[str, str] = {
    "CHICAGO": "CHI",
    "NEWYORK": "NYC",
    "NEWYORKCITY": "NYC",
    "SANFRANCISCO": "SFO",
    "MIAMI": "MIA",
    "LONDON": "LON",
    "PARIS": "PAR",
}


def _normalize_fly_term(term: str) -> str:
    """Maps common city names to Kiwi codes; otherwise uppercases trimmed input."""
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
    currency: str,
    cabin_token: str,
    return_from: date | None,
    return_to: date | None,
) -> tuple[str, str, str, str, int, str, str, str]:
    ret_leg = ""
    if return_from is not None and return_to is not None:
        ret_leg = f"{return_from.isoformat()}_{return_to.isoformat()}"
    return (
        fly_from.strip().upper(),
        fly_to.strip().upper(),
        outbound_start.isoformat(),
        outbound_end.isoformat(),
        adults,
        currency.strip().upper(),
        cabin_token.strip().upper(),
        ret_leg,
    )


def _parse_flight_item(raw: dict[str, Any], currency_preference: str) -> FlightResult | None:
    rid = raw.get("id")
    if rid is None:
        return None
    price = raw.get("price")
    if price is None:
        conv = raw.get("conversion")
        if isinstance(conv, dict):
            pref = currency_preference.strip().upper()
            if pref and pref in conv:
                price = conv.get(pref)
            if price is None and conv:
                for v in conv.values():
                    if isinstance(v, (int, float)):
                        price = v
                        break

    if price is None:
        return None
    try:
        price_f = float(price)
    except (TypeError, ValueError):
        return None

    currency = raw.get("currency")
    if not isinstance(currency, str) or not currency.strip():
        currency = currency_preference if currency_preference else "USD"

    airlines_raw = raw.get("airlines")
    airlines: list[str] = []
    if isinstance(airlines_raw, list):
        airlines = [str(a) for a in airlines_raw if a is not None]

    route = raw.get("route") or []
    origin = str(raw.get("flyFrom") or "")
    destination = str(raw.get("flyTo") or "")
    dep_iso = raw.get("local_departure")
    arr_iso = raw.get("local_arrival")

    if isinstance(route, list) and route:
        first = route[0] if isinstance(route[0], dict) else {}
        last = route[-1] if isinstance(route[-1], dict) else {}
        origin = str(first.get("flyFrom") or origin)
        destination = str(last.get("flyTo") or destination)
        dep_iso = first.get("local_departure") or dep_iso
        arr_iso = last.get("local_arrival") or arr_iso

    departure_at = str(dep_iso or "")
    arrival_at = str(arr_iso or "")

    stops = 0
    if isinstance(route, list) and route:
        stops = max(0, len(route) - 1)

    duration_minutes = 0
    dur = raw.get("duration")
    if isinstance(dur, dict):
        total = dur.get("total")
        if total is not None:
            try:
                duration_minutes = max(0, int(round(float(total) / 60.0)))
            except (TypeError, ValueError):
                duration_minutes = 0
    elif isinstance(dur, (int, float)):
        try:
            duration_minutes = max(0, int(round(float(dur) / 60.0)))
        except (TypeError, ValueError):
            duration_minutes = 0

    deep_link = raw.get("deep_link")
    if not isinstance(deep_link, str):
        deep_link = ""

    return FlightResult(
        id=str(rid),
        price=price_f,
        currency=currency.strip().upper(),
        airlines=airlines,
        departure_at=departure_at,
        arrival_at=arrival_at,
        origin=origin.strip(),
        destination=destination.strip(),
        duration_minutes=duration_minutes,
        deep_link=deep_link.strip(),
        stops=stops,
    )


class FlightService:
    @staticmethod
    def search_flights(
        fly_from: str,
        fly_to: str,
        date_from: date,
        date_to: date,
        adults: int = 1,
        currency: str = "USD",
        cabins: str = "M",
        return_from: date | None = None,
        return_to: date | None = None,
    ) -> list[FlightResult]:
        """
        Query Kiwi search; results cached for CACHE_TTL_SECONDS seconds.

        Cache dimensions include origin/destination, outbound date range, passengers,
        cabin class, currency, and return leg when present (Tequila API parameters).
        """
        a = _normalize_fly_term(fly_from)
        b = _normalize_fly_term(fly_to)
        if not a or not b:
            AppException.bad_request("Origin and destination are required")

        if adults < 1 or adults > 9:
            AppException.bad_request("Adults must be between 1 and 9")

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

        api_key = (settings.kiwi_api_key or "").strip()
        if not api_key:
            AppException.service_unavailable("Flight search is not configured")

        params: dict[str, str | int] = {
            "fly_from": a,
            "fly_to": b,
            "date_from": _to_kiwi_ddmmyyyy(date_from),
            "date_to": _to_kiwi_ddmmyyyy(date_to),
            "adults": adults,
            "curr": curr,
            "locale": "en",
            "sort": "price",
            "limit": 250,
            "selected_cabins": cabin_token,
            "partner_market": "us",
        }
        if return_from is not None and return_to is not None:
            params["return_from"] = _to_kiwi_ddmmyyyy(return_from)
            params["return_to"] = _to_kiwi_ddmmyyyy(return_to)

        headers = {"apikey": api_key, "Accept": "application/json"}

        timeout = httpx.Timeout(25.0)
        resp: httpx.Response | None = None
        try:
            with httpx.Client(timeout=timeout) as client:
                resp = client.get(KIWI_SEARCH_URL, params=params, headers=headers)
        except httpx.HTTPError as exc:
            logger.warning("Kiwi HTTP error: %s", exc)
            AppException.bad_gateway("Flight search temporarily unavailable")

        if resp is None:
            AppException.bad_gateway("Flight search temporarily unavailable")

        if resp.status_code == 401 or resp.status_code == 403:
            AppException.service_unavailable("Flight search authorization failed")

        if resp.status_code != 200:
            logger.warning("Kiwi non-200: %s %s", resp.status_code, resp.text[:500])
            AppException.bad_gateway("Flight provider returned an error")

        parsed: dict[str, Any] | None = None
        try:
            body = resp.json()
            if isinstance(body, dict):
                parsed = body
        except ValueError:
            parsed = None

        if parsed is None:
            AppException.bad_gateway("Invalid flight search response")

        data = parsed.get("data")
        if not isinstance(data, list):
            results: list[FlightResult] = []
            _flight_cache[key] = (now + CACHE_TTL_SECONDS, results)
            return list(results)

        out: list[FlightResult] = []
        for item in data:
            if not isinstance(item, dict):
                continue
            row = _parse_flight_item(item, curr)
            if row is not None:
                out.append(row)

        _flight_cache[key] = (now + CACHE_TTL_SECONDS, list(out))
        return list(out)
