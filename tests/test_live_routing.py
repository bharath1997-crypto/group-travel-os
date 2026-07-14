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


def test_route_preview_allows_guest():
    from unittest.mock import patch, AsyncMock

    app.dependency_overrides.clear()
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

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get, patch(
        "app.services.live_routing_service.BorderCrossingService.detect_crossings",
        new_callable=AsyncMock,
        return_value=[],
    ):
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

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get, patch(
        "app.services.live_routing_service.BorderCrossingService.detect_crossings",
        new_callable=AsyncMock,
        return_value=[],
    ):
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


def test_route_preview_adds_last_mile_walk(auth_user):
    from unittest.mock import patch, AsyncMock

    drive_resp = MagicMock()
    drive_resp.status_code = 200
    drive_resp.json.return_value = {
        "code": "Ok",
        "routes": [
            {
                "distance": 1000.0,
                "duration": 120.0,
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[-87.63, 41.88], [-87.625, 41.885]],
                },
                "legs": [{"steps": []}],
            }
        ],
    }

    walk_resp = MagicMock()
    walk_resp.status_code = 200
    walk_resp.json.return_value = {
        "code": "Ok",
        "routes": [
            {
                "distance": 80.0,
                "duration": 70.0,
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[-87.625, 41.885], [-87.62, 41.89]],
                },
            }
        ],
    }

    async def mock_get(url, *args, **kwargs):
        if "/route/v1/foot/" in url:
            return walk_resp
        return drive_resp

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock, side_effect=mock_get), patch(
        "app.services.live_routing_service.BorderCrossingService.detect_crossings",
        new_callable=AsyncMock,
        return_value=[],
    ):
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
        assert body["lastMileMode"] == "walk"
        assert body["lastMileDistanceMeters"] == 80.0
        assert body["lastMileNotice"]
        assert len(body["geometry"]["coordinates"]) >= 3


def test_route_preview_includes_border_crossing(auth_user):
    from unittest.mock import patch, AsyncMock
    from app.schemas.live_routing import BorderCrossingOut

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
                    "coordinates": [[-87.63, 41.88], [-97.0, 49.0]],
                },
            }
        ],
    }

    crossing = BorderCrossingOut(
        latitude=49.0,
        longitude=-97.0,
        fromCountry="United States",
        toCountry="Canada",
        label="Immigration check — United States → Canada",
        highlightGeometry=[[-97.0, 48.9], [-97.0, 49.0]],
    )

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get, patch(
        "app.services.live_routing_service.BorderCrossingService.detect_crossings",
        new_callable=AsyncMock,
        return_value=[crossing],
    ), patch(
        "app.services.live_routing_service.BorderCrossingService.build_border_notice",
        return_value="Border notice",
    ):
        mock_get.return_value = mock_resp

        res = client.post(
            "/api/v1/live/route-preview",
            json={
                "origin": {
                    "latitude": 41.88,
                    "longitude": -87.63,
                    "source": "gps",
                    "country": "United States",
                },
                "destination": {
                    "latitude": 49.0,
                    "longitude": -97.0,
                    "name": "Emerson",
                    "country": "Canada",
                },
                "travelMode": "Drive",
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "ready"
        assert body["borderNotice"] == "Border notice"
        assert len(body["borderCrossings"]) == 1
        assert body["borderCrossings"][0]["toCountry"] == "Canada"
