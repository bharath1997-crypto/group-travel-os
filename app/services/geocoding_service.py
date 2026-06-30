"""
app/services/geocoding_service.py — Nominatim geocoding proxy with in-memory TTL cache.
"""
from __future__ import annotations

import logging
import math
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
NOMINATIM_HEADERS = {
    "User-Agent": "Rovvy/1.0 contact@rovvy.app",
    "Accept-Language": "en",
}
HTTP_TIMEOUT_SECONDS = 10.0
CACHE_TTL_SECONDS = 600
MAX_CACHE_ENTRIES = 500
DEFAULT_VIEWBOX_KM = 80.0

_search_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}
_reverse_cache: dict[str, tuple[float, dict[str, Any] | None]] = {}


def _normalize_query(q: str) -> str:
    return " ".join(q.strip().lower().split())


def _search_cache_key(q: str, lat: float | None, lng: float | None) -> str:
    if lat is None or lng is None:
        return _normalize_query(q)
    return f"{_normalize_query(q)}@{round(lat, 3)},{round(lng, 3)}"


def _viewbox_for_point(lat: float, lng: float, radius_km: float) -> str:
    delta_lat = radius_km / 111.0
    cos_lat = math.cos(math.radians(lat)) or 1e-6
    delta_lng = radius_km / (111.0 * cos_lat)
    left = lng - delta_lng
    right = lng + delta_lng
    top = lat + delta_lat
    bottom = lat - delta_lat
    return f"{left},{top},{right},{bottom}"


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6_371_000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(a))


def _result_coords(result: dict[str, Any]) -> tuple[float, float] | None:
    try:
        return float(result["lat"]), float(result["lon"])
    except (KeyError, TypeError, ValueError):
        return None


def _sort_results_by_proximity(
    results: list[dict[str, Any]],
    lat: float | None,
    lng: float | None,
) -> list[dict[str, Any]]:
    if lat is None or lng is None or not results:
        return results

    def sort_key(item: dict[str, Any]) -> tuple[float, str]:
        coords = _result_coords(item)
        if coords is None:
            return (float("inf"), str(item.get("place_id", "")))
        distance = _haversine_m(lat, lng, coords[0], coords[1])
        return (distance, str(item.get("place_id", "")))

    return sorted(results, key=sort_key)


def _dedupe_results(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for item in results:
        key = str(item.get("place_id") or item.get("osm_id") or item.get("display_name"))
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique


def _reverse_cache_key(lat: float, lng: float) -> str:
    return f"{round(lat, 5)},{round(lng, 5)}"


def _prune_cache(cache: dict[str, tuple[float, Any]]) -> None:
    now = time.time()
    expired = [key for key, (expires_at, _) in cache.items() if expires_at <= now]
    for key in expired:
        del cache[key]

    overflow = len(cache) - MAX_CACHE_ENTRIES
    if overflow <= 0:
        return

    oldest_keys = sorted(cache.keys(), key=lambda key: cache[key][0])[:overflow]
    for key in oldest_keys:
        del cache[key]


def clear_geocoding_cache_for_tests() -> None:
    """Test helper — reset module caches between tests."""
    _search_cache.clear()
    _reverse_cache.clear()


class GeocodingService:
    @staticmethod
    async def search_address(
        q: str,
        lat: float | None = None,
        lng: float | None = None,
    ) -> list[dict[str, Any]]:
        normalized = _normalize_query(q)
        if not normalized:
            return []

        cache_key = _search_cache_key(q, lat, lng)
        now = time.time()
        cached = _search_cache.get(cache_key)
        if cached and cached[0] > now:
            return cached[1]

        params: dict[str, str | int | float] = {
            "q": q.strip(),
            "format": "json",
            "limit": 10,
            "addressdetails": 1,
        }
        if lat is not None and lng is not None:
            params["lat"] = lat
            params["lon"] = lng
            params["viewbox"] = _viewbox_for_point(lat, lng, DEFAULT_VIEWBOX_KM)

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    NOMINATIM_SEARCH_URL,
                    params=params,
                    headers=NOMINATIM_HEADERS,
                    timeout=HTTP_TIMEOUT_SECONDS,
                )
            if response.status_code != 200:
                logger.warning("Nominatim search HTTP %s for q=%r", response.status_code, q)
                return []

            data = response.json()
            results = data if isinstance(data, list) else []
        except Exception as exc:
            logger.warning("Nominatim search failed for q=%r: %s", q, exc)
            return []

        results = _dedupe_results(_sort_results_by_proximity(results, lat, lng))[:8]
        _search_cache[cache_key] = (now + CACHE_TTL_SECONDS, results)
        _prune_cache(_search_cache)
        return results

    @staticmethod
    async def reverse_geocode(lat: float, lng: float) -> dict[str, Any] | None:
        cache_key = _reverse_cache_key(lat, lng)
        now = time.time()
        cached = _reverse_cache.get(cache_key)
        if cached and cached[0] > now:
            return cached[1]

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    NOMINATIM_REVERSE_URL,
                    params={
                        "lat": lat,
                        "lon": lng,
                        "format": "json",
                        "addressdetails": 1,
                        "extratags": 1,
                    },
                    headers=NOMINATIM_HEADERS,
                    timeout=HTTP_TIMEOUT_SECONDS,
                )
            if response.status_code != 200:
                logger.warning(
                    "Nominatim reverse HTTP %s for lat=%s lng=%s",
                    response.status_code,
                    lat,
                    lng,
                )
                _reverse_cache[cache_key] = (now + CACHE_TTL_SECONDS, None)
                _prune_cache(_reverse_cache)
                return None

            data = response.json()
            result = data if isinstance(data, dict) and data else None
        except Exception as exc:
            logger.warning("Nominatim reverse failed for lat=%s lng=%s: %s", lat, lng, exc)
            result = None

        _reverse_cache[cache_key] = (now + CACHE_TTL_SECONDS, result)
        _prune_cache(_reverse_cache)
        return result
