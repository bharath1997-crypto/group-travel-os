from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.live_preview_actions import (
    LiveAddLocationResponse,
    LiveStartDirectionResponse,
)
from app.schemas.live_routing import GeoJSONGeometry, RoutePreviewResponse
from app.utils.auth import get_current_user

client = TestClient(app)


@pytest.fixture
def auth_user():
    user = MagicMock()
    user.id = uuid4()
    app.dependency_overrides[get_current_user] = lambda: user
    yield user
    app.dependency_overrides.pop(get_current_user, None)


def test_add_location_requires_auth():
    app.dependency_overrides.clear()
    res = client.post(
        "/api/v1/live/places/add-location",
        json={
            "lat": 41.88,
            "lng": -87.63,
            "name": "Test place",
        },
    )
    assert res.status_code == 401


def test_add_location_validation_error(auth_user):
    res = client.post(
        "/api/v1/live/places/add-location",
        json={
            "lat": 41.88,
            "lng": -87.63,
            "name": "",
        },
    )
    assert res.status_code == 422


def test_add_location_success(auth_user):
    with patch(
        "app.routes.live_preview_actions.LivePreviewActionService.add_location"
    ) as mock_add:
        pin_id = uuid4()
        mock_add.return_value = LiveAddLocationResponse(
            pinId=pin_id,
            name="Test place",
            latitude=41.88,
            longitude=-87.63,
            created=True,
        )
        res = client.post(
            "/api/v1/live/places/add-location",
            json={
                "lat": 41.88,
                "lng": -87.63,
                "name": "Test place",
                "address": "123 Main St",
            },
        )
        assert res.status_code == 201
        body = res.json()
        assert body["pinId"] == str(pin_id)
        assert body["created"] is True


def test_start_direction_validation_error():
    app.dependency_overrides.clear()
    res = client.post(
        "/api/v1/live/directions/start",
        json={
            "origin": {"latitude": 41.88, "longitude": -87.63, "source": "gps"},
            "destination": {"latitude": 41.89, "longitude": -87.62},
            "travelMode": "invalid_mode",
        },
    )
    assert res.status_code == 422


def test_start_direction_success_guest():
    app.dependency_overrides.clear()
    route = RoutePreviewResponse(
        status="ready",
        distanceMeters=1500.0,
        durationSeconds=300.0,
        geometry=GeoJSONGeometry(
            type="LineString",
            coordinates=[[-87.63, 41.88], [-87.62, 41.89]],
        ),
        maneuvers=[],
        provider="osrm",
        message=None,
    )

    with patch(
        "app.routes.live_preview_actions.LivePreviewActionService.start_direction",
        new_callable=AsyncMock,
    ) as mock_start:
        mock_start.return_value = LiveStartDirectionResponse(
            status="ready",
            sessionId=None,
            route=route,
            message=None,
        )
        res = client.post(
            "/api/v1/live/directions/start",
            json={
                "origin": {"latitude": 41.88, "longitude": -87.63, "source": "gps"},
                "destination": {"latitude": 41.89, "longitude": -87.62, "name": "Target"},
                "travelMode": "Drive",
            },
        )
        assert res.status_code == 200
        assert res.json()["status"] == "ready"


def test_start_direction_failed_route():
    app.dependency_overrides.clear()
    with patch(
        "app.routes.live_preview_actions.LivePreviewActionService.start_direction",
        new_callable=AsyncMock,
    ) as mock_start:
        mock_start.return_value = LiveStartDirectionResponse(
            status="failed",
            sessionId=None,
            route=None,
            message="No route found for selected travel mode.",
        )
        res = client.post(
            "/api/v1/live/directions/start",
            json={
                "origin": {"latitude": 41.88, "longitude": -87.63, "source": "gps"},
                "destination": {"latitude": 41.89, "longitude": -87.62, "name": "Target"},
                "travelMode": "Drive",
            },
        )
        assert res.status_code == 200
        assert res.json()["status"] == "failed"
