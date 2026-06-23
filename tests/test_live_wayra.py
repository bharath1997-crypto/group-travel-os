"""Tests for Live Tab L8 Wayra AI endpoints."""
from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.live_service import LiveService
from app.utils.auth import get_current_user

_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def _mock_user() -> MagicMock:
    user = MagicMock()
    user.id = _USER_ID
    user.email = "live@example.com"
    user.full_name = "Test User"
    user.is_active = True
    return user


@pytest.fixture(autouse=True)
def _reset_overrides():
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def auth_client():
    app.dependency_overrides[get_current_user] = lambda: _mock_user()
    return TestClient(app, raise_server_exceptions=True)


class TestWayraLive:
    @patch("app.services.live_service._call_wayra_live_gemini")
    def test_wayra_live_success(self, mock_gemini, auth_client):
        mock_gemini.return_value = "Road looks clear ahead. Stay alert."
        response = auth_client.post(
            "/api/v1/live/wayra",
            json={
                "message": "How is traffic?",
                "context": {
                    "lat": 41.88,
                    "lng": -87.63,
                    "speed_mph": 35,
                    "active_reports": [],
                    "weather_code": 0,
                    "members": [],
                    "route_destination": None,
                },
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["reply"] == "Road looks clear ahead. Stay alert."
        assert data["action"] is None
        mock_gemini.assert_called_once()

    @patch("app.services.live_service._call_wayra_live_gemini")
    def test_wayra_live_with_poi_intent(self, mock_gemini, auth_client):
        mock_gemini.return_value = "Try the POI search icon to find coffee nearby."
        response = auth_client.post(
            "/api/v1/live/wayra",
            json={
                "message": "Find coffee near me",
                "context": {"lat": 41.88, "lng": -87.63, "speed_mph": 20},
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["action"] == "open_poi_search"


class TestWayraAnalyze:
    def test_wayra_analyze_group_split(self, auth_client):
        response = auth_client.post(
            "/api/v1/live/wayra/analyze",
            json={
                "lat": 41.88,
                "lng": -87.63,
                "speed_mph": 40,
                "member_positions": [
                    {"user_id": "1", "display_name": "Alex", "lat": 41.88, "lng": -87.63},
                    {"user_id": "2", "display_name": "Sam", "lat": 41.881, "lng": -87.631},
                    {"user_id": "3", "display_name": "Jordan", "lat": 41.85, "lng": -87.63},
                ],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["alert_type"] == "group_split"
        assert "Jordan" in data["message"]
        assert data["severity"] == "warning"

    def test_wayra_analyze_hazard_on_route(self, auth_client):
        response = auth_client.post(
            "/api/v1/live/wayra/analyze",
            json={
                "lat": 41.88,
                "lng": -87.63,
                "speed_mph": 35,
                "active_reports": ["accident"],
                "nearby_reports": [
                    {
                        "lat": 41.8805,
                        "lng": -87.6305,
                        "report_type": "accident",
                    }
                ],
                "route_geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [-87.631, 41.88],
                        [-87.63, 41.881],
                    ],
                },
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["alert_type"] == "hazard_on_route"
        assert data["action"] == "open_navigation"

    def test_wayra_analyze_severe_weather(self, auth_client):
        response = auth_client.post(
            "/api/v1/live/wayra/analyze",
            json={"lat": 41.88, "lng": -87.63, "speed_mph": 30, "weather_code": 95},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["alert_type"] == "weather_severe"
        assert data["severity"] == "danger"

    def test_wayra_analyze_rain_speed(self, auth_client):
        response = auth_client.post(
            "/api/v1/live/wayra/analyze",
            json={"lat": 41.88, "lng": -87.63, "speed_mph": 65, "weather_code": 61},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["alert_type"] == "weather_rain_speed"
        assert data["severity"] == "info"

    def test_wayra_analyze_no_alert(self, auth_client):
        response = auth_client.post(
            "/api/v1/live/wayra/analyze",
            json={
                "lat": 41.88,
                "lng": -87.63,
                "speed_mph": 45,
                "weather_code": 0,
                "active_reports": [],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["alert_type"] is None
        assert data["message"] is None

    def test_wayra_analyze_speed_advisory(self, auth_client):
        response = auth_client.post(
            "/api/v1/live/wayra/analyze",
            json={"lat": 41.88, "lng": -87.63, "speed_mph": 85},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["alert_type"] == "speed_advisory"
        assert data["severity"] == "info"

    def test_wayra_analyze_service_group_split(self):
        result = LiveService.wayra_analyze(
            {
                "lat": 41.88,
                "lng": -87.63,
                "speed_mph": 40,
                "member_positions": [
                    {"display_name": "Alex", "lat": 41.88, "lng": -87.63},
                    {"display_name": "Sam", "lat": 41.881, "lng": -87.631},
                    {"display_name": "Jordan", "lat": 41.85, "lng": -87.63},
                ],
            }
        )
        assert result["alert_type"] == "group_split"
