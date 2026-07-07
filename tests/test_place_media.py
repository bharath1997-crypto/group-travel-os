from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.place_key_service import build_place_key
from app.services.place_media_service import PlaceMediaService
from app.utils.auth import get_current_user

client = TestClient(app)


@pytest.fixture
def auth_user():
    user = MagicMock()
    user.id = uuid4()
    app.dependency_overrides[get_current_user] = lambda: user
    yield user
    app.dependency_overrides.pop(get_current_user, None)


def test_build_place_key_prefers_osm():
    key = build_place_key(
        name="Empire State Building",
        lat=40.7484,
        lng=-73.9857,
        osm_type="way",
        osm_id=346338054,
    )
    assert key == "osm:way:346338054"


def test_build_place_key_fallback_without_osm():
    key = build_place_key(
        name="Bombay Indian Cuisine",
        lat=14.9701,
        lng=102.1012,
        city="Nakhon Ratchasima",
        country="Thailand",
    )
    assert key.startswith("source:bombay_indian_cuisine:14.9701:102.1012:")


def test_resolve_place_media_empty_without_db(monkeypatch):
    class FakeResult:
        def scalars(self):
            return self

        def all(self):
            return []

    class FakeDb:
        def execute(self, _stmt):
            return FakeResult()

    result = PlaceMediaService.resolve_place_media(FakeDb(), "osm:node:999")
    assert result.place_key == "osm:node:999"
    assert result.media == []
    assert result.tags == []


def test_get_place_media_requires_auth():
    app.dependency_overrides.clear()
    res = client.get("/api/v1/live/places/media", params={"placeKey": "osm:node:1"})
    assert res.status_code == 401


def test_get_place_media_invalid_key_returns_422(auth_user):
    res = client.get("/api/v1/live/places/media", params={"placeKey": "ab"})
    assert res.status_code == 422


def test_post_resolve_place_media_requires_auth():
    res = client.post(
        "/api/v1/live/places/media/resolve",
        json={
            "name": "Test Place",
            "lat": 41.88,
            "lng": -87.63,
            "city": "Chicago",
            "country": "United States",
        },
    )
    assert res.status_code == 401


def test_post_resolve_place_media_success(auth_user, monkeypatch):
    from app.schemas.place_media import PlaceMediaResolveResponse

    def fake_resolve(_db, _data):
        return PlaceMediaResolveResponse(
            place_key="osm:node:42",
            media=[],
            tags=[],
        )

    monkeypatch.setattr(
        PlaceMediaService,
        "resolve_from_place_input",
        staticmethod(fake_resolve),
    )

    res = client.post(
        "/api/v1/live/places/media/resolve",
        json={
            "name": "Test Place",
            "lat": 41.88,
            "lng": -87.63,
            "city": "Chicago",
            "country": "United States",
            "osm_type": "node",
            "osm_id": 42,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["place_key"] == "osm:node:42"
    assert body["media"] == []


def test_post_resolve_place_media_validation_error(auth_user):
    res = client.post(
        "/api/v1/live/places/media/resolve",
        json={"name": "", "lat": 41.88, "lng": -87.63},
    )
    assert res.status_code == 422


def test_route_preview_requires_auth():
    app.dependency_overrides.clear()
    res = client.post(
        "/api/v1/live/route-preview",
        json={
            "origin": {"latitude": 41.88, "longitude": -87.63, "source": "gps"},
            "destination": {"latitude": 41.89, "longitude": -87.62, "name": "Target"},
            "travelMode": "Drive"
        }
    )
    assert res.status_code == 401


def test_route_preview_validation_error(auth_user):
    res = client.post(
        "/api/v1/live/route-preview",
        json={
            "origin": {"latitude": 41.88, "longitude": -87.63},
            "destination": {"latitude": 41.89, "longitude": -87.62},
            "travelMode": "invalid_mode"
        }
    )
    assert res.status_code == 422


def test_route_preview_success(auth_user):
    from unittest.mock import patch, AsyncMock, MagicMock
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "code": "Ok",
        "routes": [
            {
                "distance": 1500.0,
                "duration": 300.0,
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [-87.63, 41.88],
                        [-87.62, 41.89]
                    ]
                }
            }
        ]
    }
    
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        
        res = client.post(
            "/api/v1/live/route-preview",
            json={
                "origin": {"latitude": 41.88, "longitude": -87.63, "source": "gps"},
                "destination": {"latitude": 41.89, "longitude": -87.62, "name": "Target"},
                "travelMode": "Drive"
            }
        )
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "ready"
        assert body["distanceMeters"] == 1500.0
        assert body["durationSeconds"] == 300.0
        assert body["geometry"]["type"] == "LineString"
        assert body["geometry"]["coordinates"] == [[-87.63, 41.88], [-87.62, 41.89]]
