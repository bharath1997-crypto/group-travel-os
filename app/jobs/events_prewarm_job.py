"""APScheduler job — pre-warm aggregated events cache for popular cities."""

from __future__ import annotations

import logging

from app.services.events_service import search_events_extended
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
                result = search_events_extended(db, city=city)
                logger.info(
                    "Events cache pre-warmed for %s (%s events)",
                    city,
                    result.get("total", 0),
                )
            except Exception:
                logger.exception("Events pre-warm failed for city=%s", city)
    finally:
        db.close()
