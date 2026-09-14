from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.live_place_reports import (
    LivePlaceReportCreateResponse,
    LivePlaceReportNearbyResponse,
    LivePlaceReportSummary,
)
from app.utils.auth import get_current_user

client = TestClient(app)


@pytest.fixture
def auth_user():
    user = MagicMock()
    user.id = uuid4()
    app.dependency_overrides[get_current_user] = lambda: user
    yield user
    app.dependency_overrides.pop(get_current_user, None)


def test_create_place_report_requires_auth():
    app.dependency_overrides.clear()
    res = client.post(
        "/api/v1/live/place-reports",
        json={
            "lat": 41.88,
            "lng": -87.63,
            "reportType": "packed",
        },
    )
    assert res.status_code == 401


def test_create_place_report_validation_error(auth_user):
    res = client.post(
        "/api/v1/live/place-reports",
        json={
            "lat": 41.88,
            "lng": -87.63,
            "reportType": "invalid_type",
        },
    )
    assert res.status_code == 422


def test_create_place_report_success(auth_user):
    report_id = uuid4()
    expires = datetime(2026, 9, 12, 12, 0, tzinfo=timezone.utc)
    with patch(
        "app.routes.live_place_reports.LivePlaceReportService.create_report"
    ) as mock_create:
        mock_create.return_value = LivePlaceReportCreateResponse(
            id=report_id,
            reportType="quiet",
            lat=41.88,
            lng=-87.63,
            placeName="Test Cafe",
            expiresAt=expires,
            matchCount=1,
            confirmed=False,
        )
        res = client.post(
            "/api/v1/live/place-reports",
            json={
                "lat": 41.88,
                "lng": -87.63,
                "reportType": "quiet",
                "placeName": "Test Cafe",
            },
        )
        assert res.status_code == 201
        body = res.json()
        assert body["id"] == str(report_id)
        assert body["reportType"] == "quiet"
        assert body["matchCount"] == 1
        assert body["confirmed"] is False


def test_list_nearby_place_reports_success():
    now = datetime(2026, 9, 12, 10, 0, tzinfo=timezone.utc)
    with patch(
        "app.routes.live_place_reports.LivePlaceReportService.list_nearby"
    ) as mock_list:
        mock_list.return_value = LivePlaceReportNearbyResponse(
            reports=[
                LivePlaceReportSummary(
                    reportType="long_line",
                    lat=41.881,
                    lng=-87.631,
                    placeName="Queue Spot",
                    placeKey=None,
                    matchCount=3,
                    confirmed=True,
                    latestAt=now,
                )
            ],
            ttlMinutes=120,
            confirmThreshold=3,
        )
        res = client.get(
            "/api/v1/live/place-reports/nearby",
            params={"lat": 41.88, "lng": -87.63},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["ttlMinutes"] == 120
        assert body["confirmThreshold"] == 3
        assert len(body["reports"]) == 1
        assert body["reports"][0]["confirmed"] is True


def test_list_nearby_place_reports_validation_error():
    res = client.get("/api/v1/live/place-reports/nearby")
    assert res.status_code == 422
