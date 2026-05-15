"""
Curated Busbud-style buses for major NA city pairs (static + Travelpayouts deep links).
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import quote

from pydantic import ValidationError

from app.schemas.bus import BusResult
from app.utils.exceptions import AppException
from config import settings

logger = logging.getLogger(__name__)

_CACHE_TTL = 3_600
_bus_cache: dict[tuple[str, str, str], tuple[float, list[BusResult]]] = {}

_CITY_SLUGS: dict[str, str] = {
    "nyc": "new-york",
    "boston": "boston",
    "dc": "washington",
    "chicago": "chicago",
    "detroit": "detroit",
    "milwaukee": "milwaukee",
    "la": "los-angeles",
    "sf": "san-francisco",
    "vegas": "las-vegas",
    "toronto": "toronto",
    "montreal": "montreal",
    "vancouver": "vancouver",
    "seattle": "seattle",
}

_CITY_ALIASES: dict[str, str] = {
    "nyc": "nyc",
    "newyork": "nyc",
    "boston": "boston",
    "washington": "dc",
    "dc": "dc",
    "chicago": "chicago",
    "detroit": "detroit",
    "milwaukee": "milwaukee",
    "la": "la",
    "losangeles": "la",
    "sf": "sf",
    "sanfrancisco": "sf",
    "vegas": "vegas",
    "lasvegas": "vegas",
    "toronto": "toronto",
    "montreal": "montreal",
    "vancouver": "vancouver",
    "seattle": "seattle",
}

# Base templates for realistic results
_OPERATORS = ["Greyhound", "FlixBus", "Megabus", "Peter Pan", "BoltBus"]

_ROUTE_DEFAULTS: dict[tuple[str, str], dict[str, Any]] = {
    ("nyc", "boston"): {"duration": 270, "price": 35.0},
    ("boston", "nyc"): {"duration": 270, "price": 35.0},
    ("nyc", "dc"): {"duration": 240, "price": 30.0},
    ("dc", "nyc"): {"duration": 240, "price": 30.0},
    ("chicago", "detroit"): {"duration": 300, "price": 40.0},
    ("detroit", "chicago"): {"duration": 300, "price": 40.0},
    ("chicago", "milwaukee"): {"duration": 120, "price": 20.0},
    ("milwaukee", "chicago"): {"duration": 120, "price": 20.0},
    ("la", "sf"): {"duration": 480, "price": 50.0},
    ("sf", "la"): {"duration": 480, "price": 50.0},
    ("la", "vegas"): {"duration": 300, "price": 35.0},
    ("vegas", "la"): {"duration": 300, "price": 35.0},
    ("toronto", "montreal"): {"duration": 360, "price": 45.0},
    ("montreal", "toronto"): {"duration": 360, "price": 45.0},
    ("vancouver", "seattle"): {"duration": 210, "price": 30.0},
    ("seattle", "vancouver"): {"duration": 210, "price": 30.0},
}


def _busbud_booking_url(origin_key: str, dest_key: str) -> str:
    m = (settings.travelpayouts_marker or "").strip() or "727732"
    orig_slug = _CITY_SLUGS.get(origin_key, "new-york")
    dest_slug = _CITY_SLUGS.get(dest_key, "boston")
    
    # Example u: https://www.busbud.com/en/bus-new-york--boston
    inner = f"https://www.busbud.com/en/bus-{orig_slug}--{dest_slug}"
    
    return f"https://tp.media/r?marker={m}&p=5782&u={quote(inner, safe='')}"


def _canonical_city(location: str) -> str | None:
    raw = "".join(c for c in location.strip().lower() if c.isalnum())
    if not raw:
        return None
    return _CITY_ALIASES.get(raw)


def _build_buses(origin_key: str, dest_key: str, date_str: str) -> list[BusResult]:
    route_info = _ROUTE_DEFAULTS.get((origin_key, dest_key))
    if not route_info:
        return []
        
    booking = _busbud_booking_url(origin_key, dest_key)
    out: list[BusResult] = []
    
    # Generate 3 realistic options per route
    base_duration = route_info["duration"]
    base_price = route_info["price"]
    
    # Option 1: Morning
    out.append(
        BusResult(
            id=f"{origin_key}-{dest_key}-opt1",
            operator="Greyhound",
            origin=origin_key.upper(),
            destination=dest_key.upper(),
            departure_at=f"{date_str}T08:00:00",
            arrival_at=(datetime.fromisoformat(f"{date_str}T08:00:00") + timedelta(minutes=base_duration)).isoformat(),
            duration_minutes=base_duration,
            price=base_price,
            currency="USD",
            available_seats=12,
            booking_url=booking,
            provider="Busbud",
            amenities=["WiFi", "AC", "USB charging"],
        )
    )
    
    # Option 2: Afternoon (Faster or cheaper)
    out.append(
        BusResult(
            id=f"{origin_key}-{dest_key}-opt2",
            operator="FlixBus",
            origin=origin_key.upper(),
            destination=dest_key.upper(),
            departure_at=f"{date_str}T14:30:00",
            arrival_at=(datetime.fromisoformat(f"{date_str}T14:30:00") + timedelta(minutes=base_duration - 15)).isoformat(),
            duration_minutes=base_duration - 15,
            price=base_price - 5.0,
            currency="USD",
            available_seats=5,
            booking_url=booking,
            provider="Busbud",
            amenities=["WiFi", "AC"],
        )
    )
    
    # Option 3: Evening
    out.append(
        BusResult(
            id=f"{origin_key}-{dest_key}-opt3",
            operator="Megabus",
            origin=origin_key.upper(),
            destination=dest_key.upper(),
            departure_at=f"{date_str}T19:00:00",
            arrival_at=(datetime.fromisoformat(f"{date_str}T19:00:00") + timedelta(minutes=base_duration + 10)).isoformat(),
            duration_minutes=base_duration + 10,
            price=base_price + 10.0,
            currency="USD",
            available_seats=20,
            booking_url=booking,
            provider="Busbud",
            amenities=["WiFi", "AC", "USB charging", "Power outlets"],
        )
    )
    
    return out


class BusService:
    @staticmethod
    def search_buses(
        origin: str,
        destination: str,
        date: str,
        adults: int = 1,
        currency: str = "USD",
    ) -> list[BusResult]:
        _ = adults
        _ = currency
        
        try:
            # Validate date format simple check
            try:
                datetime.strptime(date, "%Y-%m-%d")
            except ValueError:
                AppException.unprocessable("Invalid date format. Use YYYY-MM-DD")

            origin_key = _canonical_city(origin)
            dest_key = _canonical_city(destination)
            
            if origin_key is None or dest_key is None:
                return []

            ck = (origin_key, dest_key, date)
            now = time.monotonic()
            hit = _bus_cache.get(ck)
            
            if hit and now - hit[0] < _CACHE_TTL:
                rows = hit[1]
            else:
                rows = _build_buses(origin_key, dest_key, date)
                _bus_cache[ck] = (now, rows)

            return rows

        except (TypeError, ValueError, ValidationError) as exc:
            logger.exception("bus search failed")
            AppException.internal(str(exc))
