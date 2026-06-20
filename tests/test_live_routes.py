"""Route-level tests for Live Tab API."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.road_report import ReportType
from app.utils.auth import get_current_user
from app.utils.exceptions import AppException

_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_REPORT_ID = uuid.UUID("00000000-0000-0000-0000-000000000030")


def _mock_user() -> MagicMock:
    user = MagicMock()
    user.id = _USER_ID
    user.email = "live@example.com"
    user.is_active = True
    return user


def _mock_report() -> MagicMock:
    now = datetime.now(timezone.utc)
    report = MagicMock()
    report.id = _REPORT_ID
    report.reporter_id = _USER_ID
    report.report_type = ReportType.traffic
    report.lat = 41.8781
    report.lng = -87.6298
    report.city = "Chicago"
    report.description = None
    report.confirmed_count = 0
    report.dismissed_count = 0
    report.is_active = True
    report.expires_at = now + timedelta(minutes=45)
    report.created_at = now
    return report


@pytest.fixture(autouse=True)
def _reset_overrides():
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def auth_client():
    app.dependency_overrides[get_current_user] = _mock_user
    return TestClient(app, raise_server_exceptions=True)


class TestNearbyReportsPublic:
    @patch("app.routes.live.LiveService.get_nearby_reports")
    def test_get_nearby_reports_no_auth(self, mock_nearby):
        mock_nearby.return_value = [_mock_report()]
        client = TestClient(app, raise_server_exceptions=True)
        resp = client.get(
            "/api/v1/live/reports/nearby",
            params={"lat": 41.8781, "lng": -87.6298, "radius_km": 5},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) == 1
        mock_nearby.assert_called_once()

    @patch("app.routes.live.LiveService.get_nearby_reports")
    def test_get_nearby_reports_with_auth(self, mock_nearby, auth_client):
        mock_nearby.return_value = [_mock_report()]
        resp = auth_client.get(
            "/api/v1/live/reports/nearby",
            params={"lat": 41.8781, "lng": -87.6298, "radius_km": 5},
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 1
