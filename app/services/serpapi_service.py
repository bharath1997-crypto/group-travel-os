"""
app/services/serpapi_service.py — SerpAPI integrations for Explorer.
"""
from __future__ import annotations

import logging
from typing import Any

from app.core.api_limits import API_TIMEOUT_SECONDS
from config import settings

logger = logging.getLogger(__name__)


def _serpapi_key() -> str | None:
    key = (settings.serpapi_key or "").strip()
    return key or None


def _google_search(params: dict[str, Any], *, timeout: float | None = None) -> dict[str, Any]:
    deadline = API_TIMEOUT_SECONDS if timeout is None else timeout
    try:
        from serpapi.serp_api_client import SerpApiClient

        return SerpApiClient(params, engine=None, timeout=deadline).get_dict()
    except Exception:
        return {}


def _date_chip(date_filter: str) -> str:
    return {
        "today": "date:today",
        "tomorrow": "date:tomorrow",
        "this_week": "date:week",
        "week": "date:week",
        "this_weekend": "date:weekend",
        "weekend": "date:weekend",
        "this_month": "date:month",
        "month": "date:month",
    }.get((date_filter or "").strip().lower(), "date:today")


def search_google_events(
    query: str,
    city: str,
    date_filter: str = "today",
    timeout: float | None = None,
) -> list[dict[str, Any]]:
    try:
        api_key = _serpapi_key()
        if not api_key:
            return []

        response = _google_search(
            {
                "engine": "google_events",
                "q": f"{query} events in {city}",
                "location": city,
                "hl": "en",
                "gl": "us",
                "htichips": _date_chip(date_filter),
                "api_key": api_key,
            },
            timeout=timeout,
        )
        events = response.get("events_results", [])
        if not isinstance(events, list):
            return []

        out: list[dict[str, Any]] = []
        for index, item in enumerate(events):
            if not isinstance(item, dict):
                continue
            date = item.get("date") if isinstance(item.get("date"), dict) else {}
            address = item.get("address") if isinstance(item.get("address"), list) else []
            ticket_info = (
                item.get("ticket_info")
                if isinstance(item.get("ticket_info"), list)
                else []
            )
            first_ticket = ticket_info[0] if ticket_info and isinstance(ticket_info[0], dict) else {}
            out.append(
                {
                    "id": f"google_event_{index}",
                    "title": item.get("title", ""),
                    "description": item.get("description", ""),
                    "category": "event",
                    "source_type": "google_events",
                    "source_url": item.get("link", ""),
                    "booking_type": "external_link",
                    "image_url": item.get("thumbnail", ""),
                    "venue": address[0] if address else "",
                    "city": city,
                    "date_str": date.get("when", ""),
                    "price_from": None,
                    "is_free": False,
                    "ticket_url": first_ticket.get("link", ""),
                },
            )
        return out
    except Exception as exc:
        logger.warning("SerpAPI Google Events search failed: %s", exc)
        return []


def search_google_places(
    query: str,
    city: str,
    timeout: float | None = None,
) -> list[dict[str, Any]]:
    try:
        api_key = _serpapi_key()
        if not api_key:
            return []

        response = _google_search(
            {
                "engine": "google_local",
                "q": f"{query} in {city}",
                "location": city,
                "hl": "en",
                "gl": "us",
                "api_key": api_key,
            },
            timeout=timeout,
        )
        places = response.get("local_results", [])
        if not isinstance(places, list):
            return []

        out: list[dict[str, Any]] = []
        for index, item in enumerate(places):
            if not isinstance(item, dict):
                continue
            out.append(
                {
                    "id": f"google_place_{index}",
                    "title": item.get("title", ""),
                    "description": item.get("type", ""),
                    "category": "place",
                    "source_type": "google_places",
                    "source_url": item.get("website", ""),
                    "booking_type": "external_link",
                    "image_url": item.get("thumbnail", ""),
                    "venue": item.get("address", ""),
                    "city": city,
                    "rating": item.get("rating", None),
                    "reviews": item.get("reviews", None),
                    "hours": item.get("hours", ""),
                    "phone": item.get("phone", ""),
                    "price_from": None,
                    "is_free": False,
                    "latitude": (item.get("gps_coordinates") or {}).get("latitude")
                    if isinstance(item.get("gps_coordinates"), dict)
                    else None,
                    "longitude": (item.get("gps_coordinates") or {}).get("longitude")
                    if isinstance(item.get("gps_coordinates"), dict)
                    else None,
                },
            )
        return out
    except Exception as exc:
        logger.warning("SerpAPI Google Places search failed: %s", exc)
        return []


def search_google_web(query: str, city: str, timeout: float | None = None) -> list[dict[str, Any]]:
    try:
        api_key = _serpapi_key()
        if not api_key:
            return []

        response = _google_search(
            {
                "engine": "google",
                "q": f"{query} {city}",
                "location": city,
                "hl": "en",
                "gl": "us",
                "num": 10,
                "api_key": api_key,
            },
            timeout=timeout,
        )
        results = response.get("organic_results", [])
        if not isinstance(results, list):
            return []

        out: list[dict[str, Any]] = []
        for index, item in enumerate(results):
            if not isinstance(item, dict):
                continue
            out.append(
                {
                    "id": f"google_web_{index}",
                    "title": item.get("title", ""),
                    "description": item.get("snippet", ""),
                    "source_type": "google_web",
                    "source_url": item.get("link", ""),
                    "booking_type": "external_link",
                    "image_url": "",
                    "venue": item.get("displayed_link", ""),
                    "city": city,
                    "is_free": False,
                    "price_from": None,
                },
            )
        return out
    except Exception as exc:
        logger.warning("SerpAPI Google Web search failed: %s", exc)
        return []
