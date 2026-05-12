"""
Curated Agoda-style hotels for major NA cities (static + Travelpayouts deep links).
"""

from __future__ import annotations

import logging
import time
from datetime import date
from typing import Any
from urllib.parse import quote

from fastapi import HTTPException

from app.schemas.hotel import HotelResult
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)

_CACHE_TTL = 3_600
_hotel_cache: dict[tuple[str, str, str], tuple[float, list[HotelResult]]] = {}

_CITY_SEARCH_PARAM: dict[str, str] = {
    "nyc": "New+York",
    "chicago": "Chicago",
    "la": "Los+Angeles",
    "miami": "Miami",
    "lasvegas": "Las+Vegas",
    "toronto": "Toronto",
    "vancouver": "Vancouver",
}

_CITY_ALIASES: dict[str, str] = {
    "nyc": "nyc",
    "newyork": "nyc",
    "newyorkcity": "nyc",
    "manhattan": "nyc",
    "chicago": "chicago",
    "chi": "chicago",
    "losangeles": "la",
    "la": "la",
    "lax": "la",
    "miami": "miami",
    "mia": "miami",
    "lasvegas": "lasvegas",
    "vegas": "lasvegas",
    "toronto": "toronto",
    "yyz": "toronto",
    "vancouver": "vancouver",
    "yvr": "vancouver",
}

_HOTEL_TEMPLATES: dict[str, list[dict[str, Any]]] = {
    "nyc": [
        {
            "slug": "mid1",
            "name": "Midtown Boutique Stay",
            "loc": "Midtown Manhattan",
            "addr": "120 W 45th St, New York, NY",
            "pn": 189.0,
            "rating": 4.6,
            "reviews": 1820,
            "stars": 4,
            "amenities": ["Wi-Fi", "Gym", "Concierge"],
        },
        {
            "slug": "brook",
            "name": "Brooklyn Waterfront Hotel",
            "loc": "Williamsburg",
            "addr": "80 N 6th St, Brooklyn, NY",
            "pn": 159.0,
            "rating": 4.4,
            "reviews": 940,
            "stars": 4,
            "amenities": ["Wi-Fi", "Breakfast", "Rooftop"],
        },
        {
            "slug": "lux",
            "name": "Central Park Luxury",
            "loc": "Upper West Side",
            "addr": "40 Central Park S, New York, NY",
            "pn": 389.0,
            "rating": 4.9,
            "reviews": 2210,
            "stars": 5,
            "amenities": ["Spa", "Pool", "Room service"],
        },
    ],
    "chicago": [
        {
            "slug": "loop",
            "name": "Loop Riverfront Hotel",
            "loc": "Chicago Loop",
            "addr": "200 N Columbus Dr, Chicago, IL",
            "pn": 149.0,
            "rating": 4.5,
            "reviews": 1322,
            "stars": 4,
            "amenities": ["Wi-Fi", "Gym", "Parking"],
        },
        {
            "slug": "mag",
            "name": "Magnificent Mile Classic",
            "loc": "Magnificent Mile",
            "addr": "720 N Michigan Ave, Chicago, IL",
            "pn": 219.0,
            "rating": 4.7,
            "reviews": 980,
            "stars": 4,
            "amenities": ["Breakfast", "Wi-Fi"],
        },
    ],
    "la": [
        {
            "slug": "santa",
            "name": "Santa Monica Pier Inn",
            "loc": "Santa Monica",
            "addr": "1700 Ocean Ave, Santa Monica, CA",
            "pn": 259.0,
            "rating": 4.6,
            "reviews": 1540,
            "stars": 4,
            "amenities": ["Pool", "Wi-Fi", "Beach access"],
        },
        {
            "slug": "holly",
            "name": "Hollywood Signature Suites",
            "loc": "Hollywood",
            "addr": "6801 Hollywood Blvd, Los Angeles, CA",
            "pn": 179.0,
            "rating": 4.3,
            "reviews": 760,
            "stars": 3,
            "amenities": ["Wi-Fi", "Parking"],
        },
    ],
    "miami": [
        {
            "slug": "sobe",
            "name": "South Beach Ocean Resort",
            "loc": "South Beach",
            "addr": "1001 Collins Ave, Miami Beach, FL",
            "pn": 289.0,
            "rating": 4.7,
            "reviews": 2410,
            "stars": 5,
            "amenities": ["Pool", "Spa", "Wi-Fi"],
        },
        {
            "slug": "brick",
            "name": "Brickell Urban Hotel",
            "loc": "Brickell",
            "addr": "50 Biscayne Blvd, Miami, FL",
            "pn": 199.0,
            "rating": 4.5,
            "reviews": 880,
            "stars": 4,
            "amenities": ["Gym", "Wi-Fi"],
        },
    ],
    "lasvegas": [
        {
            "slug": "strip",
            "name": "Strip Lights Resort",
            "loc": "Las Vegas Strip",
            "addr": "3600 Las Vegas Blvd S, Las Vegas, NV",
            "pn": 129.0,
            "rating": 4.4,
            "reviews": 5020,
            "stars": 4,
            "amenities": ["Pool", "Casino", "Shows"],
        },
        {
            "slug": "boutique",
            "name": "Downtown Boutique Loft",
            "loc": "Fremont District",
            "addr": "200 Fremont St, Las Vegas, NV",
            "pn": 99.0,
            "rating": 4.2,
            "reviews": 620,
            "stars": 3,
            "amenities": ["Wi-Fi"],
        },
    ],
    "toronto": [
        {
            "slug": "union",
            "name": "Union Station Tower Hotel",
            "loc": "Financial District",
            "addr": "65 Front St W, Toronto, ON",
            "pn": 169.0,
            "rating": 4.6,
            "reviews": 2100,
            "stars": 4,
            "amenities": ["Wi-Fi", "Gym"],
        },
        {
            "slug": "king",
            "name": "King West Loft Hotel",
            "loc": "King West",
            "addr": "620 King St W, Toronto, ON",
            "pn": 149.0,
            "rating": 4.5,
            "reviews": 730,
            "stars": 4,
            "amenities": ["Breakfast", "Wi-Fi"],
        },
    ],
    "vancouver": [
        {
            "slug": "coal",
            "name": "Coal Harbour Waterfront",
            "loc": "Coal Harbour",
            "addr": "900 Canada Pl, Vancouver, BC",
            "pn": 239.0,
            "rating": 4.8,
            "reviews": 1670,
            "stars": 5,
            "amenities": ["Harbour view", "Wi-Fi", "Spa"],
        },
        {
            "slug": "gastown",
            "name": "Gastown Heritage Inn",
            "loc": "Gastown",
            "addr": "130 Water St, Vancouver, BC",
            "pn": 159.0,
            "rating": 4.5,
            "reviews": 540,
            "stars": 3,
            "amenities": ["Wi-Fi"],
        },
    ],
}


def _agoda_booking_url(city_token: str) -> str:
    inner = "https://www.agoda.com/search?city=" + city_token
    return (
        "https://tp.media/r?marker=PENDING_APPROVAL&p=4363&u="
        + quote(inner, safe="")
    )


def _canonical_city(location: str) -> str | None:
    raw = "".join(c for c in location.strip().lower() if c.isalnum())
    if not raw:
        return None
    return _CITY_ALIASES.get(raw)


def _build_hotels(city_key: str) -> list[HotelResult]:
    token = _CITY_SEARCH_PARAM[city_key]
    booking = _agoda_booking_url(token)
    out: list[HotelResult] = []
    for row in _HOTEL_TEMPLATES.get(city_key, []):
        hid = f"{city_key}-{row['slug']}"
        out.append(
            HotelResult(
                id=hid,
                name=row["name"],
                location=row["loc"],
                address=row["addr"],
                price_per_night=float(row["pn"]),
                currency="USD",
                rating=float(row["rating"]),
                review_count=int(row["reviews"]),
                stars=int(row["stars"]),
                image_url=None,
                amenities=list(row["amenities"]),
                booking_url=booking,
                provider="Agoda",
            ),
        )
    return out


class HotelService:
    @staticmethod
    def search_hotels(
        location: str,
        check_in: date,
        check_out: date,
        adults: int,
        rooms: int = 1,
    ) -> list[HotelResult]:
        _ = adults
        try:
            if check_out <= check_in:
                AppException.unprocessable("check_out must be after check_in")

            city_key = _canonical_city(location)
            if city_key is None:
                return []

            ck = (
                city_key,
                check_in.isoformat(),
                check_out.isoformat(),
            )
            now = time.monotonic()
            hit = _hotel_cache.get(ck)
            if hit and now - hit[0] < _CACHE_TTL:
                rows = hit[1]
            else:
                rows = _build_hotels(city_key)
                _hotel_cache[ck] = (now, rows)

            mult = max(1, rooms)
            return [
                HotelResult.model_validate(
                    {
                        **h.model_dump(),
                        "price_per_night": round(h.price_per_night * mult, 2),
                    },
                )
                for h in rows
            ]
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("hotel search failed")
            AppException.internal(str(exc))