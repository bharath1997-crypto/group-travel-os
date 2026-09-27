from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.explore_place_spine_service import (
    CITY_PLACES_SQL,
    SPATIAL_PLACES_SQL,
    ExplorePlaceSpineService,
    ExplorePlacesSpineUnavailable,
    map_spine_row_to_explore_place,
    normalize_city_slug,
)
from app.services.place_ingest_run_service import explore_places_freshness_meta

client = TestClient(app)


def _mock_postgres_db() -> MagicMock:
    db = MagicMock()
    db.get_bind.return_value.dialect.name = "postgresql"
    return db


def _sql_result_row(**overrides: object) -> dict:
    """Row shape returned by SQLAlchemy from SPATIAL_PLACES_SQL / CITY_PLACES_SQL."""
    base = {
        "gers_id": "08f2664a1c2b3d4e5f6789012345678",
        "name": "Demo Museum",
        "basic_category": "museum",
        "confidence": 0.9,
        "website": "https://example.org",
        "address": {"city": "Chicago"},
        "photos": None,
        "lat": 41.88,
        "lng": -87.63,
        "distance_m": 1200.0,
    }
    base.update(overrides)
    return base


def test_map_spine_row_id_equals_gers_id_and_source_overture() -> None:
    row = _sql_result_row()
    mapped = map_spine_row_to_explore_place(row)
    assert mapped["id"] == row["gers_id"]
    assert mapped["gers_id"] == row["gers_id"]
    assert mapped["source"] == "overture"
    assert mapped["source_label"] == "Overture"
    assert mapped["distance_m"] == 1200.0
    assert mapped.get("opening_hours") is None
    assert mapped.get("image_url") is None
    assert mapped["lat"] == 41.88
    assert mapped["lng"] == -87.63


def test_map_spine_row_lng_from_sql_lon_alias() -> None:
    """Regression: SQL used AS lon while mapper expected lng (API returned lng null)."""
    row = _sql_result_row(lng=None, lon=-87.63)
    del row["lng"]
    row["lon"] = -87.63
    mapped = map_spine_row_to_explore_place(row)
    assert mapped["lng"] == -87.63
    assert mapped["lat"] == 41.88


def test_sql_templates_expose_lng_not_lon_column() -> None:
    assert "ST_X(p.geog::geometry) AS lng" in CITY_PLACES_SQL
    assert "ST_X(p.geog::geometry) AS lng" in SPATIAL_PLACES_SQL
    assert "AS lon," not in CITY_PLACES_SQL
    assert "AS lon," not in SPATIAL_PLACES_SQL


def test_search_places_city_path_maps_lng_from_sql_row() -> None:
    db = _mock_postgres_db()
    db.execute.return_value.mappings.return_value.all.return_value = [
        _sql_result_row(
            gers_id="abc1234567890123456789012345678",
            name="Cafe",
            basic_category="cafe",
            confidence=0.8,
            website=None,
            address=None,
            photos=None,
            lat=41.0,
            lng=-87.63,
            distance_m=None,
        )
    ]
    places = ExplorePlaceSpineService.search_places(
        db, city="Chicago", category="restaurants", limit=10
    )
    assert places[0]["lng"] == -87.63


def test_search_places_spatial_path_maps_lng_from_sql_row() -> None:
    db = _mock_postgres_db()
    db.execute.return_value.mappings.return_value.all.return_value = [
        _sql_result_row(
            gers_id="def1234567890123456789012345678",
            name="Park",
            basic_category="museum",
            lat=41.8781,
            lng=-87.6298,
            distance_m=500.0,
        )
    ]
    places = ExplorePlaceSpineService.search_places(
        db,
        city="Chicago",
        category="attractions",
        lat=41.88,
        lon=-87.63,
        radius_m=5000,
        limit=5,
    )
    assert places[0]["lng"] == -87.6298


def test_normalize_city_slug() -> None:
    assert normalize_city_slug("New York") == "new-york"
    assert normalize_city_slug("  Chicago ") == "chicago"


def test_validate_lat_lon_pair_required() -> None:
    with pytest.raises(Exception) as exc:
        ExplorePlaceSpineService.validate_query_params(lat=41.0, lon=None, radius_m=None, limit=10)
    assert exc.value.status_code == 400


def test_search_places_city_slug_path() -> None:
    db = _mock_postgres_db()
    db.execute.return_value.mappings.return_value.all.return_value = [
        {
            "gers_id": "abc1234567890123456789012345678",
            "name": "Cafe",
            "basic_category": "cafe",
            "confidence": 0.8,
            "website": None,
            "address": None,
            "photos": None,
            "lat": 41.0,
            "lng": -87.0,
            "distance_m": None,
        }
    ]
    places = ExplorePlaceSpineService.search_places(
        db, city="Chicago", category="restaurants", limit=10
    )
    assert len(places) == 1
    assert places[0]["lng"] == -87.0
    sql_text = str(db.execute.call_args[0][0])
    assert "city_slug" in sql_text
    assert "ST_DWithin" not in sql_text
    assert "LIMIT" in sql_text
    assert db.execute.call_args[0][1]["lim"] == 10
    assert "confidence DESC NULLS LAST" in sql_text
    assert "gers_id ASC" in sql_text
    assert "ROW_NUMBER" not in sql_text


def test_search_places_spatial_path() -> None:
    db = _mock_postgres_db()
    db.execute.return_value.mappings.return_value.all.return_value = []
    ExplorePlaceSpineService.search_places(
        db,
        city="Chicago",
        category="attractions",
        lat=41.8781,
        lon=-87.6298,
        radius_m=5000,
        limit=5,
    )
    sql_text = str(db.execute.call_args[0][0])
    assert "ST_DWithin" in sql_text
    assert "LIMIT" in sql_text
    assert db.execute.call_args[0][1]["lim"] == 5
    assert "ORDER BY" in sql_text and "ST_Distance" in sql_text
    assert "gers_id ASC" in sql_text
    assert "ROW_NUMBER" not in sql_text


def test_city_sql_template_has_bound_limit_and_order() -> None:
    assert "LIMIT :lim" in CITY_PLACES_SQL
    assert "confidence DESC NULLS LAST" in CITY_PLACES_SQL
    assert "name ASC" in CITY_PLACES_SQL
    assert "gers_id ASC" in CITY_PLACES_SQL


def test_spatial_sql_template_has_bound_limit_and_order() -> None:
    assert "LIMIT :lim" in SPATIAL_PLACES_SQL
    assert "confidence DESC NULLS LAST" in SPATIAL_PLACES_SQL
    assert "gers_id ASC" in SPATIAL_PLACES_SQL


def test_explore_places_route_uses_spine_not_foursquare() -> None:
    sample = [
        {
            "id": "08f2664a1c2b3d4e5f6789012345678",
            "gers_id": "08f2664a1c2b3d4e5f6789012345678",
            "name": "Park",
            "category": "Park",
            "source": "overture",
            "source_label": "Overture",
        }
    ]
    freshness = {"refreshed_at": "2026-01-01T00:00:00Z", "cache_status": "fresh_cache"}
    with patch.object(ExplorePlaceSpineService, "search_places", return_value=sample) as mock_search, patch(
        "app.services.place_ingest_run_service.explore_places_freshness_meta",
        return_value=freshness,
    ), patch(
        "app.services.explore_place_spine_service.spine_database_ready",
        return_value=True,
    ), patch(
        "app.services.explore_city_extended_service._fetch_places",
    ) as mock_legacy:
        res = client.get(
            "/api/v1/explore/places",
            params={
                "city": "Chicago",
                "category": "attractions",
                "lat": 41.88,
                "lon": -87.63,
                "limit": 10,
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["places"] == sample
        assert body["source_status"] == "ready"
        assert body["freshness"]["cache_status"] == "fresh_cache"
        mock_search.assert_called_once()
        mock_legacy.assert_not_called()


def test_search_places_raises_on_non_postgres() -> None:
    db = MagicMock()
    db.get_bind.return_value.dialect.name = "sqlite"
    with pytest.raises(ExplorePlacesSpineUnavailable):
        ExplorePlaceSpineService.search_places(db, city="Chicago", category="attractions", limit=5)
    db.execute.assert_not_called()


def test_explore_places_route_unavailable_on_sqlite() -> None:
    """SQLite must not masquerade as a successful empty index — hub treats 503 as failed source."""
    from config import settings
    from sqlalchemy.engine import make_url

    if make_url(settings.DATABASE_URL).drivername.startswith("postgresql"):
        pytest.skip("sqlite-only regression")
    res = client.get("/api/v1/explore/places", params={"city": "Chicago", "category": "attractions", "limit": 3})
    assert res.status_code == 503


def test_explore_places_empty_hot_index() -> None:
    with patch.object(ExplorePlaceSpineService, "search_places", return_value=[]), patch(
        "app.services.place_ingest_run_service.explore_places_freshness_meta",
        return_value={"refreshed_at": None, "cache_status": "empty"},
    ), patch(
        "app.services.explore_place_spine_service.spine_database_ready",
        return_value=True,
    ):
        res = client.get("/api/v1/explore/places", params={"city": "Chicago", "category": "restaurants"})
        assert res.status_code == 200
        body = res.json()
        assert body["places"] == []
        assert body["source_status"] == "empty"


def test_explore_places_freshness_failure_keeps_places() -> None:
    sample = [
        {
            "id": "08f2664a1c2b3d4e5f6789012345678",
            "gers_id": "08f2664a1c2b3d4e5f6789012345678",
            "name": "Park",
            "category": "Park",
            "source": "overture",
            "source_label": "Overture",
        }
    ]
    with patch.object(ExplorePlaceSpineService, "search_places", return_value=sample), patch(
        "app.services.place_ingest_run_service.explore_places_freshness_meta",
        side_effect=RuntimeError("missing table"),
    ), patch(
        "app.services.explore_place_spine_service.spine_database_ready",
        return_value=True,
    ):
        res = client.get("/api/v1/explore/places", params={"city": "Chicago", "category": "attractions"})
        assert res.status_code == 200
        body = res.json()
        assert body["places"] == sample
        assert body["source_status"] == "ready"
        assert body["freshness"]["cache_status"] == "unavailable"


def test_freshness_from_successful_ingest_run() -> None:
    db = _mock_postgres_db()
    completed = datetime(2026, 3, 1, 12, 0, tzinfo=timezone.utc)
    db.execute.return_value.mappings.return_value.first.return_value = {
        "completed_at": completed,
        "row_count": 100,
        "release_id": "2026-03-18.0",
    }
    meta = explore_places_freshness_meta(db, city="Chicago", hot_index_empty=False)
    assert meta["cache_status"] == "fresh_cache"
    assert meta["refreshed_at"] is not None
    assert "place_ingest_run_cities" in str(db.execute.call_args[0][0])


def test_freshness_unavailable_without_run() -> None:
    db = _mock_postgres_db()
    db.execute.return_value.mappings.return_value.first.return_value = None
    meta = explore_places_freshness_meta(db, city="Chicago", hot_index_empty=True)
    assert meta["cache_status"] == "unavailable"
    assert meta["refreshed_at"] is None
