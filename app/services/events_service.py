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
