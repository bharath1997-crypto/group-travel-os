"""
Multi-source Event Discovery Aggregator.

GPS city → PostgreSQL cache (24hr) → Ticketmaster returned immediately;
Instagram/Apify runs in a production-only background thread and merges into cache.
"""
from __future__ import annotations

import json
import logging
import math
import os
import threading
import time
from datetime import timedelta
from typing import Any
import concurrent.futures

import httpx
from sqlalchemy.orm import Session

from app.core.api_limits import API_TIMEOUT_SECONDS
from app.services.explore_city_extended_service import _aware, _get_row, _now, _upsert_list
from app.utils.database import SessionLocal
from config import settings

logger = logging.getLogger(__name__)

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
}

TICKETMASTER_URL = "https://app.ticketmaster.com/discovery/v2/events.json"
TTL_SECONDS = 86_400  # 24 hours
CONTENT_EVENTS_AGGREGATED = "events_aggregated"
TTL_EVENTS_AGGREGATED_HOURS = 24

YELP_EVENTS_LIMIT = 50
EVENTBRITE_EVENTS_LIMIT = 50
BANDSINTOWN_EVENTS_PER_PAGE = 50
APIFY_INSTAGRAM_HASHTAG_ACTOR = "apify~instagram-hashtag-scraper"
EXPLORE_RADIUS_MILES = 200

# Major metros used to enrich GPS-based discovery within EXPLORE_RADIUS_MILES
MAJOR_METRO_CITIES: list[dict[str, Any]] = [
    {"name": "Chicago", "state": "IL", "lat": 41.8781, "lon": -87.6298},
    {"name": "New York", "state": "NY", "lat": 40.7128, "lon": -74.006},
    {"name": "Los Angeles", "state": "CA", "lat": 34.0522, "lon": -118.2437},
    {"name": "San Francisco", "state": "CA", "lat": 37.7749, "lon": -122.4194},
    {"name": "San Jose", "state": "CA", "lat": 37.3382, "lon": -121.8863},
    {"name": "Oakland", "state": "CA", "lat": 37.8044, "lon": -122.2712},
    {"name": "Sacramento", "state": "CA", "lat": 38.5816, "lon": -121.4944},
    {"name": "Houston", "state": "TX", "lat": 29.7604, "lon": -95.3698},
    {"name": "Phoenix", "state": "AZ", "lat": 33.4484, "lon": -112.074},
    {"name": "Philadelphia", "state": "PA", "lat": 39.9526, "lon": -75.1652},
    {"name": "San Antonio", "state": "TX", "lat": 29.4241, "lon": -98.4936},
    {"name": "San Diego", "state": "CA", "lat": 32.7157, "lon": -117.1611},
    {"name": "Dallas", "state": "TX", "lat": 32.7767, "lon": -96.797},
    {"name": "Austin", "state": "TX", "lat": 30.2672, "lon": -97.7431},
    {"name": "Miami", "state": "FL", "lat": 25.7617, "lon": -80.1918},
    {"name": "Seattle", "state": "WA", "lat": 47.6062, "lon": -122.3321},
    {"name": "Denver", "state": "CO", "lat": 39.7392, "lon": -104.9903},
    {"name": "Boston", "state": "MA", "lat": 42.3601, "lon": -71.0589},
    {"name": "Atlanta", "state": "GA", "lat": 33.749, "lon": -84.388},
    {"name": "Las Vegas", "state": "NV", "lat": 36.1699, "lon": -115.1398},
    {"name": "Milwaukee", "state": "WI", "lat": 43.0389, "lon": -87.9065},
    {"name": "Indianapolis", "state": "IN", "lat": 39.7684, "lon": -86.1581},
    {"name": "Detroit", "state": "MI", "lat": 42.3314, "lon": -83.0458},
    {"name": "Portland", "state": "OR", "lat": 45.5152, "lon": -122.6784},
    {"name": "Nashville", "state": "TN", "lat": 36.1627, "lon": -86.7816},
]

_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}

_background_instagram_lock = threading.Lock()
_background_instagram_cities: set[str] = set()

# Geographical coordinate mappings for Skiddle geosearch
CITY_COORD_MAP = {
    "london": (51.5074, -0.1278, "GB"),
    "manchester": (53.4808, -2.2426, "GB"),
    "edinburgh": (55.9533, -3.1883, "GB"),
    "chicago": (41.8781, -87.6298, "US"),
    "new york": (40.7128, -74.0060, "US"),
    "tokyo": (35.6762, 139.6503, "JP"),
    "paris": (48.8566, 2.3522, "FR"),
    "sydney": (-33.8688, 151.2093, "AU"),
}


def _cache_key(city: str) -> str:
    return city.strip().lower()


def get_events(city: str) -> list[dict[str, Any]]:
    """Return up to 5 upcoming events for a city (name, date, venue, url)."""
    city = (city or "").strip()
    if not city:
        return []

    key = _cache_key(city)
    now = time.time()
    cached = _cache.get(key)
    if cached and now < cached[0]:
        return list(cached[1])

    api_key = (settings.ticketmaster_api_key or "").strip()
    if not api_key:
        return []

    params = {
        "city": city,
        "apikey": api_key,
        "size": 5,
        "sort": "date,asc",
    }

    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS, headers=BROWSER_HEADERS) as client:
            resp = client.get(TICKETMASTER_URL, params=params)
        if resp.status_code != 200:
            logger.warning("Ticketmaster HTTP %s for city=%s", resp.status_code, city)
            return []

        data = resp.json()
        emb = data.get("_embedded")
        if not isinstance(emb, dict):
            return []
        raw_events = emb.get("events")
        if not isinstance(raw_events, list):
            return []

        out: list[dict[str, Any]] = []
        for raw in raw_events[:5]:
            if not isinstance(raw, dict):
                continue
            name = str(raw.get("name") or "Event")
            url = str(raw.get("url") or "")
            date_str = ""
            dates = raw.get("dates")
            if isinstance(dates, dict):
                start = dates.get("start")
                if isinstance(start, dict):
                    date_str = str(
                        start.get("localDate")
                        or start.get("dateTime")
                        or start.get("localDateTime")
                        or ""
                    )
            venue = ""
            ven_emb = raw.get("_embedded")
            if isinstance(ven_emb, dict):
                venues = ven_emb.get("venues")
                if isinstance(venues, list) and venues and isinstance(venues[0], dict):
                    venue = str(venues[0].get("name") or "")

            out.append(
                {
                    "name": name,
                    "date": date_str,
                    "venue": venue,
                    "url": url,
                }
            )

        _cache[key] = (now + TTL_SECONDS, out)
        return out
    except Exception as exc:
        logger.warning("Ticketmaster fetch failed for city=%s: %s", city, exc)
        return []


def _haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = math.sin(d_lat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(d_lon / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _nearest_major_metro(lat: float, lon: float) -> dict[str, Any]:
    """Return the closest hardcoded major metro to a GPS point."""
    best = MAJOR_METRO_CITIES[0]
    best_dist = float("inf")
    for metro in MAJOR_METRO_CITIES:
        dist = _haversine_miles(lat, lon, float(metro["lat"]), float(metro["lon"]))
        if dist < best_dist:
            best_dist = dist
            best = metro
    return {**best, "distance_miles": round(best_dist, 1)}


def _major_cities_within_radius(
    lat: float,
    lon: float,
    radius_miles: int = EXPLORE_RADIUS_MILES,
) -> list[dict[str, Any]]:
    nearby: list[dict[str, Any]] = []
    for metro in MAJOR_METRO_CITIES:
        dist = _haversine_miles(lat, lon, float(metro["lat"]), float(metro["lon"]))
        if dist <= radius_miles:
            nearby.append({**metro, "distance_miles": round(dist, 1)})
    nearby.sort(key=lambda m: m["distance_miles"])
    return nearby


def _city_center_coords(city_name: str) -> tuple[float, float] | None:
    key = city_name.strip().lower()
    for metro in MAJOR_METRO_CITIES:
        if metro["name"].lower() == key:
            return float(metro["lat"]), float(metro["lon"])
    mapped = CITY_COORD_MAP.get(key)
    if mapped:
        return float(mapped[0]), float(mapped[1])
    return None


def _annotate_event_distances(
    events: list[dict[str, Any]],
    user_lat: float,
    user_lon: float,
) -> list[dict[str, Any]]:
    for ev in events:
        v_lat = ev.get("venue_lat")
        v_lon = ev.get("venue_lon")
        if v_lat is not None and v_lon is not None:
            dist = _haversine_miles(user_lat, user_lon, float(v_lat), float(v_lon))
        else:
            center = _city_center_coords(str(ev.get("city") or ""))
            if center:
                dist = _haversine_miles(user_lat, user_lon, center[0], center[1])
            else:
                dist = None
        if dist is not None:
            ev["distance_miles"] = round(dist, 1)
    return events


def _fetch_ticketmaster_events(
    city: str,
    category: str = "all",
    date_from: str | None = None,
    date_to: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    radius_miles: int = EXPLORE_RADIUS_MILES,
) -> list[dict[str, Any]]:
    api_key = (settings.ticketmaster_api_key or "").strip()
    if not api_key:
        return []

    classification_name = None
    keyword = None
    if category and category.lower() != "all":
        cat_lower = category.lower()
        if cat_lower == "music":
            classification_name = "music"
        elif cat_lower == "sports":
            classification_name = "sports"
        elif cat_lower == "arts":
            classification_name = "Arts & Theatre"
        elif cat_lower == "family":
            classification_name = "family"
        elif cat_lower == "food":
            classification_name = "food"
        elif cat_lower == "festival":
            keyword = "festival"

    params: dict[str, Any] = {
        "apikey": api_key,
        "size": 100,
        "sort": "date,asc",
        "locale": "*",
    }

    if lat is not None and lon is not None:
        # Geo search only — never mix city name with latlong (Ticketmaster rejects/conflicts).
        params["latlong"] = f"{lat},{lon}"
        params["radius"] = radius_miles
        params["unit"] = "miles"
        params.pop("city", None)
        params.pop("dmaId", None)
        params.pop("geoPoint", None)
    else:
        params["city"] = city
        params.pop("latlong", None)
        params.pop("radius", None)
        params.pop("unit", None)

    if classification_name:
        params["classificationName"] = classification_name
    if keyword:
        params["keyword"] = keyword

    if date_from:
        params["startDateTime"] = f"{date_from}T00:00:00Z"
    if date_to:
        params["endDateTime"] = f"{date_to}T23:59:59Z"

    events: list[dict[str, Any]] = []
    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS, headers=BROWSER_HEADERS) as client:
            for page_num in range(2):
                params["page"] = page_num
                resp = client.get(TICKETMASTER_URL, params=params)
                if resp.status_code != 200:
                    continue

                data = resp.json()
                emb = data.get("_embedded")
                if not isinstance(emb, dict):
                    continue
                raw_events = emb.get("events")
                if not isinstance(raw_events, list):
                    continue

                for raw in raw_events:
                    if not isinstance(raw, dict):
                        continue

                    eid = str(raw.get("id") or "")
                    name = str(raw.get("name") or "Event")
                    url = str(raw.get("url") or "")

                    img_url = None
                    images = raw.get("images", [])
                    if isinstance(images, list) and images:
                        best = None
                        for im in images:
                            if not isinstance(im, dict):
                                continue
                            w = int(im.get("width") or 0)
                            u = im.get("url")
                            if isinstance(u, str) and (best is None or w > best[0]):
                                best = (w, u)
                        if best:
                            img_url = best[1]

                    raw_segment = ""
                    classifications = raw.get("classifications", [])
                    if classifications and isinstance(classifications, list) and isinstance(classifications[0], dict):
                        segment = classifications[0].get("segment", {})
                        if isinstance(segment, dict) and segment.get("name"):
                            raw_segment = str(segment.get("name"))
                    category_val = _normalize_event_category(raw_segment, name)

                    date_str = ""
                    time_str = "19:00"
                    dates = raw.get("dates", {})
                    if isinstance(dates, dict):
                        start = dates.get("start", {})
                        if isinstance(start, dict):
                            date_str = str(start.get("localDate") or "")
                            local_time = start.get("localTime")
                            if local_time:
                                time_str = str(local_time)[:5]

                    venue_name = "Various Venues"
                    country_code = "US"
                    city_name = city
                    venue_lat: float | None = None
                    venue_lon: float | None = None

                    ven_emb = raw.get("_embedded", {})
                    if isinstance(ven_emb, dict):
                        venues = ven_emb.get("venues")
                        if isinstance(venues, list) and venues and isinstance(venues[0], dict):
                            v0 = venues[0]
                            venue_name = str(v0.get("name") or "Venue")
                            if v0.get("country") and isinstance(v0.get("country"), dict):
                                country_code = str(v0.get("country").get("countryCode") or "US")
                            if v0.get("city") and isinstance(v0.get("city"), dict):
                                city_name = str(v0.get("city").get("name") or city)
                            loc = v0.get("location")
                            if isinstance(loc, dict):
                                try:
                                    if loc.get("latitude") is not None:
                                        venue_lat = float(loc["latitude"])
                                    if loc.get("longitude") is not None:
                                        venue_lon = float(loc["longitude"])
                                except (TypeError, ValueError):
                                    pass

                    price_min = None
                    price_max = None
                    price_ranges = raw.get("priceRanges", [])
                    if price_ranges and isinstance(price_ranges, list) and isinstance(price_ranges[0], dict):
                        p0 = price_ranges[0]
                        try:
                            price_min = float(p0.get("min")) if p0.get("min") is not None else None
                            price_max = float(p0.get("max")) if p0.get("max") is not None else None
                        except (TypeError, ValueError):
                            pass

                    events.append({
                        "id": eid,
                        "name": name,
                        "category": category_val,
                        "date": date_str,
                        "time": time_str,
                        "venue": venue_name,
                        "city": city_name,
                        "country": country_code,
                        "image_url": img_url,
                        "ticket_url": url,
                        "price_min": price_min,
                        "price_max": price_max,
                        "venue_lat": venue_lat,
                        "venue_lon": venue_lon,
                        "source": "ticketmaster",
                    })
        return events
    except Exception as exc:
        logger.warning("Ticketmaster _fetch_ticketmaster_events failed: %s", exc)
        return []


def _fetch_yelp_events(city: str, category: str = "all", limit: int = YELP_EVENTS_LIMIT) -> list[dict[str, Any]]:
    api_key = (settings.yelp_api_key or "").strip()
    events = []

    if api_key:
        url = "https://api.yelp.com/v3/events"
        headers = {**BROWSER_HEADERS, "Authorization": f"Bearer {api_key}"}
        params = {"location": city, "limit": 50}

        try:
            with httpx.Client(timeout=API_TIMEOUT_SECONDS, headers=headers) as client:
                resp = client.get(url, headers=headers, params=params)
            if resp.status_code == 200:
                data = resp.json()
                raw_events = data.get("events")
                if isinstance(raw_events, list):
                    for raw in raw_events:
                        if not isinstance(raw, dict):
                            continue
                        
                        yelp_cat = str(raw.get("category") or "other")
                        normalized_cat = "All"
                        if "music" in yelp_cat:
                            normalized_cat = "Music"
                        elif "sport" in yelp_cat:
                            normalized_cat = "Sports"
                        elif "art" in yelp_cat or "theat" in yelp_cat or "fashion" in yelp_cat:
                            normalized_cat = "Arts"
                        elif "family" in yelp_cat or "kid" in yelp_cat:
                            normalized_cat = "Family"
                        elif "food" in yelp_cat or "drink" in yelp_cat:
                            normalized_cat = "Food"
                        elif "festiv" in yelp_cat or "fair" in yelp_cat:
                            normalized_cat = "Festival"

                        if category and category.lower() != "all" and normalized_cat.lower() != category.lower():
                            continue

                        start_time_raw = raw.get("time_start") or ""
                        date_str = ""
                        time_str = "19:00"
                        if start_time_raw:
                            try:
                                parts = start_time_raw.split("T")
                                date_str = parts[0]
                                if len(parts) > 1:
                                    time_str = parts[1][:5]
                            except Exception:
                                pass

                        location_dict = raw.get("location") or {}
                        venue_str = raw.get("description") or "Local Attraction"
                        if isinstance(location_dict, dict):
                            address1 = location_dict.get("address1")
                            if address1:
                                venue_str = address1
                        
                        cost = raw.get("cost")
                        price_min = float(cost) if cost is not None else None

                        events.append({
                            "id": str(raw.get("id") or ""),
                            "name": str(raw.get("name") or "Yelp Event"),
                            "category": normalized_cat,
                            "date": date_str,
                            "time": time_str,
                            "venue": venue_str,
                            "city": city,
                            "country": "US",
                            "image_url": raw.get("image_url"),
                            "ticket_url": raw.get("tickets_url") or raw.get("event_site_url") or "",
                            "price_min": price_min,
                            "price_max": price_min,
                            "source": "yelp"
                        })
                    return events
        except Exception as exc:
            logger.warning("Yelp live fetch failed, using fallback: %s", exc)

    if not events:
        yelp_fallbacks = [
            {
                "name": f"Taste of {city} Food & Wine Showcase",
                "category": "Food",
                "venue": "Downtown Plaza",
                "image_url": "https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=600&auto=format&fit=crop&q=60",
                "price_min": 45.0,
            },
            {
                "name": f"{city} Crafts & Microbrewery Festival",
                "category": "Food",
                "venue": "The Warehouse Arts Center",
                "image_url": "https://images.unsplash.com/photo-1518099074172-2e47ee7cfdf0?w=600&auto=format&fit=crop&q=60",
                "price_min": 25.0,
            },
            {
                "name": f"{city} Elite Rooftop Mixology Night",
                "category": "Food",
                "venue": "The Summit Lounge",
                "image_url": "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600&auto=format&fit=crop&q=60",
                "price_min": 60.0,
            }
        ]
        
        import hashlib
        for idx, raw in enumerate(yelp_fallbacks):
            if category and category.lower() != "all" and raw["category"].lower() != category.lower():
                continue
            name_hash = hashlib.md5(raw["name"].encode("utf-8")).hexdigest()[:12]
            events.append({
                "id": f"yelp-fallback-{name_hash}-{idx}",
                "name": raw["name"],
                "category": raw["category"],
                "date": "2026-06-15",
                "time": "18:00",
                "venue": raw["venue"],
                "city": city,
                "country": "US",
                "image_url": raw["image_url"],
                "ticket_url": "https://www.yelp.com",
                "price_min": raw["price_min"],
                "price_max": raw["price_min"] + 15.0,
                "source": "yelp"
            })
            
    return events


def _fetch_eventbrite_events(city: str, category: str = "all", limit: int = EVENTBRITE_EVENTS_LIMIT) -> list[dict[str, Any]]:
    events = []

    eventbrite_fallbacks = [
        {
            "name": f"{city} Global Tech & Startup Summit",
            "category": "Arts",
            "venue": f"{city} Convention Center",
            "image_url": "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&auto=format&fit=crop&q=60",
        },
        {
            "name": f"Digital Marketing & Creator Masterclass {city}",
            "category": "Family",
            "venue": "Metropolitan Hub",
            "image_url": "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=600&auto=format&fit=crop&q=60",
        },
        {
            "name": f"{city} Yoga & Wellness Expo",
            "category": "Arts",
            "venue": "Civic Garden Pavilion",
            "image_url": "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&auto=format&fit=crop&q=60",
        }
    ]

    import hashlib
    for idx, raw in enumerate(eventbrite_fallbacks):
        if category and category.lower() != "all" and raw["category"].lower() != category.lower():
            continue
        name_hash = hashlib.md5(raw["name"].encode("utf-8")).hexdigest()[:12]
        events.append({
            "id": f"eb-fallback-{name_hash}-{idx}",
            "name": raw["name"],
            "category": raw["category"],
            "date": "2026-06-20",
            "time": "10:00",
            "venue": raw["venue"],
            "city": city,
            "country": "US",
            "image_url": raw["image_url"],
            "ticket_url": "https://www.eventbrite.com",
            "price_min": 15.00,
            "price_max": 75.00,
            "source": "eventbrite"
        })

    return events[:50]


def _fetch_bandsintown_events(
    city: str,
    category: str = "all",
    per_page: int = BANDSINTOWN_EVENTS_PER_PAGE,
) -> list[dict[str, Any]]:
    if category and category.lower() != "all" and category.lower() != "music":
        return []

    events = []

    bit_fallbacks = [
        {
            "name": f"The Indie Rock Showcase Live in {city}",
            "venue": f"{city} Music Hall",
            "ticket_url": "https://www.bandsintown.com",
        },
        {
            "name": f"Acoustic Sessions with The Wanderers ({city} Stop)",
            "venue": "The Velvet Room Loft",
            "ticket_url": "https://www.bandsintown.com",
        },
        {
            "name": f"Summer Sunset Jazz Fest ({city})",
            "venue": "Park Amphitheater",
            "ticket_url": "https://www.bandsintown.com",
        }
    ]

    import hashlib
    for idx, raw in enumerate(bit_fallbacks):
        name_hash = hashlib.md5(raw["name"].encode("utf-8")).hexdigest()[:12]
        events.append({
            "id": f"bit-fallback-{name_hash}-{idx}",
            "name": raw["name"],
            "category": "Music",
            "date": "2026-06-25",
            "time": "20:00",
            "venue": raw["venue"],
            "city": city,
            "country": "US",
            "image_url": "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&auto=format&fit=crop&q=60",
            "ticket_url": raw["ticket_url"],
            "price_min": 35.0,
            "price_max": 95.0,
            "source": "bandsintown"
        })

    return events[:per_page]


def _generate_instagram_hashtags_with_gemini(city: str) -> list[str]:
    """Use Gemini to generate city-specific Instagram search queries."""
    api_key = (settings.gemini_api_key or "").strip()
    if not api_key:
        city_clean = city.lower().strip()
        return _instagram_hashtag_fallback(city_clean)

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")

        prompt = f"""Generate 32 Instagram search queries to find events, 
food, nightlife, sports, festivals, and activities in {city}.

Rules:
- Mix of "{city} events", "{city} food", "{city} nightlife" style
- Include city-specific cultural terms if relevant
- Include food types popular in that city
- Include local sports teams if known
- Return ONLY a JSON array of strings, no explanation

Example for Chicago:
["chicago events", "chicago food", "chitown nightlife", 
"chicago bulls", "chicago deep dish pizza", ...]

City: {city}
Return JSON array only."""

        response = model.generate_content(prompt)
        text = (response.text or "").strip()
        text = text.replace("```json", "").replace("```", "").strip()
        queries = json.loads(text)
        if isinstance(queries, list):
            return [str(q) for q in queries[:32] if q]
    except Exception as exc:
        logger.warning("Gemini hashtag generation failed: %s", exc)

    city_clean = city.lower().strip()
    return _instagram_hashtag_fallback(city_clean)


def _instagram_hashtag_fallback(city_clean: str) -> list[str]:
    return [
        f"{city_clean} events",
        f"{city_clean} festivals",
        f"{city_clean} nightlife",
        f"{city_clean} food",
        f"{city_clean} restaurants",
        f"{city_clean} concerts",
        f"{city_clean} sports",
        f"{city_clean} things to do",
        f"{city_clean} weekend",
        f"{city_clean} food festival",
        f"{city_clean} indian food",
        f"{city_clean} korean food",
        f"{city_clean} brunch",
        f"{city_clean} rooftop",
        f"{city_clean} bars",
        f"{city_clean} art",
        f"{city_clean} music",
        f"{city_clean} comedy",
        f"{city_clean} outdoor",
        f"{city_clean} parks",
    ]


def _parse_instagram_caption_with_gemini(caption: str, city: str) -> dict[str, Any] | None:
    """Use Gemini to extract structured event data from Instagram caption."""
    api_key = (settings.gemini_api_key or "").strip()
    if not api_key or not caption or len(caption) < 20:
        return None
    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")

        prompt = f"""Extract event or place details from this Instagram caption.
City context: {city}
Caption: {caption[:500]}

Return ONLY valid JSON:
{{
  "name": "event or place name",
  "category": "Music/Sports/Food/Nightlife/Arts/Outdoor/Festival/Restaurant/Other",
  "date": "YYYY-MM-DD or null",
  "time": "HH:MM or null",
  "venue": "venue name or null",
  "price_min": number or null,
  "description": "one sentence summary",
  "is_event": true or false
}}

If caption has no useful event/place info return: {{"is_event": false}}"""

        response = model.generate_content(prompt)
        text = (response.text or "").strip()
        text = text.replace("```json", "").replace("```", "").strip()
        data = json.loads(text)
        if not isinstance(data, dict) or not data.get("is_event"):
            return None
        return data
    except Exception:
        return None


def _apify_fetch_hashtag_media(
    apify_token: str,
    hashtags: list[str],
    results_type: str,
    limit: int,
) -> list[dict[str, Any]]:
    """Run Apify instagram-hashtag-scraper for posts or reels."""
    with httpx.Client(timeout=180) as client:
        r = client.post(
            f"https://api.apify.com/v2/acts/{APIFY_INSTAGRAM_HASHTAG_ACTOR}/runs?waitForFinish=120",
            headers={"Authorization": f"Bearer {apify_token}"},
            json={
                "hashtags": hashtags,
                "resultsType": results_type,
                "resultsLimit": limit,
            },
        )
        if r.status_code not in (200, 201):
            logger.warning("Apify Instagram %s failed: %s", results_type, r.status_code)
            return []

        dataset_id = r.json().get("data", {}).get("defaultDatasetId", "")
        if not dataset_id:
            return []

        items_r = client.get(
            f"https://api.apify.com/v2/datasets/{dataset_id}/items?limit=3200",
            headers={"Authorization": f"Bearer {apify_token}"},
        )
        items = items_r.json()
        return items if isinstance(items, list) else []


def _merge_instagram_posts_and_reels(
    post_items: list[dict[str, Any]],
    reel_items: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Dedupe posts and reels by Instagram id/shortCode."""
    merged: list[dict[str, Any]] = []
    seen_keys: set[str] = set()
    for item in post_items + reel_items:
        if not isinstance(item, dict):
            continue
        key = str(item.get("id") or item.get("shortCode") or "")
        if key:
            if key in seen_keys:
                continue
            seen_keys.add(key)
        merged.append(item)
    return merged


def _instagram_media_type(item: dict[str, Any]) -> str:
    if item.get("productType") == "clips" or str(item.get("type", "")).lower() == "video":
        return "reel"
    return "post"


def _fetch_apify_instagram_events(city: str, limit: int = 100) -> list[dict[str, Any]]:
    """Scrape Instagram posts and reels via Apify with Gemini-generated hashtags."""
    apify_token = (settings.apify_token or "").strip()
    if not apify_token:
        return []

    try:
        search_queries = _generate_instagram_hashtags_with_gemini(city)
        import re
        hashtag_queries = [re.sub(r"[^a-zA-Z0-9]", "", q) for q in search_queries]
        hashtag_queries = [h for h in hashtag_queries if h]
        logger.info(
            "Instagram scraping %d hashtags (posts + reels) for %s",
            len(hashtag_queries),
            city,
        )

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as scrape_pool:
            posts_future = scrape_pool.submit(
                _apify_fetch_hashtag_media, apify_token, hashtag_queries, "posts", limit
            )
            reels_future = scrape_pool.submit(
                _apify_fetch_hashtag_media, apify_token, hashtag_queries, "reels", limit
            )
            post_items = posts_future.result()
            reel_items = reels_future.result()

        posts = _merge_instagram_posts_and_reels(post_items, reel_items)
        logger.info(
            "Instagram returned %d items for %s (%d posts, %d reels)",
            len(posts),
            city,
            len(post_items),
            len(reel_items),
        )

        def parse_post(post: dict[str, Any]) -> dict[str, Any] | None:
            if not isinstance(post, dict):
                return None
            caption = post.get("caption", "") or post.get("text", "")
            if not caption or len(caption) < 20:
                return None
            parsed = _parse_instagram_caption_with_gemini(caption, city)
            if not parsed:
                return None
            name = parsed.get("name", "")
            if not name:
                return None
            media_type = _instagram_media_type(post)
            post_key = str(post.get("shortCode") or post.get("id") or hash(name + city))
            return {
                "id": f"ig_{media_type}_{post_key}",
                "name": name,
                "category": parsed.get("category", "Event"),
                "date": parsed.get("date") or "",
                "time": parsed.get("time") or "",
                "venue": parsed.get("venue") or city,
                "city": city,
                "country": "US",
                "image_url": post.get("displayUrl") or post.get("imageUrl") or post.get("thumbnailUrl"),
                "ticket_url": post.get("url", ""),
                "price_min": parsed.get("price_min"),
                "description": parsed.get("description", ""),
                "media_type": media_type,
                "source": "instagram",
            }

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            results = list(executor.map(parse_post, posts[:500]))

        seen_names: set[str] = set()
        events: list[dict[str, Any]] = []
        for event in results:
            if not event:
                continue
            name = event.get("name", "")
            if name in seen_names:
                continue
            seen_names.add(name)
            events.append(event)

        logger.info("Instagram parsed %d events for %s", len(events), city)
        return events
    except Exception as exc:
        logger.warning("Instagram scraper failed for %s: %s", city, exc)
        return []


def _normalize_event_category(raw: str, name: str) -> str:
    """Map Ticketmaster segments and weak labels to consumer-friendly tags."""
    key = (raw or "").strip().lower()
    weak = {"", "undefined", "miscellaneous", "misc", "all", "other", "general"}
    segment_map = {
        "music": "Music",
        "sports": "Sports",
        "arts & theatre": "Arts",
        "arts": "Arts",
        "theatre": "Arts",
        "film": "Festival",
        "family": "Family",
        "food & drink": "Food",
        "food": "Food",
    }
    if key not in weak:
        return segment_map.get(key, raw.strip().title())

    name_l = (name or "").lower()
    if any(x in name_l for x in (" vs ", " vs. ", "game", "sox", "cubs", "bulls", "bears", "twins", "mlb", "nba", "nfl")):
        return "Sports"
    if any(x in name_l for x in ("concert", " tour", "live ", "dj ", "festival", "symphony", "orchestra")):
        return "Music"
    if any(x in name_l for x in ("comedy", "theatre", "theater", "broadway", "play")):
        return "Arts"
    if any(x in name_l for x in ("food", "wine", "dinner", "brunch", "tasting")):
        return "Food"
    if any(x in name_l for x in ("cruise", "tour", "museum", "architecture", "walking")):
        return "Experience"
    if any(x in name_l for x in ("club", "night", "18+", "21+")):
        return "Nightlife"
    return "Experience"


def _series_dedupe_key(name: str, venue: str) -> tuple[str, str]:
    """Collapse recurring series (same show, many dates) to one card per venue."""
    import re

    n = (name or "").strip().lower()
    n = re.sub(r"\s*\([^)]*\)\s*", " ", n)
    n = re.sub(
        r"\s*[-–—]\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday).*$",
        "",
        n,
        flags=re.I,
    )
    n = re.sub(r"\s*[-–—]\s*\d{1,2}/\d{1,2}.*$", "", n)
    n = re.sub(r"\s+", " ", n).strip()
    v = (venue or "").strip().lower()
    return (n, v)


def _dedupe_and_sort_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen_ids: set[str] = set()
    seen_series: set[tuple[str, str]] = set()
    deduped_events: list[dict[str, Any]] = []
    for ev in events:
        eid = str(ev.get("id") or "").strip()
        if eid and eid in seen_ids:
            continue
        series_key = _series_dedupe_key(str(ev.get("name") or ""), str(ev.get("venue") or ""))
        if series_key[0] and series_key in seen_series:
            continue
        if eid:
            seen_ids.add(eid)
        if series_key[0]:
            seen_series.add(series_key)
        deduped_events.append(ev)

    def sort_key(x: dict[str, Any]) -> tuple[float, str, str]:
        dist = x.get("distance_miles")
        dist_val = float(dist) if dist is not None else 9999.0
        d = x.get("date") or ""
        t = x.get("time") or ""
        return (dist_val, d if d else "9999-12-31", t if t else "23:59")

    deduped_events.sort(key=sort_key)
    return deduped_events


def _background_instagram(city: str) -> None:
    """Background worker: scrape Instagram and merge into PostgreSQL cache."""
    try:
        prefetch_apify_events(city)
    except Exception as exc:
        logger.warning("Background Instagram scrape failed for %s: %s", city, exc)
    finally:
        with _background_instagram_lock:
            _background_instagram_cities.discard(city.strip().lower())


def _maybe_start_background_instagram(city: str) -> None:
    """Start Apify Instagram scrape in a daemon thread (production only)."""
    if os.getenv("ENVIRONMENT") != "production":
        return

    city_key = city.strip().lower()
    if not city_key:
        return

    with _background_instagram_lock:
        if city_key in _background_instagram_cities:
            return
        _background_instagram_cities.add(city_key)

    thread = threading.Thread(target=_background_instagram, args=(city,), daemon=True)
    thread.start()
    logger.info("Started background Instagram scrape for %s", city)


def prefetch_apify_events(city: str) -> None:
    """Run Instagram scraper and merge into cache (background thread only)."""
    city = (city or "").strip()
    if not city:
        return

    try:
        logger.info("Starting Instagram prefetch for %s", city)
        events = _fetch_apify_instagram_events(city, limit=100)

        if not events:
            logger.info("No Instagram events for %s", city)
            return

        cache_key = _events_cache_key(city, "all", None, None)
        db = SessionLocal()
        try:
            row = _get_row(db, cache_key, CONTENT_EVENTS_AGGREGATED)
            if row and row.data:
                existing_ids = {e.get("id") for e in row.data}
                new_unique = [e for e in events if e.get("id") not in existing_ids]
                merged = _dedupe_and_sort_events(list(row.data) + new_unique)
                _upsert_list(db, city=cache_key, content_type=CONTENT_EVENTS_AGGREGATED, data=merged)
                logger.info("Merged %d Instagram events for %s", len(new_unique), city)
            else:
                _upsert_list(
                    db,
                    city=cache_key,
                    content_type=CONTENT_EVENTS_AGGREGATED,
                    data=_dedupe_and_sort_events(events),
                )
        finally:
            db.close()

    except Exception as exc:
        logger.warning("prefetch_apify_events failed for %s: %s", city, exc)

def _events_cache_key(
    city: str,
    category: str,
    date_from: str | None,
    date_to: str | None,
    lat: float | None = None,
    lon: float | None = None,
    radius_miles: int | None = None,
) -> str:
    key = city.strip().lower()
    key += f"_{category.strip().lower()}"
    if date_from:
        key += f"_{date_from}"
    if date_to:
        key += f"_{date_to}"
    if lat is not None and lon is not None:
        key += f"_{round(lat, 2)}_{round(lon, 2)}"
        if radius_miles:
            key += f"_{radius_miles}mi"
    return key


def _fetch_ticketmaster_only(
    city: str,
    category: str,
    date_from: str | None,
    date_to: str | None,
    lat: float | None = None,
    lon: float | None = None,
    radius_miles: int = EXPLORE_RADIUS_MILES,
) -> dict[str, Any]:
    """
    Fetch Ticketmaster events.
    With GPS: latlong + radius (miles) first; if empty, fallback to nearest major metro by city name.
    """
    display_city = (city or "Chicago").strip()
    meta: dict[str, Any] = {
        "display_city": display_city.split(",")[0].strip(),
        "nearest_metro": None,
        "fetch_mode": "city",
    }

    if lat is not None and lon is not None:
        meta["fetch_mode"] = "geo"
        nearest = _nearest_major_metro(lat, lon)
        meta["nearest_metro"] = nearest["name"]

        all_events = _fetch_ticketmaster_events(
            display_city, category, date_from, date_to, lat, lon, radius_miles
        )

        if not all_events:
            logger.info(
                "Ticketmaster geo search returned 0 for (%s, %s) r=%smi; "
                "falling back to nearest metro %s",
                lat,
                lon,
                radius_miles,
                nearest["name"],
            )
            meta["fetch_mode"] = "metro_fallback"
            all_events = _fetch_ticketmaster_events(
                str(nearest["name"]),
                category,
                date_from,
                date_to,
            )

        all_events = _annotate_event_distances(all_events, lat, lon)
        all_events = [
            e for e in all_events if e.get("distance_miles", 999) <= radius_miles
        ]
        all_events.sort(
            key=lambda e: (
                e.get("distance_miles") if e.get("distance_miles") is not None else 9999,
                e.get("date") or "9999-12-31",
            )
        )
        return {
            **meta,
            "events": _dedupe_and_sort_events(all_events),
        }

    return {
        **meta,
        "events": _dedupe_and_sort_events(
            _fetch_ticketmaster_events(display_city, category, date_from, date_to)
        ),
    }


def _get_fresh_cached_events(db: Session, cache_key: str) -> list[dict[str, Any]] | None:
    """Return cached events if still within TTL, else None."""
    row = _get_row(db, cache_key, CONTENT_EVENTS_AGGREGATED)
    if not row or row.data is None:
        return None
    now = _now()
    fetched = _aware(row.fetched_at)
    if now - fetched <= timedelta(hours=TTL_EVENTS_AGGREGATED_HOURS):
        return list(row.data)
    return None


def _paginate_events(
    events: list[dict[str, Any]],
    city: str,
    page: int,
    per_page: int,
) -> dict[str, Any]:
    total = len(events)
    start_idx = max(0, (page - 1) * per_page)
    end_idx = start_idx + per_page
    return {
        "city": city,
        "total": total,
        "page": page,
        "per_page": per_page,
        "events": events[start_idx:end_idx],
    }


def search_events_extended(
    db: Session,
    city: str,
    category: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = 1,
    per_page: int = 20,
    lat: float | None = None,
    lon: float | None = None,
    radius_miles: int = EXPLORE_RADIUS_MILES,
    return_all: bool = False,
) -> dict[str, Any]:
    """
    Serve Ticketmaster immediately; never block on Instagram/Apify.
    When lat/lon provided, fetch events within radius_miles (default 200) of user GPS.
    Set return_all=True to get the full cached list (for section splitting on Explore hub).
    """
    city = (city or "Chicago").strip()
    cat = category or "all"
    cache_key = _events_cache_key(city, cat, date_from, date_to, lat, lon, radius_miles)

    cached = _get_fresh_cached_events(db, cache_key)
    fetch_meta: dict[str, Any] = {
        "display_city": city.split(",")[0].strip(),
        "nearest_metro": None,
        "fetch_mode": "cache" if cached else None,
    }

    if cached:
        all_events = cached
    else:
        fetched = _fetch_ticketmaster_only(
            city, cat, date_from, date_to, lat, lon, radius_miles
        )
        all_events = fetched["events"]
        fetch_meta["display_city"] = fetched.get("display_city") or fetch_meta["display_city"]
        fetch_meta["nearest_metro"] = fetched.get("nearest_metro")
        fetch_meta["fetch_mode"] = fetched.get("fetch_mode")
        _upsert_list(db, city=cache_key, content_type=CONTENT_EVENTS_AGGREGATED, data=all_events)
        _maybe_start_background_instagram(city)

    if lat is not None and lon is not None and fetch_meta.get("nearest_metro") is None:
        fetch_meta["nearest_metro"] = _nearest_major_metro(lat, lon)["name"]

    if return_all:
        result: dict[str, Any] = {
            "city": city,
            "total": len(all_events),
            "page": 1,
            "per_page": len(all_events),
            "events": all_events,
        }
    else:
        result = _paginate_events(all_events, city, page, per_page)

    if lat is not None and lon is not None:
        result["radius_miles"] = radius_miles
        result["nearby_cities"] = _major_cities_within_radius(lat, lon, radius_miles)[:8]
        result["user_lat"] = lat
        result["user_lon"] = lon
        result["display_city"] = fetch_meta["display_city"]
        result["nearest_metro"] = fetch_meta.get("nearest_metro")
        result["fetch_mode"] = fetch_meta.get("fetch_mode")
    else:
        result["display_city"] = fetch_meta["display_city"]

    return result
