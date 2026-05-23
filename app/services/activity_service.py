"""
Curated GetYourGuide-style activities for major NA cities (static + Travelpayouts deep links).
"""

from __future__ import annotations

import logging
import time
from datetime import date
from typing import Any
from urllib.parse import quote

from fastapi import HTTPException

from app.schemas.activity import ActivityResult
from app.utils.exceptions import AppException
from config import settings

logger = logging.getLogger(__name__)

_CACHE_TTL = 3_600
_activity_cache: dict[str, tuple[float, list[ActivityResult]]] = {}


def _gyg_booking_url(search_query: str) -> str:
    m = (settings.travelpayouts_marker or "").strip() or "727732"
    inner = "https://www.getyourguide.com/s/?q=" + quote(search_query, safe="")
    return (
        f"https://tp.media/r?marker={m}&trs={m}&p=4307&u="
        + quote(inner, safe="")
    )


_CITY_SEARCH_LABEL: dict[str, str] = {
    "nyc": "New York City",
    "chicago": "Chicago",
    "la": "Los Angeles",
    "miami": "Miami",
    "lasvegas": "Las Vegas",
    "toronto": "Toronto",
    "vancouver": "Vancouver",
}

_CITY_ALIASES: dict[str, str] = {
    "nyc": "nyc",
    "newyork": "nyc",
    "newyorkcity": "nyc",
    "manhattan": "nyc",
    "brooklyn": "nyc",
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

# Raw templates: id suffix per city applied at build time
_ACTIVITY_TEMPLATES: dict[str, list[dict[str, Any]]] = {
    "nyc": [
        {
            "slug": "statue",
            "title": "Statue of Liberty & Ellis Island",
            "desc": "Ferry, grounds, and iconic NYC harbor views.",
            "where": "Battery Park, New York",
            "price": 48.0,
            "minutes": 300,
            "rating": 4.7,
            "cat": "Sightseeing",
        },
        {
            "slug": "food",
            "title": "Brooklyn Food & History Walk",
            "desc": "Taste classic NYC bites with a local guide.",
            "where": "Williamsburg, Brooklyn",
            "price": 89.0,
            "minutes": 180,
            "rating": 4.8,
            "cat": "Food & Drink",
        },
        {
            "slug": "hel",
            "title": "Manhattan Helicopter Experience",
            "desc": "Bird’s-eye skyline over Midtown and the rivers.",
            "where": "Downtown Heliport",
            "price": 229.0,
            "minutes": 90,
            "rating": 4.6,
            "cat": "Adventure",
        },
        {
            "slug": "met",
            "title": "Met Museum Highlights Tour",
            "desc": "Curated masterpieces with an art historian.",
            "where": "Metropolitan Museum of Art",
            "price": 65.0,
            "minutes": 150,
            "rating": 4.9,
            "cat": "Culture",
        },
        {
            "slug": "comedy",
            "title": "Late Night Comedy Club Pass",
            "desc": "Stand-up showcase in Greenwich Village.",
            "where": "Greenwich Village",
            "price": 35.0,
            "minutes": 120,
            "rating": 4.4,
            "cat": "Entertainment",
        },
    ],
    "chicago": [
        {
            "slug": "arch",
            "title": "Chicago River Architecture Cruise",
            "desc": "Skyline storytelling from the water.",
            "where": "Chicago Riverwalk",
            "price": 52.0,
            "minutes": 90,
            "rating": 4.8,
            "cat": "Sightseeing",
        },
        {
            "slug": "pizza",
            "title": "Deep Dish & Loop Food Tour",
            "desc": "Slice through Chicago’s iconic food scene.",
            "where": "The Loop",
            "price": 79.0,
            "minutes": 210,
            "rating": 4.7,
            "cat": "Food & Drink",
        },
        {
            "slug": "360",
            "title": "360 CHICAGO Observation Deck",
            "desc": "TILT glass experience above the Magnificent Mile.",
            "where": "875 N Michigan Ave",
            "price": 34.0,
            "minutes": 90,
            "rating": 4.5,
            "cat": "Adventure",
        },
        {
            "slug": "art",
            "title": "Art Institute Focus Tour",
            "desc": "Impressionists & modern highlights.",
            "where": "Art Institute of Chicago",
            "price": 45.0,
            "minutes": 120,
            "rating": 4.9,
            "cat": "Culture",
        },
    ],
    "la": [
        {
            "slug": "studios",
            "title": "Studio Lot & Backlot Experience",
            "desc": "Behind-the-scenes movie magic.",
            "where": "Burbank",
            "price": 72.0,
            "minutes": 180,
            "rating": 4.6,
            "cat": "Entertainment",
        },
        {
            "slug": "hike",
            "title": "Griffith Observatory Sunset Hike",
            "desc": "City views and science exhibits.",
            "where": "Griffith Park",
            "price": 55.0,
            "minutes": 150,
            "rating": 4.8,
            "cat": "Adventure",
        },
        {
            "slug": "foodtruck",
            "title": "Arts District Food Crawl",
            "desc": "Tacos, vendors, and downtown culture.",
            "where": "Arts District LA",
            "price": 68.0,
            "minutes": 180,
            "rating": 4.5,
            "cat": "Food & Drink",
        },
    ],
    "miami": [
        {
            "slug": "boat",
            "title": "Biscayne Bay Sightseeing Cruise",
            "desc": "Millionaire’s row and skyline from the water.",
            "where": "Bayside Marketplace",
            "price": 42.0,
            "minutes": 90,
            "rating": 4.5,
            "cat": "Sightseeing",
        },
        {
            "slug": "wynwood",
            "title": "Wynwood Walls Street Art Tour",
            "desc": "Murals and cocktail stop in the arts district.",
            "where": "Wynwood",
            "price": 39.0,
            "minutes": 120,
            "rating": 4.7,
            "cat": "Culture",
        },
        {
            "slug": "ever",
            "title": "Everglades Airboat & Wildlife",
            "desc": "Gators, sawgrass, and airboat thrill ride.",
            "where": "Everglades NP (tour pickup Miami)",
            "price": 65.0,
            "minutes": 240,
            "rating": 4.6,
            "cat": "Adventure",
        },
    ],
    "lasvegas": [
        {
            "slug": "strip",
            "title": "Night Strip Lights SUV Tour",
            "desc": "Fountains, signs, and iconic casinos after dark.",
            "where": "Las Vegas Strip",
            "price": 59.0,
            "minutes": 150,
            "rating": 4.6,
            "cat": "Sightseeing",
        },
        {
            "slug": "show",
            "title": "Cirque-Style Variety Night",
            "desc": "Reserved seating for a Vegas production show.",
            "where": "Strip Resort Theater",
            "price": 95.0,
            "minutes": 120,
            "rating": 4.8,
            "cat": "Entertainment",
        },
        {
            "slug": "hoover",
            "title": "Hoover Dam Half-Day Escape",
            "desc": "Engineering marvel just outside the city.",
            "where": "Hoover Dam",
            "price": 79.0,
            "minutes": 300,
            "rating": 4.7,
            "cat": "Adventure",
        },
    ],
    "toronto": [
        {
            "slug": "cntower",
            "title": "CN Tower Priority Entry",
            "desc": "Glass floor and skyline panoramas.",
            "where": "Downtown Toronto",
            "price": 48.0,
            "minutes": 120,
            "rating": 4.7,
            "cat": "Sightseeing",
        },
        {
            "slug": "island",
            "title": "Toronto Islands Bike Cruise",
            "desc": "Ferry hop and waterfront breeze.",
            "where": "Harbourfront",
            "price": 62.0,
            "minutes": 210,
            "rating": 4.6,
            "cat": "Adventure",
        },
        {
            "slug": "market",
            "title": "St. Lawrence Market Food Tour",
            "desc": "Peameal bacon, cheeses, and local treats.",
            "where": "Old Toronto",
            "price": 74.0,
            "minutes": 180,
            "rating": 4.8,
            "cat": "Food & Drink",
        },
    ],
    "vancouver": [
        {
            "slug": "stanley",
            "title": "Stanley Park Seawall E-Bike Ride",
            "desc": "Coastal rainforest and mountain-backed vistas.",
            "where": "Stanley Park",
            "price": 58.0,
            "minutes": 150,
            "rating": 4.8,
            "cat": "Adventure",
        },
        {
            "slug": "granville",
            "title": "Granville Island Market Taste Tour",
            "desc": "Artisans, cider, and harbor bites.",
            "where": "Granville Island",
            "price": 69.0,
            "minutes": 135,
            "rating": 4.7,
            "cat": "Food & Drink",
        },
        {
            "slug": "museum",
            "title": "Museum of Anthropology Essentials",
            "desc": "First Nations masterpieces and coastal forms.",
            "where": "UBC Campus",
            "price": 42.0,
            "minutes": 120,
            "rating": 4.9,
            "cat": "Culture",
        },
    ],
}


def _canonical_city(location: str) -> str | None:
    raw = "".join(c for c in location.strip().lower() if c.isalnum())
    if not raw:
        return None
    return _CITY_ALIASES.get(raw)


def _build_results(city_key: str) -> list[ActivityResult]:
    label = _CITY_SEARCH_LABEL[city_key]
    booking = _gyg_booking_url(label)
    out: list[ActivityResult] = []
    for row in _ACTIVITY_TEMPLATES.get(city_key, []):
        aid = f"{city_key}-{row['slug']}"
        out.append(
            ActivityResult(
                id=aid,
                title=row["title"],
                description=row["desc"],
                location=row["where"],
                price=float(row["price"]),
                currency="USD",
                duration_minutes=int(row["minutes"]),
                rating=float(row["rating"]),
                image_url=None,
                booking_url=booking,
                provider="GetYourGuide",
                category=row["cat"],
            ),
        )
    return out


def _generate_dynamic_activities(location: str) -> list[ActivityResult]:
    cleaned = location.strip()
    if not cleaned:
        cleaned = "Hyderabad"
    
    title_location = " ".join(w.capitalize() for w in cleaned.split())
    booking = _gyg_booking_url(title_location)
    
    templates = [
        {
            "slug": "sightseeing",
            "title": f"Ultimate {title_location} City Highlights Tour",
            "desc": f"Explore the most iconic sights, landmarks, and hidden gems of {title_location} with a premium local guide.",
            "where": f"Central {title_location}",
            "price": 45.0,
            "minutes": 180,
            "rating": 4.8,
            "cat": "Sightseeing",
        },
        {
            "slug": "food",
            "title": f"Street Food Tasting & Cultural Walk in {title_location}",
            "desc": f"Savor authentic regional flavors, spices, and traditional recipes beloved by {title_location} locals.",
            "where": f"Old Town, {title_location}",
            "price": 35.0,
            "minutes": 120,
            "rating": 4.9,
            "cat": "Food & Drink",
        },
        {
            "slug": "adventure",
            "title": f"Thrilling {title_location} Outdoor Adventure Challenge",
            "desc": f"Get your adrenaline pumping with a customized outdoor experience showcasing the nature around {title_location}.",
            "where": f"Valley Hills, {title_location}",
            "price": 75.0,
            "minutes": 240,
            "rating": 4.7,
            "cat": "Adventure",
        },
        {
            "slug": "culture",
            "title": f"Heritage & History Immersion in {title_location}",
            "desc": f"Step back in time and uncover the fascinating heritage, architecture, and spiritual landmarks of {title_location}.",
            "where": f"Historic District, {title_location}",
            "price": 28.0,
            "minutes": 150,
            "rating": 4.8,
            "cat": "Culture",
        },
        {
            "slug": "entertainment",
            "title": f"Evening Entertainment & Local Showcase pass",
            "desc": f"Experience the vibrant nightlife, cultural shows, and modern entertainment scene of {title_location} after sunset.",
            "where": f"Downtown {title_location}",
            "price": 55.0,
            "minutes": 120,
            "rating": 4.6,
            "cat": "Entertainment",
        },
    ]
    
    out: list[ActivityResult] = []
    for row in templates:
        aid = f"dynamic-{title_location.lower().replace(' ', '')}-{row['slug']}"
        out.append(
            ActivityResult(
                id=aid,
                title=row["title"],
                description=row["desc"],
                location=row["where"],
                price=float(row["price"]),
                currency="USD",
                duration_minutes=int(row["minutes"]),
                rating=float(row["rating"]),
                image_url=None,
                booking_url=booking,
                provider="GetYourGuide",
                category=row["cat"],
            )
        )
    return out


class ActivityService:
    """Static curated inventory with TTL cache per normalized city."""

    @staticmethod
    def search_activities(
        location: str,
        date: date,
        adults: int,
        category: str | None = None,
    ) -> list[ActivityResult]:
        _ = date
        try:
            city_key = _canonical_city(location)
            cat_norm = category.strip().lower() if category and category.strip() else None

            if city_key is None:
                base = _generate_dynamic_activities(location)
            else:
                cache_key = city_key
                now = time.monotonic()
                hit = _activity_cache.get(cache_key)
                if hit and now - hit[0] < _CACHE_TTL:
                    base = hit[1]
                else:
                    base = _build_results(city_key)
                    _activity_cache[cache_key] = (now, base)

            if not cat_norm:
                scaled = [
                    ActivityResult.model_validate({**a.model_dump(), "price": round(a.price * max(1, adults), 2)})
                    for a in base
                ]
                return scaled

            filtered = [
                a for a in base if a.category and a.category.lower() == cat_norm
            ]
            return [
                ActivityResult.model_validate({**a.model_dump(), "price": round(a.price * max(1, adults), 2)})
                for a in filtered
            ]
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("activity search failed")
            AppException.internal(str(exc))
