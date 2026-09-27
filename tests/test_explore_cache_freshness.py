from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.services.explore_city_extended_service import (
    CONTENT_PLACES_ATTRACTIONS,
    _get_cached_list_with_meta,
)


def _dt(minutes_ago: int = 0) -> datetime:
    return datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)


def test_fresh_cache_hit_returns_stored_timestamp() -> None:
    db = MagicMock()
    row = MagicMock()
    row.data = [{"id": "p1", "name": "Place"}]
    row.fetched_at = _dt(12)

    with patch(
        "app.services.explore_city_extended_service._get_row",
        return_value=row,
    ):
        data, meta = _get_cached_list_with_meta(
            db,
            city="Chicago",
            content_type=CONTENT_PLACES_ATTRACTIONS,
            ttl_hours=3,
            fetch_fn=lambda: [{"id": "new"}],
        )

    assert len(data) == 1
    assert meta["cache_status"] == "fresh_cache"
    assert meta["refreshed_at"] is not None
    assert meta["refreshed_at"].endswith("Z") or "+" in meta["refreshed_at"]


def test_provider_refresh_returns_new_timestamp() -> None:
    db = MagicMock()
    stale_row = MagicMock()
    stale_row.data = [{"id": "old"}]
    stale_row.fetched_at = _dt(500)

    fresh_row = MagicMock()
    fresh_row.fetched_at = _dt(0)

    with patch(
        "app.services.explore_city_extended_service._get_row",
        side_effect=[stale_row, fresh_row],
    ), patch(
        "app.services.explore_city_extended_service._upsert_list",
    ):
        data, meta = _get_cached_list_with_meta(
            db,
            city="Chicago",
            content_type=CONTENT_PLACES_ATTRACTIONS,
            ttl_hours=3,
            fetch_fn=lambda: [{"id": "new"}],
        )

    assert data[0]["id"] == "new"
    assert meta["cache_status"] == "provider_refresh"
    assert meta["refreshed_at"] is not None


def test_stale_fallback_keeps_older_timestamp() -> None:
    db = MagicMock()
    row = MagicMock()
    row.data = [{"id": "cached"}]
    row.fetched_at = _dt(240)

    with patch(
        "app.services.explore_city_extended_service._get_row",
        return_value=row,
    ):
        data, meta = _get_cached_list_with_meta(
            db,
            city="Chicago",
            content_type=CONTENT_PLACES_ATTRACTIONS,
            ttl_hours=3,
            fetch_fn=lambda: (_ for _ in ()).throw(RuntimeError("provider down")),
        )

    assert data[0]["id"] == "cached"
    assert meta["cache_status"] == "stale_fallback"
    assert meta["refreshed_at"] is not None


def test_empty_no_cache_does_not_invent_timestamp() -> None:
    db = MagicMock()

    with patch(
        "app.services.explore_city_extended_service._get_row",
        return_value=None,
    ):
        data, meta = _get_cached_list_with_meta(
            db,
            city="Chicago",
            content_type=CONTENT_PLACES_ATTRACTIONS,
            ttl_hours=3,
            fetch_fn=lambda: (_ for _ in ()).throw(RuntimeError("provider down")),
        )

    assert data == []
    assert meta["cache_status"] == "unavailable"
    assert meta["refreshed_at"] is None
