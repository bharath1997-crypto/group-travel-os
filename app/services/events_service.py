"""
Ticketmaster Discovery API — city events for travel intel.

In-memory TTL cache (6 hours). Returns empty list on failure.
"""
from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from app.core.api_limits import API_TIMEOUT_SECONDS
from config import settings

logger = logging.getLogger(__name__)

TICKETMASTER_URL = "https://app.ticketmaster.com/discovery/v2/events.json"
TTL_SECONDS = 21_600  # 6 hours

_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}


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
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
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


def search_events_extended(
    city: str,
    category: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> dict[str, Any]:
    """
    Enhanced search query targeting Ticketmaster Discovery API.
    Supports filtering by category, date range, and pagination.
    """
    city = (city or "Chicago").strip()
    api_key = (settings.ticketmaster_api_key or "").strip()
    
    if not api_key:
        return {"city": city, "total": 0, "page": page, "per_page": per_page, "events": []}

    # Map categories to Ticketmaster classifications
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
        "city": city,
        "apikey": api_key,
        "size": per_page,
        "page": max(0, page - 1),  # Ticketmaster is 0-indexed
        "sort": "date,asc",
    }

    if classification_name:
        params["classificationName"] = classification_name
    if keyword:
        params["keyword"] = keyword

    # Build date boundaries
    if date_from:
        params["startDateTime"] = f"{date_from}T00:00:00Z"
    if date_to:
        params["endDateTime"] = f"{date_to}T23:59:59Z"

    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            resp = client.get(TICKETMASTER_URL, params=params)
        
        if resp.status_code != 200:
            logger.warning("Ticketmaster extended search failed with status=%s", resp.status_code)
            return {"city": city, "total": 0, "page": page, "per_page": per_page, "events": []}

        data = resp.json()
        total_elements = data.get("page", {}).get("totalElements", 0)
        
        emb = data.get("_embedded")
        if not isinstance(emb, dict):
            return {"city": city, "total": total_elements, "page": page, "per_page": per_page, "events": []}
            
        raw_events = emb.get("events")
        if not isinstance(raw_events, list):
            return {"city": city, "total": total_elements, "page": page, "per_page": per_page, "events": []}

        events: list[dict[str, Any]] = []
        for raw in raw_events:
            if not isinstance(raw, dict):
                continue
            
            eid = str(raw.get("id") or "")
            name = str(raw.get("name") or "Event")
            url = str(raw.get("url") or "")
            
            # Select best image
            img_url = None
            images = raw.get("images", [])
            if isinstance(images, list) and images:
                best: tuple[int, str] | None = None
                for im in images:
                    if not isinstance(im, dict):
                        continue
                    w = int(im.get("width") or 0)
                    u = im.get("url")
                    if isinstance(u, str) and (best is None or w > best[0]):
                        best = (w, u)
                if best:
                    img_url = best[1]

            # Category extraction
            category_val = "All"
            classifications = raw.get("classifications", [])
            if classifications and isinstance(classifications, list) and isinstance(classifications[0], dict):
                segment = classifications[0].get("segment", {})
                if isinstance(segment, dict) and segment.get("name"):
                    category_val = str(segment.get("name"))

            # Dates & Times
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

            # Venue details
            venue_name = "Various Venues"
            country_code = "US"
            city_name = city
            
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

            # Prices range
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
                "source": "ticketmaster"
            })

        return {
            "city": city,
            "total": total_elements,
            "page": page,
            "per_page": per_page,
            "events": events
        }
    except Exception as exc:
        logger.warning("Ticketmaster search_events_extended failed: %s", exc)
        return {"city": city, "total": 0, "page": page, "per_page": per_page, "events": []}

