"""
app/services/flight_service.py — Flight search via Duffel API (Primary)

TTL in-memory cache (30 min); key includes outbound window, cabin, currency, pax, return leg.
"""
from __future__ import annotations

import logging
import time
import re
from datetime import date
from typing import Any

from duffel_api import Duffel

from app.schemas.flight import FlightResult
from app.utils.exceptions import AppException
from config import settings

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 1_800  # 30 minutes

_flight_cache: dict[
    tuple[str, str, str, str, int, str, str, str],
    tuple[float, list[FlightResult]],
] = {}


# Common free-text → location ids (metro / multi-airport codes)
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
    """Maps common city names to IATA codes; otherwise uppercases trimmed input."""
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


def _parse_iso_duration_to_minutes(duration_str: str | None) -> int:
    """Parses an ISO 8601 duration string (e.g. PT2H30M) into total minutes."""
    if not duration_str:
        return 0
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?", duration_str)
    if not match:
        return 0
    hours = int(match.group(1)) if match.group(1) else 0
    minutes = int(match.group(2)) if match.group(2) else 0
    return hours * 60 + minutes


def _parse_duffel_offer(offer: Any, currency_preference: str) -> FlightResult | None:
    try:
        rid = offer.id
        price_str = offer.total_amount
        if not price_str:
            return None
        price_f = float(price_str)
        currency = offer.total_currency or currency_preference

        slices = offer.slices or []
        if not slices:
            return None

        # Collect unique carrier codes
        airlines: list[str] = []
        for s in slices:
            for seg in s.segments or []:
                carrier = seg.marketing_carrier
                if carrier and carrier.iata_code:
                    if carrier.iata_code not in airlines:
                        airlines.append(carrier.iata_code)

        # First slice first segment departing_at
        first_slice = slices[0]
        first_seg = first_slice.segments[0] if first_slice.segments else None
        if not first_seg:
            return None
        departure_at = first_seg.departing_at or ""

        # Last slice last segment arriving_at
        last_slice = slices[-1]
        last_seg = last_slice.segments[-1] if last_slice.segments else None
        if not last_seg:
            return None
        arrival_at = last_seg.arriving_at or ""

        origin = first_slice.origin.iata_code if first_slice.origin else ""
        destination = last_slice.destination.iata_code if last_slice.destination else ""

        duration_minutes = sum(_parse_iso_duration_to_minutes(s.duration) for s in slices)
        stops = sum(max(0, len(s.segments or []) - 1) for s in slices)

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
    except Exception as e:
        logger.warning("Error parsing Duffel offer: %s", e)
        return None



def _search_duffel(
    fly_from: str,
    fly_to: str,
    date_from: date,
    adults: int,
    currency: str,
    cabins: str,
    return_from: date | None,
) -> list[FlightResult]:
    client = Duffel(access_token=settings.duffel_api_key)

    slices = [
        {
            "origin": fly_from,
            "destination": fly_to,
            "departure_date": date_from.isoformat()
        }
    ]
    if return_from is not None:
        slices.append({
            "origin": fly_to,
            "destination": fly_from,
            "departure_date": return_from.isoformat()
        })

    passengers = [{"type": "adult"} for _ in range(adults)]
    
    cabin_map = {
        "M": "economy",
        "W": "premium_economy",
        "C": "business",
        "F": "first",
    }
    duffel_cabin = cabin_map.get(cabins, "economy")

    req = (
        client.offer_requests.create()
        .passengers(passengers)
        .slices(slices)
        .cabin_class(duffel_cabin)
        .return_offers()
    )
    offer_request = req.execute()

    out: list[FlightResult] = []
    offers = getattr(offer_request, "offers", []) or []
    for offer in offers:
        parsed = _parse_duffel_offer(offer, currency)
        if parsed:
            out.append(parsed)

    out.sort(key=lambda x: x.price)
    return out



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
        Search flights using Duffel API.
        Results are cached for CACHE_TTL_SECONDS.
        """
        raw_from = fly_from.strip()
        raw_to = fly_to.strip()
        a = _normalize_fly_term(raw_from)
        b = _normalize_fly_term(raw_to)

        if not a:
            AppException.bad_request("Origin is required")
        if not b or b == "__ANYWHERE__" or b == "ANYWHERE":
            AppException.bad_request("Duffel requires a specific destination airport code")

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

        duffel_api_key = (settings.duffel_api_key or "").strip()
        if not duffel_api_key:
            logger.warning("Duffel API key is not configured")
            return []

        try:
            logger.info("Attempting flight search via Duffel API")
            results = _search_duffel(
                fly_from=a,
                fly_to=b,
                date_from=date_from,
                adults=adults,
                currency=curr,
                cabins=cabin_token,
                return_from=return_from
            )
            _flight_cache[key] = (now + CACHE_TTL_SECONDS, results)
            return results
        except Exception as e:
            logger.warning("Duffel flight search failed: %s", e)
            return []
