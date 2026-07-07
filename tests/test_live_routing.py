from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.utils.auth import get_current_user

client = TestClient(app)


@pytest.fixture
def auth_user():
    user = MagicMock()
    user.id = uuid4()
    app.dependency_overrides[get_current_user] = lambda: user
    yield user
    app.dependency_overrides.pop(get_current_user, None)


def test_route_preview_requires_auth():
    app.dependency_overrides.clear()
    res = client.post(
        "/api/v1/live/route-preview",
        json={
            "origin": {"latitude": 41.88, "longitude": -87.63, "source": "gps"},
            "destination": {"latitude": 41.89, "longitude": -87.62, "name": "Target"},
            "travelMode": "Drive",
        },
    )
    assert res.status_code == 401


def test_route_preview_validation_error(auth_user):
    res = client.post(
        "/api/v1/live/route-preview",
        json={
            "origin": {"latitude": 41.88, "longitude": -87.63},
            "destination": {"latitude": 41.89, "longitude": -87.62},
            "travelMode": "invalid_mode",
        },
    )
    assert res.status_code == 422


def test_route_preview_success(auth_user):
    from unittest.mock import patch, AsyncMock
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
                    "coordinates": [[-87.63, 41.88], [-87.62, 41.89]],
                },
            }
        ],
    }

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp

        res = client.post(
            "/api/v1/live/route-preview",
            json={
                "origin": {"latitude": 41.88, "longitude": -87.63, "source": "gps"},
                "destination": {"latitude": 41.89, "longitude": -87.62, "name": "Target"},
                "travelMode": "Drive",
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "ready"
        assert body["distanceMeters"] == 1500.0
        assert body["durationSeconds"] == 300.0
        assert body["geometry"]["type"] == "LineString"
        assert body["geometry"]["coordinates"] == [[-87.63, 41.88], [-87.62, 41.89]]
