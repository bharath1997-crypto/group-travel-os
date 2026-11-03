"""Post-load dedup queue for cities touched by the feed."""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine


def enqueue_staging_cities(conn: Connection) -> int:
    result = conn.execute(
        text(
            """
            INSERT INTO ingest.dedup_queue (city_slug)
            SELECT DISTINCT city_slug FROM ingest.tm_feed_staging
            WHERE city_slug IS NOT NULL
            ON CONFLICT (city_slug) DO UPDATE SET queued_at = now()
            """
        )
    )
    return result.rowcount or 0


def process_dedup_queue(engine: Engine, store) -> int:
    with engine.connect() as conn:
        cities = conn.execute(text("SELECT city_slug FROM ingest.dedup_queue ORDER BY queued_at")).scalars().all()
    total = 0
    for city in cities:
        total += store.dedupe_city(city)
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM ingest.dedup_queue WHERE city_slug = :c"), {"c": city})
    return total
