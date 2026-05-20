"""
app/services/flight_service.py — Flight search via Duffel API (Primary) and Amadeus API (Fallback)

TTL in-memory cache (30 min); key includes outbound window, cabin, currency, pax, return leg.
"""
from __future__ import annotations

import logging
import time
import re
from datetime import date
from typing import Any

import httpx
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


def _parse_amadeus_offer(raw: dict[str, Any], currency_preference: str) -> FlightResult | None:
    try:
        rid = raw.get("id")
        if not rid:
            return None
        price_obj = raw.get("price") or {}
        price_str = price_obj.get("grandTotal") or price_obj.get("total")
        if not price_str:
            return None
        price_f = float(price_str)
        currency = price_obj.get("currency") or currency_preference or "USD"

        itineraries = raw.get("itineraries") or []
        if not itineraries:
            return None

        # Collect unique carrier codes
        airlines: list[str] = []
        for it in itineraries:
            for seg in it.get("segments") or []:
                carrier = seg.get("carrierCode")
                if carrier and carrier not in airlines:
                    airlines.append(carrier)

        # First itinerary first segment departure
        first_it = itineraries[0]
        first_seg = (first_it.get("segments") or [])[0] if first_it.get("segments") else {}
        departure_at = first_seg.get("departure", {}).get("at", "")

        # Last itinerary last segment arrival
        last_it = itineraries[-1]
        last_seg = (last_it.get("segments") or [])[-1] if last_it.get("segments") else {}
        arrival_at = last_seg.get("arrival", {}).get("at", "")

        origin = first_seg.get("departure", {}).get("iataCode", "")
        destination = last_seg.get("arrival", {}).get("iataCode", "")

        duration_minutes = sum(_parse_iso_duration_to_minutes(it.get("duration")) for it in itineraries)
        stops = sum(max(0, len(it.get("segments") or []) - 1) for it in itineraries)

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
        logger.warning("Error parsing Amadeus offer: %s", e)
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


def _search_amadeus(
    fly_from: str,
    fly_to: str,
    date_from: date,
    adults: int,
    currency: str,
    cabins: str,
    return_from: date | None,
) -> list[FlightResult]:
    amadeus_key = (settings.amadeus_api_key or "").strip()
    amadeus_secret = (settings.amadeus_api_secret or "").strip()
    
    base_url = (
        "https://api.amadeus.com"
        if settings.ENVIRONMENT == "production"
        else "https://test.api.amadeus.com"
    )
    
    # Authenticate
    token_url = f"{base_url}/v1/security/oauth2/token"
    token_data = {
        "grant_type": "client_credentials",
        "client_id": amadeus_key,
        "client_secret": amadeus_secret,
    }
    
    with httpx.Client(timeout=10.0) as client:
        resp = client.post(token_url, data=token_data)
        resp.raise_for_status()
        access_token = resp.json()["access_token"]

    # Search
    search_url = f"{base_url}/v2/shopping/flight-offers"
    
    amadeus_cabin_map = {
        "M": "ECONOMY",
        "W": "PREMIUM_ECONOMY",
        "C": "BUSINESS",
        "F": "FIRST",
    }
    travel_class = amadeus_cabin_map.get(cabins, "ECONOMY")

    params: dict[str, Any] = {
        "originLocationCode": fly_from,
        "destinationLocationCode": fly_to,
        "departureDate": date_from.isoformat(),
        "adults": adults,
        "currencyCode": currency,
        "travelClass": travel_class,
        "max": 250,
    }
    if return_from is not None:
        params["returnDate"] = return_from.isoformat()

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json"
    }

    with httpx.Client(timeout=25.0) as client:
        resp = client.get(search_url, params=params, headers=headers)
        resp.raise_for_status()
        body = resp.json()

    out: list[FlightResult] = []
    data = body.get("data") or []
    for item in data:
        parsed = _parse_amadeus_offer(item, currency)
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
        Search flights using Duffel API (Primary) and Amadeus API (Fallback).
        Results are cached for CACHE_TTL_SECONDS.
        """
        raw_from = fly_from.strip()
        raw_to = fly_to.strip()
        a = _normalize_fly_term(raw_from)
        b = _normalize_fly_term(raw_to)

        if not a:
            AppException.bad_request("Origin is required")
        if not b or b == "__ANYWHERE__" or b == "ANYWHERE":
            AppException.bad_request("Duffel and Amadeus require a specific destination airport code")

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

        # 1. Duffel (Primary)
        duffel_api_key = (settings.duffel_api_key or "").strip()
        if duffel_api_key:
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
                logger.warning("Duffel flight search failed, falling back to Amadeus: %s", e)

        # 2. Amadeus (Fallback)
        amadeus_key = (settings.amadeus_api_key or "").strip()
        amadeus_secret = (settings.amadeus_api_secret or "").strip()
        if amadeus_key and amadeus_secret:
            try:
                logger.info("Attempting flight search via Amadeus API")
                results = _search_amadeus(
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
                logger.error("Amadeus fallback flight search failed: %s", e)
                AppException.bad_gateway("Flight search service temporarily unavailable")

        # 3. If neither is configured/working
        AppException.service_unavailable("Flight search is not configured")
