"""Tests for Live Tab L8.1 speed limits, route alerts, traveler chat."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.models.road_report import ReportType, RoadReport
from app.services import live_service
from app.services.live_service import LiveService, _traveler_id
from app.utils.auth import get_current_user
from tests.conftest import exec_result

_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_OTHER_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
_REPORT_ID = uuid.UUID("00000000-0000-0000-0000-000000000040")


def _mock_user(user_id: uuid.UUID = _USER_ID):
    user = type("User", (), {})()
    user.id = user_id
    user.is_active = True
    return user


@pytest.fixture(autouse=True)
def _reset():
    live_service._traveler_chat_rate.clear()
    yield
    app.dependency_overrides.pop(get_current_user, None)
    live_service._traveler_chat_rate.clear()


@pytest.fixture
def auth_client():
    app.dependency_overrides[get_current_user] = lambda: _mock_user()
    return TestClient(app, raise_server_exceptions=True)


def _report(
    report_type: ReportType,
    lat: float,
    lng: float,
    report_id: uuid.UUID = _REPORT_ID,
) -> RoadReport:
    now = datetime.now(timezone.utc)
    return RoadReport(
        id=report_id,
        reporter_id=_USER_ID,
        report_type=report_type,
        lat=lat,
        lng=lng,
        city="Chicago",
        description=None,
        confirmed_count=0,
        dismissed_count=0,
        is_active=True,
        expires_at=now + timedelta(hours=1),
        created_at=now,
    )


class TestSpeedLimit:
    @patch("app.services.live_service._fetch_speed_limit_from_overpass")
    def test_get_speed_limit_success(self, mock_overpass, auth_client):
        mock_overpass.return_value = {
            "speed_limit_mph": 55,
            "road_name": "I-55 South",
        }
        resp = auth_client.get(
            "/api/v1/live/speed-limit",
            params={"lat": 41.8781, "lng": -87.6298},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["speed_limit_mph"] == 55
        assert data["road_name"] == "I-55 South"

    @patch("app.services.live_service._fetch_speed_limit_from_overpass")
    def test_get_speed_limit_overpass_fail(self, mock_overpass, auth_client):
        mock_overpass.return_value = {"speed_limit_mph": None, "road_name": None}
        resp = auth_client.get(
            "/api/v1/live/speed-limit",
            params={"lat": 41.8781, "lng": -87.6298},
        )
        assert resp.status_code == 200
        assert resp.json()["speed_limit_mph"] is None


class TestRouteAlerts:
    def test_get_route_alerts_police_ahead(self, db, mock_user):
        report = _report(ReportType.police, 41.865, -87.6298)
        db.execute.return_value = exec_result(scalars_all=[report])
        result = LiveService.get_route_alerts(db, 41.8781, -87.6298, 180, 60)
        assert len(result["alerts"]) == 1
        assert result["alerts"][0]["report_type"] == "police"

    def test_get_route_alerts_police_behind(self, db, mock_user):
        report = _report(ReportType.police, 41.891, -87.6298)
        db.execute.return_value = exec_result(scalars_all=[report])
        result = LiveService.get_route_alerts(db, 41.8781, -87.6298, 180, 60)
        assert result["alerts"] == []

    def test_get_route_alerts_empty(self, db, mock_user):
        db.execute.return_value = exec_result(scalars_all=[])
        result = LiveService.get_route_alerts(db, 41.8781, -87.6298, 180, 60)
        assert result["alerts"] == []


class TestNearbyTravelers:
    @patch("app.services.live_service.get_rtdb")
    def test_get_nearby_travelers_success(self, mock_get_rtdb, auth_client):
        now = datetime.now(timezone.utc).isoformat()
        mock_get_rtdb.return_value = {
            str(_USER_ID): {"lat": 41.8781, "lng": -87.6298, "last_seen": now},
            str(_OTHER_ID): {
                "lat": 41.872,
                "lng": -87.6298,
                "bearing": 180,
                "last_seen": now,
            },
        }
        resp = auth_client.post(
            "/api/v1/live/travelers/nearby",
            json={"lat": 41.8781, "lng": -87.6298, "bearing": 180, "speed_mph": 60},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["traveler_id"] == _traveler_id(_USER_ID, _OTHER_ID)

    @patch("app.services.live_service.get_rtdb")
    def test_get_nearby_travelers_excludes_self(self, mock_get_rtdb, auth_client):
        now = datetime.now(timezone.utc).isoformat()
        mock_get_rtdb.return_value = {
            str(_USER_ID): {
                "lat": 41.8781,
                "lng": -87.6298,
                "bearing": 180,
                "last_seen": now,
            },
        }
        resp = auth_client.post(
            "/api/v1/live/travelers/nearby",
            json={"lat": 41.8781, "lng": -87.6298, "bearing": 180, "speed_mph": 60},
        )
        assert resp.status_code == 200
        assert resp.json() == []


class TestTravelerChat:
    @patch("app.services.live_service.set_rtdb")
    @patch("app.services.live_service.get_rtdb")
    def test_send_traveler_chat_success(self, mock_get_rtdb, mock_set_rtdb, mock_user):
        traveler_id = _traveler_id(_USER_ID, _OTHER_ID)
        mock_get_rtdb.side_effect = lambda path: (
            {str(_OTHER_ID): {"lat": 41.87, "lng": -87.63, "last_seen": datetime.now(timezone.utc).isoformat()}}
            if path == "live_locations"
            else None
        )
        result = LiveService.send_traveler_chat(
            _USER_ID,
            traveler_id,
            "Same route here",
            "session-abc",
        )
        assert result["text"] == "Same route here"
        mock_set_rtdb.assert_called_once()

    @patch("app.services.live_service.get_rtdb")
    def test_send_traveler_chat_blocked(self, mock_get_rtdb, mock_user):
        traveler_id = _traveler_id(_USER_ID, _OTHER_ID)
        mock_get_rtdb.return_value = {
            str(_OTHER_ID): {"lat": 41.87, "lng": -87.63, "last_seen": datetime.now(timezone.utc).isoformat()}
        }
        with pytest.raises(HTTPException) as exc:
            LiveService.send_traveler_chat(
                _USER_ID,
                traveler_id,
                "Visit https://example.com",
                "session-abc",
            )
        assert exc.value.status_code == 400
