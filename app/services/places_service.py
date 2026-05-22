"""
Google Places Text Search — top tourist attractions for a city.

In-memory TTL cache (24 hours). Returns empty list on failure.
"""
from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from app.core.api_limits import API_TIMEOUT_SECONDS
from config import settings

logger = logging.getLogger(__name__)

PLACES_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
TTL_SECONDS = 86_400  # 24 hours

_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}


def _cache_key(city: str) -> str:
    return city.strip().lower()


def get_places(city: str) -> list[dict[str, Any]]:
    """Return up to 5 places with name, rating, address, photo_reference."""
    city = (city or "").strip()
    if not city:
        return []

    key = _cache_key(city)
    now = time.time()
    cached = _cache.get(key)
    if cached and now < cached[0]:
        return list(cached[1])

    api_key = (settings.google_places_api_key or "").strip()
    if not api_key:
        return []

    params = {
        "query": f"{city} tourist attractions",
        "key": api_key,
        "language": "en",
    }

    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            resp = client.get(PLACES_URL, params=params)
        if resp.status_code != 200:
            logger.warning("Google Places HTTP %s for city=%s", resp.status_code, city)
            return []

        payload = resp.json()
        status = payload.get("status")
        if status not in {"OK", "ZERO_RESULTS"}:
            logger.warning("Google Places status %s for city=%s", status, city)
            return []

        results = payload.get("results") or []
        if not isinstance(results, list):
            return []

        out: list[dict[str, Any]] = []
        for row in results[:5]:
            if not isinstance(row, dict):
                continue
            photo_ref = ""
            photos = row.get("photos")
            if isinstance(photos, list) and photos and isinstance(photos[0], dict):
                photo_ref = str(photos[0].get("photo_reference") or "")

            rating = row.get("rating")
            try:
                rating_val = float(rating) if rating is not None else None
            except (TypeError, ValueError):
                rating_val = None

            out.append(
                {
                    "name": str(row.get("name") or ""),
                    "rating": rating_val,
                    "address": str(row.get("formatted_address") or ""),
                    "photo_reference": photo_ref,
                }
            )

        _cache[key] = (now + TTL_SECONDS, out)
        return out
    except Exception as exc:
        logger.warning("Google Places fetch failed for city=%s: %s", city, exc)
        return []
