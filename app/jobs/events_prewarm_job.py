"""APScheduler job — pre-warm Ticketmaster events cache for popular cities."""

from __future__ import annotations

import logging

from app.services.events_service import (
    CONTENT_EVENTS_AGGREGATED,
    _dedupe_and_sort_events,
    _events_cache_key,
    _fetch_ticketmaster_events,
    _upsert_list,
)
from app.utils.database import SessionLocal

logger = logging.getLogger(__name__)

PREWARM_CITIES = [
    "Chicago",
    "New York",
    "London",
    "Tokyo",
    "Paris",
    "Dubai",
    "Sydney",
    "Barcelona",
]


def prewarm_events_cache() -> None:
    db = SessionLocal()
    try:
        for city in PREWARM_CITIES:
            try:
                cache_key = _events_cache_key(city, "all", None, None)
                events = _dedupe_and_sort_events(
                    _fetch_ticketmaster_events(city, "all", None, None)
                )
                _upsert_list(
                    db,
                    city=cache_key,
                    content_type=CONTENT_EVENTS_AGGREGATED,
                    data=events,
                )
                logger.info(
                    "Ticketmaster cache pre-warmed for %s (%s events)",
                    city,
                    len(events),
                )
            except Exception:
                logger.exception("Events pre-warm failed for city=%s", city)
    finally:
        db.close()
