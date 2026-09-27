from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock

from app.services.place_ingest_run_service import (
    FRESHNESS_BY_CITY_SQL,
    explore_places_freshness_meta,
    latest_successful_ingest_for_city,
)


def test_freshness_sql_joins_city_coverage() -> None:
    assert "place_ingest_run_cities" in FRESHNESS_BY_CITY_SQL
    assert "city_slug = :city_slug" in FRESHNESS_BY_CITY_SQL
    assert "IS NULL OR" not in FRESHNESS_BY_CITY_SQL


def test_freshness_uses_city_slug_param() -> None:
    db = MagicMock()
    db.execute.return_value.mappings.return_value.first.return_value = None
    latest_successful_ingest_for_city(db, city_slug="chicago")
    params = db.execute.call_args[0][1]
    assert params["city_slug"] == "chicago"


def test_chicago_not_fresh_from_unrelated_region_run() -> None:
    db = MagicMock()
    db.execute.return_value.mappings.return_value.first.return_value = None
    meta = explore_places_freshness_meta(db, city="Chicago", hot_index_empty=False)
    assert meta["cache_status"] == "unavailable"
    sql_text = str(db.execute.call_args[0][0])
    assert "place_ingest_run_cities" in sql_text


def test_freshness_when_city_covered() -> None:
    db = MagicMock()
    completed = datetime(2026, 6, 1, tzinfo=timezone.utc)
    db.execute.return_value.mappings.return_value.first.return_value = {
        "completed_at": completed,
        "row_count": 50,
        "release_id": "2026-06-01",
    }
    meta = explore_places_freshness_meta(db, city="Chicago", hot_index_empty=False)
    assert meta["cache_status"] == "fresh_cache"
    assert meta["refreshed_at"] is not None
