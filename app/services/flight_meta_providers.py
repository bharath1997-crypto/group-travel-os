"""
Live flight meta-search providers (Skyscanner / Google Flights model).

Rovvy queries partner APIs, normalizes offers, returns sorted bookable rows with deep links.
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any
from urllib.parse import quote

import httpx

from app.schemas.flight import FlightResult
from config import settings

logger = logging.getLogger(__name__)

KIWI_SEARCH_URL = "https://tequila-api.kiwi.com/v2/search"
TRAVELPAYOUTS_PRICES_URL = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates"


def _kiwi_date(d: date) -> str:
    return d.strftime("%d/%m/%Y")


def _aviasales_booking_link(link_path: str) -> str:
    path = (link_path or "").strip()
    if not path:
        return ""
    if path.startswith("http"):
        target = path
    else:
        target = f"https://www.aviasales.com{path if path.startswith('/') else '/' + path}"
    marker = (settings.travelpayouts_marker or "").strip() or "727732"
    return f"https://tp.media/r?marker={marker}&p=4114&u={quote(target, safe='')}"


def _parse_kiwi_offer(item: dict[str, Any], currency: str) -> FlightResult | None:
    try:
        fid = str(item.get("id") or "")
        price = item.get("price")
        if not fid or price is None:
            return None

        route = item.get("route") or []
        if not isinstance(route, list) or not route:
            return None

        first = route[0] if isinstance(route[0], dict) else {}
        last = route[-1] if isinstance(route[-1], dict) else first

        dep = str(first.get("local_departure") or first.get("utc_departure") or "")
        arr = str(last.get("local_arrival") or last.get("utc_arrival") or "")

        airlines_raw = item.get("airlines") or []
        airlines: list[str] = []
        if isinstance(airlines_raw, list):
            for code in airlines_raw:
                s = str(code or "").strip().upper()
                if s and s not in airlines:
                    airlines.append(s)

        duration_block = item.get("duration")
        duration_seconds = 0
        if isinstance(duration_block, dict):
            duration_seconds = int(duration_block.get("total") or 0)
        duration_minutes = max(0, duration_seconds // 60)

        stops = max(0, len(route) - 1)
        deep_link = str(item.get("deep_link") or "")

        return FlightResult(
            id=f"kiwi-{fid}",
            price=float(price),
            currency=str(item.get("currency") or currency).upper(),
            airlines=airlines or ["Multiple carriers"],
            departure_at=dep,
            arrival_at=arr,
            origin=str(item.get("flyFrom") or first.get("flyFrom") or ""),
            destination=str(item.get("flyTo") or last.get("flyTo") or ""),
            duration_minutes=duration_minutes,
            deep_link=deep_link,
            stops=stops,
        )
    except Exception as exc:
        logger.debug("Skip Kiwi row parse: %s", exc)
        return None


def search_kiwi(
    fly_from: str,
    fly_to: str,
    date_from: date,
    date_to: date,
    adults: int,
    currency: str,
    return_from: date | None = None,
    return_to: date | None = None,
    limit: int = 20,
) -> list[FlightResult]:
    api_key = (settings.kiwi_api_key or "").strip()
    if not api_key:
        return []

    params: dict[str, str | int] = {
        "fly_from": fly_from,
        "fly_to": fly_to,
        "date_from": _kiwi_date(date_from),
        "date_to": _kiwi_date(date_to),
        "adults": adults,
        "curr": currency.upper(),
        "sort": "price",
        "limit": limit,
        "locale": "en",
        "max_stopovers": 2,
        "partner_market": "us",
    }

    marker = (settings.travelpayouts_marker or "").strip()
    if marker:
        params["partner"] = marker

    if return_from is not None and return_to is not None:
        params["return_from"] = _kiwi_date(return_from)
        params["return_to"] = _kiwi_date(return_to)

    try:
        with httpx.Client(timeout=35.0) as client:
            r = client.get(KIWI_SEARCH_URL, params=params, headers={"apikey": api_key})
        r.raise_for_status()
        payload = r.json()
    except Exception as exc:
        logger.warning("Kiwi Tequila search failed: %s", exc)
        return []

    data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(data, list):
        return []

    out: list[FlightResult] = []
    for row in data:
        if not isinstance(row, dict):
            continue
        parsed = _parse_kiwi_offer(row, currency)
        if parsed:
            out.append(parsed)

    out.sort(key=lambda row: row.price)
    return out


def _parse_travelpayouts_row(row: dict[str, Any], currency: str) -> FlightResult | None:
    try:
        origin = str(row.get("origin") or row.get("origin_airport") or "")
        destination = str(row.get("destination") or row.get("destination_airport") or "")
        price = row.get("price")
        if not origin or not destination or price is None:
            return None

        airline = str(row.get("airline") or "").strip().upper()
        airlines = [airline] if airline else ["Multiple carriers"]

        dep = str(row.get("departure_at") or "")
        ret = str(row.get("return_at") or "")
        arrival = ret if ret else dep

        duration = int(row.get("duration") or row.get("trip_duration") or 0)
        duration_minutes = duration if duration > 300 else duration * 60 if duration else 0

        transfers = row.get("transfers")
        stops = int(transfers) if transfers is not None else int(row.get("number_of_changes") or 0)

        link = _aviasales_booking_link(str(row.get("link") or ""))
        row_id = str(row.get("flight_number") or row.get("link") or f"{origin}-{destination}-{dep}")

        return FlightResult(
            id=f"tp-{row_id}",
            price=float(price),
            currency=currency.upper(),
            airlines=airlines,
            departure_at=dep,
            arrival_at=arrival,
            origin=origin,
            destination=destination,
            duration_minutes=duration_minutes,
            deep_link=link,
            stops=max(0, stops),
        )
    except Exception as exc:
        logger.debug("Skip Travelpayouts row parse: %s", exc)
        return None


def search_travelpayouts_prices(
    fly_from: str,
    fly_to: str,
    date_from: date,
    currency: str,
    limit: int = 20,
) -> list[FlightResult]:
    token = (settings.travelpayouts_api_token or "").strip()
    if not token:
        return []

    depart_at = date_from.strftime("%Y-%m-%d")
    params = {
        "origin": fly_from,
        "destination": fly_to,
        "departure_at": depart_at,
        "unique": "false",
        "sorting": "price",
        "direct": "false",
        "cy": currency.lower(),
        "limit": limit,
        "page": 1,
        "one_way": "true",
    }

    try:
        with httpx.Client(timeout=20.0) as client:
            r = client.get(
                TRAVELPAYOUTS_PRICES_URL,
                params=params,
                headers={"X-Access-Token": token, "Accept": "application/json"},
            )
        r.raise_for_status()
        payload = r.json()
    except Exception as exc:
        logger.warning("Travelpayouts prices search failed: %s", exc)
        return []

    data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(data, list):
        return []

    out: list[FlightResult] = []
    for row in data:
        if not isinstance(row, dict):
            continue
        parsed = _parse_travelpayouts_row(row, currency)
        if parsed:
            out.append(parsed)

    out.sort(key=lambda r: r.price)
    return out


def merge_flight_results(*groups: list[FlightResult], limit: int = 30) -> list[FlightResult]:
    """Dedupe similar offers and sort by price — meta-search aggregator step."""
    merged: list[FlightResult] = []
    seen: set[tuple[str, str, str, int, int]] = set()

    for group in groups:
        for row in group:
            key = (
                row.origin.upper(),
                row.destination.upper(),
                row.departure_at[:10] if row.departure_at else "",
                int(row.price),
                row.stops,
            )
            if key in seen:
                continue
            seen.add(key)
            merged.append(row)

    merged.sort(key=lambda r: r.price)
    return merged[:limit]
