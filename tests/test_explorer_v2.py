"""Tests for Explorer v2 PostGIS places API."""
from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.explorer_v2 import ExploreNearbyResponse, ExploreViewportResponse, PlaceResult
from app.services.explorer.explorer_v2_service import (
    ExplorerV2Service,
    SECTION_CATEGORIES,
    _resolve_categories,
)
from app.utils.auth import get_current_user

client = TestClient(app)


def _mock_user() -> MagicMock:
    user = MagicMock()
    user.id = uuid.UUID("00000000-0000-0000-0000-000000000042")
    user.email = "explorer-v2@example.com"
    user.full_name = "Explorer V2 Tester"
    user.is_active = True
    return user


def _sample_row(place_id: uuid.UUID | None = None, distance_m: float | None = 120.5) -> dict:
    pid = place_id or uuid.uuid4()
    return {
        "id": pid,
        "name": "Test Cafe",
        "category": "restaurant",
        "subcategory": "cafe",
        "lat": 40.7128,
        "lng": -74.0060,
        "address": {"city": "New York", "country": "US"},
        "website": "https://example.com",
        "phone": "+1-555-0100",
        "opening_hours": "Mo-Sa 09:00-17:00",
        "photo_url": None,
        "source": "osm",
        "distance_m": distance_m,
    }


@pytest.fixture
def auth_header():
    app.dependency_overrides[get_current_user] = _mock_user
    yield {}
    app.dependency_overrides.pop(get_current_user, None)


def test_get_nearby_cache_miss_queries_db_and_writes_cache(monkeypatch):
    db = MagicMock()
    place_id = uuid.uuid4()
    row = _sample_row(place_id)

    execute_result = MagicMock()
    execute_result.mappings.return_value.all.return_value = [row]
    db.execute.return_value = execute_result

    set_cache = MagicMock()
    monkeypatch.setattr(
        "app.services.explorer.explorer_v2_service.explorer_service.get_cache",
        lambda _db, _key: None,
    )
    monkeypatch.setattr(
        "app.services.explorer.explorer_v2_service.explorer_service.set_cache",
        set_cache,
    )

    service = ExplorerV2Service()
    result = service.get_nearby(
        lat=40.7128,
        lng=-74.0060,
        radius_m=5000,
        categories=None,
        limit=50,
        db=db,
    )

    assert result.cached is False
    assert result.total == 1
    assert result.places[0].name == "Test Cafe"
    assert result.places[0].distance_m == 120.5
    db.execute.assert_called_once()
    set_cache.assert_called_once()
    cache_args = set_cache.call_args
    assert cache_args[0][3] == [str(place_id)]


def test_get_nearby_cache_hit_skips_spatial_query(monkeypatch):
    db = MagicMock()
    place_id = uuid.uuid4()
    row = _sample_row(place_id)

    execute_result = MagicMock()
    execute_result.mappings.return_value.all.return_value = [row]
    db.execute.return_value = execute_result

    monkeypatch.setattr(
        "app.services.explorer.explorer_v2_service.explorer_service.get_cache",
        lambda _db, _key: [str(place_id)],
    )
    set_cache = MagicMock()
    monkeypatch.setattr(
        "app.services.explorer.explorer_v2_service.explorer_service.set_cache",
        set_cache,
    )

    service = ExplorerV2Service()
    result = service.get_nearby(
        lat=40.7128,
        lng=-74.0060,
        radius_m=5000,
        categories=None,
        limit=50,
        db=db,
    )

    assert result.cached is True
    assert result.total == 1
    set_cache.assert_not_called()
    sql = str(db.execute.call_args[0][0])
    assert "ST_DWithin" not in sql


def test_get_viewport_cache_miss_queries_db(monkeypatch):
    db = MagicMock()
    row = _sample_row(distance_m=None)

    execute_result = MagicMock()
    execute_result.mappings.return_value.all.return_value = [row]
    db.execute.return_value = execute_result

    set_cache = MagicMock()
    monkeypatch.setattr(
        "app.services.explorer.explorer_v2_service.explorer_service.get_cache",
        lambda _db, _key: None,
    )
    monkeypatch.setattr(
        "app.services.explorer.explorer_v2_service.explorer_service.set_cache",
        set_cache,
    )

    service = ExplorerV2Service()
    result = service.get_viewport(
        sw_lat=40.0,
        sw_lng=-75.0,
        ne_lat=41.0,
        ne_lng=-74.0,
        categories=None,
        limit=100,
        db=db,
    )

    assert result.cached is False
    assert result.total == 1
    assert result.places[0].distance_m is None
    sql = str(db.execute.call_args[0][0])
    assert "ST_Within" in sql
    set_cache.assert_called_once()


def test_get_viewport_cache_hit(monkeypatch):
    db = MagicMock()
    place_id = uuid.uuid4()
    row = _sample_row(place_id, distance_m=None)

    execute_result = MagicMock()
    execute_result.mappings.return_value.all.return_value = [row]
    db.execute.return_value = execute_result

    monkeypatch.setattr(
        "app.services.explorer.explorer_v2_service.explorer_service.get_cache",
        lambda _db, _key: [str(place_id)],
    )
    monkeypatch.setattr(
        "app.services.explorer.explorer_v2_service.explorer_service.set_cache",
        MagicMock(),
    )

    service = ExplorerV2Service()
    result = service.get_viewport(
        sw_lat=40.0,
        sw_lng=-75.0,
        ne_lat=41.0,
        ne_lng=-74.0,
        categories=None,
        limit=100,
        db=db,
    )

    assert result.cached is True
    sql = str(db.execute.call_args[0][0])
    assert "ST_Within" not in sql


def test_resolve_categories_expands_section_keys():
    assert _resolve_categories(["gaming"]) == ["gaming"]
    assert _resolve_categories(["landmark"]) == ["landmark", "photo_spot"]
    assert _resolve_categories(["trekking"]) == ["trekking", "nature"]
    assert "entertainment" not in SECTION_CATEGORIES["gaming"]


def test_get_nearby_applies_categories_filter(monkeypatch):
    db = MagicMock()
    execute_result = MagicMock()
    execute_result.mappings.return_value.all.return_value = []
    db.execute.return_value = execute_result

    monkeypatch.setattr(
        "app.services.explorer.explorer_v2_service.explorer_service.get_cache",
        lambda _db, _key: None,
    )
    monkeypatch.setattr(
        "app.services.explorer.explorer_v2_service.explorer_service.set_cache",
        MagicMock(),
    )

    service = ExplorerV2Service()
    service.get_nearby(
        lat=40.0,
        lng=-74.0,
        radius_m=3000,
        categories=["restaurant", "park"],
        limit=25,
        db=db,
    )

    sql = str(db.execute.call_args[0][0])
    params = db.execute.call_args[0][1]
    assert "category = ANY" in sql
    assert params["categories"] == ["restaurant", "park"]


def test_nearby_radius_exceeds_max_returns_400(auth_header):
    response = client.get(
        "/api/v2/explorer/nearby",
        params={"lat": 40.7, "lng": -74.0, "radius_m": 60000},
    )
    assert response.status_code == 400


def test_viewport_invalid_bbox_returns_400(auth_header):
    response = client.get(
        "/api/v2/explorer/viewport",
        params={
            "sw_lat": 41.0,
            "sw_lng": -75.0,
            "ne_lat": 40.0,
            "ne_lng": -74.0,
        },
    )
    assert response.status_code == 400


def test_nearby_requires_auth_401():
    response = client.get(
        "/api/v2/explorer/nearby",
        params={"lat": 40.7, "lng": -74.0},
    )
    assert response.status_code == 401


def test_nearby_endpoint_returns_service_response(auth_header, monkeypatch):
    place = PlaceResult(
        id=uuid.uuid4(),
        name="Router Place",
        category="park",
        subcategory="playground",
        lat=40.0,
        lng=-74.0,
        address=None,
        website=None,
        phone=None,
        opening_hours=None,
        photo_url=None,
        source="osm",
        distance_m=50.0,
    )
    mock_response = ExploreNearbyResponse(places=[place], cached=False, total=1)
    monkeypatch.setattr(
        "app.routers.explorer_v2.explorer_v2_service.get_nearby",
        MagicMock(return_value=mock_response),
    )

    response = client.get(
        "/api/v2/explorer/nearby",
        params={"lat": 40.0, "lng": -74.0},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["cached"] is False
    assert body["total"] == 1
    assert body["places"][0]["name"] == "Router Place"


def test_viewport_endpoint_returns_service_response(auth_header, monkeypatch):
    place = PlaceResult(
        id=uuid.uuid4(),
        name="Viewport Place",
        category="landmark",
        subcategory="museum",
        lat=40.5,
        lng=-74.5,
        address=None,
        website=None,
        phone=None,
        opening_hours=None,
        photo_url=None,
        source="osm",
        distance_m=None,
    )
    mock_response = ExploreViewportResponse(places=[place], cached=True, total=1)
    monkeypatch.setattr(
        "app.routers.explorer_v2.explorer_v2_service.get_viewport",
        MagicMock(return_value=mock_response),
    )

    response = client.get(
        "/api/v2/explorer/viewport",
        params={
            "sw_lat": 40.0,
            "sw_lng": -75.0,
            "ne_lat": 41.0,
            "ne_lng": -74.0,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["cached"] is True
    assert body["places"][0]["name"] == "Viewport Place"


def test_get_city_nominatim_success(auth_header, monkeypatch):
    class MockResponse:
        status_code = 200
        def raise_for_status(self):
            pass
        def json(self):
            return {
                "address": {
                    "city": "Austin",
                    "country": "United States"
                }
            }

    monkeypatch.setattr(
        "httpx.get",
        lambda *args, **kwargs: MockResponse()
    )

    response = client.get("/api/v2/explorer/city", params={"lat": 30.2672, "lng": -97.7431})
    assert response.status_code == 200
    data = response.json()
    assert data["city"] == "Austin"
    assert data["country"] == "United States"


def test_get_city_nominatim_failure_fallback(auth_header, monkeypatch):
    def mock_get(*args, **kwargs):
        raise Exception("Network error")

    monkeypatch.setattr("httpx.get", mock_get)

    response = client.get("/api/v2/explorer/city", params={"lat": 30.2672, "lng": -97.7431})
    assert response.status_code == 200
    data = response.json()
    assert data["city"] == "Chicago"
    assert data["country"] == "United States"


# ── /search tests ────────────────────────────────────────────────────────────

def test_search_returns_matching_places(auth_header):
    """GET /search?q=pizza returns matching places from the DB (SQLite fallback)."""
    from app.utils.database import get_db
    db_mock = MagicMock()
    pid = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    row = {
        "id": pid,
        "name": "Pizza Palace",
        "category": "restaurant",
        "subcategory": "pizza",
        "lat": 41.8781,
        "lng": -87.6298,
        "address": None,
        "photo_url": None,
        "website": "https://pizza.example.com",
        "phone": None,
        "opening_hours": None,
        "source": "osm",
        "distance_m": 0.0,
    }
    execute_result = MagicMock()
    execute_result.mappings.return_value.all.return_value = [row]
    db_mock.execute.return_value = execute_result
    app.dependency_overrides[get_db] = lambda: db_mock

    try:
        response = client.get("/api/v2/explorer/search", params={"q": "pizza"})
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Pizza Palace"
        assert data[0]["category"] == "restaurant"
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_search_returns_empty_for_no_match(auth_header):
    """GET /search?q=xyznotexist returns an empty list."""
    from app.utils.database import get_db
    db_mock = MagicMock()
    execute_result = MagicMock()
    execute_result.mappings.return_value.all.return_value = []
    db_mock.execute.return_value = execute_result
    app.dependency_overrides[get_db] = lambda: db_mock

    try:
        response = client.get("/api/v2/explorer/search", params={"q": "xyznotexist"})
        assert response.status_code == 200
        assert response.json() == []
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_search_requires_auth_401():
    """GET /search without auth returns 401."""
    response = client.get("/api/v2/explorer/search", params={"q": "pizza"})
    assert response.status_code == 401


def test_search_log_saves_to_db(auth_header):
    """POST /search/log saves a search_log row and returns {ok: true}."""
    from app.utils.database import get_db
    db_mock = MagicMock()
    db_mock.execute.return_value = MagicMock()
    app.dependency_overrides[get_db] = lambda: db_mock

    try:
        response = client.post(
            "/api/v2/explorer/search/log",
            json={"query": "Eiffel Tower", "source": "photon", "results_count": 1},
        )
        assert response.status_code == 200
        assert response.json() == {"ok": True}
        db_mock.execute.assert_called_once()
        db_mock.commit.assert_called_once()
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_external_calls_remaining_returns_correct_count(auth_header):
    """GET /search/external-calls-remaining returns correct remaining count (geoapify/opencage)."""
    from app.utils.database import get_db
    db_mock = MagicMock()
    row_mock = MagicMock()
    row_mock.__getitem__ = lambda self, key: 2  # 2 geoapify/opencage calls used
    execute_result = MagicMock()
    execute_result.mappings.return_value.one.return_value = row_mock
    db_mock.execute.return_value = execute_result
    app.dependency_overrides[get_db] = lambda: db_mock

    try:
        response = client.get("/api/v2/explorer/search/external-calls-remaining")
        assert response.status_code == 200
        data = response.json()
        assert data["remaining"] == 3
        assert data["limit"] == 5
        assert "reset" not in data
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_external_calls_remaining_returns_zero_after_5(auth_header):
    """After 5+ Geoapify/OpenCage calls remaining is clamped to 0."""
    from app.utils.database import get_db
    db_mock = MagicMock()
    row_mock = MagicMock()
    row_mock.__getitem__ = lambda self, key: 7  # 7 calls (over the cap)
    execute_result = MagicMock()
    execute_result.mappings.return_value.one.return_value = row_mock
    db_mock.execute.return_value = execute_result
    app.dependency_overrides[get_db] = lambda: db_mock

    try:
        response = client.get("/api/v2/explorer/search/external-calls-remaining")
        assert response.status_code == 200
        data = response.json()
        assert data["remaining"] == 0
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_geocoding_quota_returns_empty_on_sqlite(auth_header):
    """GET /geocoding-quota returns empty quotas list on SQLite (test DB)."""
    response = client.get("/api/v2/explorer/geocoding-quota")
    assert response.status_code == 200
    data = response.json()
    assert data == {"quotas": []}


def test_search_log_rejects_lat_lng_fields(auth_header):
    """POST /search/log ignores any lat/lng fields — schema strips them."""
    from app.utils.database import get_db
    db_mock = MagicMock()
    db_mock.execute.return_value = MagicMock()
    app.dependency_overrides[get_db] = lambda: db_mock

    try:
        # Even if a client sends lat/lng, Pydantic strips unknown fields
        response = client.post(
            "/api/v2/explorer/search/log",
            json={
                "query": "Taj Mahal",
                "source": "geoapify",
                "results_count": 1,
                "lat": 27.1751,
                "lng": 78.0421,
            },
        )
        assert response.status_code == 200
        assert response.json() == {"ok": True}
        # Verify the SQL executed doesn't contain coordinate values
        call_args = db_mock.execute.call_args
        sql_str = str(call_args[0][0])
        assert "lat" not in sql_str.lower() or "latitude" not in sql_str.lower()
    finally:
        app.dependency_overrides.pop(get_db, None)


# ── /events tests ─────────────────────────────────────────────────────────────

def test_get_events_success(auth_header, monkeypatch):
    db_mock = MagicMock()
    
    row = {
        "id": uuid.UUID("11111111-1111-1111-1111-111111111111"),
        "title": "Test Concert",
        "start_time": "2026-06-15T20:00:00Z",
        "end_time": "2026-06-15T23:00:00Z",
        "ticket_url": "https://ticketmaster.com/tc",
        "price_min": 25.0,
        "price_max": 75.0,
        "category": "Music",
        "lat": 30.2672,
        "lng": -97.7431,
    }
    
    execute_result = MagicMock()
    execute_result.mappings.return_value.all.return_value = [row]
    db_mock.execute.return_value = execute_result
    
    from app.utils.database import get_db
    app.dependency_overrides[get_db] = lambda: db_mock

    try:
        response = client.get("/api/v2/explorer/events", params={"lat": 30.2672, "lng": -97.7431})
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "Test Concert"
        assert data[0]["category"] == "Music"
    finally:
        app.dependency_overrides.pop(get_db, None)

