"""Tests for Live Tab speed camera alerts (OSM Overpass + cache)."""
from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import live_service
from app.services.live_service import LiveService
from app.utils.auth import get_current_user

_USER_ID = __import__("uuid").UUID("00000000-0000-0000-0000-000000000001")


def _mock_user():
    user = type("User", (), {})()
    user.id = _USER_ID
    user.is_active = True
    return user


@pytest.fixture(autouse=True)
def _reset_cache():
    live_service._speed_camera_cache.clear()
    yield
    app.dependency_overrides.pop(get_current_user, None)
    live_service._speed_camera_cache.clear()


@pytest.fixture
def auth_client():
    app.dependency_overrides[get_current_user] = lambda: _mock_user()
    return TestClient(app, raise_server_exceptions=True)


_SAMPLE_CAMERAS = [
    {
        "camera_id": "osm-1001",
        "lat": 41.872,
        "lng": -87.6298,
        "max_speed_mph": 35,
        "direction": "forward",
    },
    {
        "camera_id": "osm-1002",
        "lat": 41.865,
        "lng": -87.6298,
        "max_speed_mph": None,
        "direction": None,
    },
]


class TestSpeedCamerasEndpoint:
    @patch("app.services.live_service._fetch_speed_cameras_from_overpass")
    def test_get_speed_cameras_list(self, mock_overpass, auth_client):
        mock_overpass.return_value = _SAMPLE_CAMERAS
        resp = auth_client.get(
            "/api/v1/live/speed-cameras",
            params={"lat": 41.8781, "lng": -87.6298},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["cameras"]) == 2
        assert data["cameras"][0]["camera_id"] == "osm-1001"
        assert data["cameras"][0]["max_speed_mph"] == 35

    @patch("app.services.live_service._fetch_speed_cameras_from_overpass")
    def test_get_speed_cameras_uses_cache(self, mock_overpass, auth_client):
        mock_overpass.return_value = _SAMPLE_CAMERAS
        auth_client.get(
            "/api/v1/live/speed-cameras",
            params={"lat": 41.8781, "lng": -87.6298},
        )
        auth_client.get(
            "/api/v1/live/speed-cameras",
            params={"lat": 41.8781, "lng": -87.6298},
        )
        assert mock_overpass.call_count == 1

    @patch("app.services.live_service._fetch_speed_cameras_from_overpass")
    def test_get_speed_cameras_empty(self, mock_overpass, auth_client):
        mock_overpass.return_value = []
        resp = auth_client.get(
            "/api/v1/live/speed-cameras",
            params={"lat": 41.8781, "lng": -87.6298},
        )
        assert resp.status_code == 200
        assert resp.json()["cameras"] == []


class TestSpeedCameraRouteAlert:
    @patch("app.services.live_service._fetch_speed_cameras_from_overpass")
    def test_route_alert_camera_ahead(self, mock_overpass, auth_client):
        mock_overpass.return_value = [_SAMPLE_CAMERAS[1]]
        resp = auth_client.get(
            "/api/v1/live/speed-cameras/route-alert",
            params={
                "lat": 41.8781,
                "lng": -87.6298,
                "bearing": 180,
                "speed_mph": 40,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["camera_id"] == "osm-1002"
        assert data["tier"] in {"advisory", "warning", "immediate"}

    @patch("app.services.live_service._fetch_speed_cameras_from_overpass")
    def test_route_alert_camera_behind(self, mock_overpass, auth_client):
        mock_overpass.return_value = [_SAMPLE_CAMERAS[1]]
        resp = auth_client.get(
            "/api/v1/live/speed-cameras/route-alert",
            params={
                "lat": 41.8781,
                "lng": -87.6298,
                "bearing": 0,
                "speed_mph": 40,
            },
        )
        assert resp.status_code == 200
        assert resp.json()["camera_id"] is None

    @patch("app.services.live_service._fetch_speed_cameras_from_overpass")
    def test_route_alert_over_limit(self, mock_overpass, auth_client):
        mock_overpass.return_value = [_SAMPLE_CAMERAS[0]]
        resp = auth_client.get(
            "/api/v1/live/speed-cameras/route-alert",
            params={
                "lat": 41.8781,
                "lng": -87.6298,
                "bearing": 180,
                "speed_mph": 50,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["over_limit"] is True
        assert "Reduce speed now" in (data["message"] or "")

    def test_route_alert_service_empty(self):
        with patch(
            "app.services.live_service._fetch_speed_cameras_from_overpass",
            return_value=[],
        ):
            result = LiveService.get_speed_camera_route_alert(
                41.8781,
                -87.6298,
                180,
                40,
            )
        assert result["camera_id"] is None
