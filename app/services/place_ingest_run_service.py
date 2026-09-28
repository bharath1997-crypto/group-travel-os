"""Freshness metadata from successful Overture place ingest runs."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.explore_cache_freshness import explore_freshness_meta
from app.services.explore_place_spine_service import normalize_city_slug, spine_database_ready

DATASET_OVERTURE = "overture_places"

FRESHNESS_BY_CITY_SQL = """
    SELECT r.completed_at, r.row_count, r.release_id
    FROM place_ingest_runs r
    INNER JOIN place_ingest_run_cities c ON c.run_id = r.id
    WHERE r.dataset = :dataset
      AND r.status = 'succeeded'
      AND r.completed_at IS NOT NULL
      AND c.city_slug = :city_slug
    ORDER BY r.completed_at DESC NULLS LAST
    LIMIT 1
"""


def latest_successful_ingest_for_city(
    db: Session,
    *,
    city_slug: str,
) -> dict[str, Any] | None:
    if not spine_database_ready(db):
        return None
    row = db.execute(
        text(FRESHNESS_BY_CITY_SQL),
        {"dataset": DATASET_OVERTURE, "city_slug": city_slug},
    ).mappings().first()
    return dict(row) if row else None


def explore_places_freshness_meta(
    db: Session,
    *,
    city: str,
    region_key: str | None = None,
    hot_index_empty: bool,
) -> dict[str, Any]:
    del region_key  # freshness is city-coverage scoped only
    city_slug = normalize_city_slug(city)
    run = latest_successful_ingest_for_city(db, city_slug=city_slug)
    if run is None:
        return explore_freshness_meta(refreshed_at=None, cache_status="unavailable")
    completed: datetime | None = run.get("completed_at")
    if hot_index_empty:
        return explore_freshness_meta(refreshed_at=completed, cache_status="empty")
    return explore_freshness_meta(refreshed_at=completed, cache_status="fresh_cache")
