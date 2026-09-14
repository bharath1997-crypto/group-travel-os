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
    ), patch(
        "app.services.live_routing_service.settings.google_routes_api_key",
        "",
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
    ), patch(
        "app.services.live_routing_service.settings.google_routes_api_key",
        "",
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
    ), patch(
        "app.services.live_routing_service.settings.google_routes_api_key",
        "",
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
        assert body["walkStartIndex"] == 1
        assert body["lastMileApproximate"] is False


def test_route_preview_last_mile_approximate_when_foot_unavailable(auth_user):
    from unittest.mock import patch, AsyncMock

    drive_resp = MagicMock()
    drive_resp.status_code = 200
    drive_resp.json.return_value = {
        "code": "Ok",
        "routes": [
            {
                "distance": 5000.0,
                "duration": 600.0,
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[-105.9, 35.8], [-105.85, 35.82]],
                },
                "legs": [{"steps": []}],
            }
        ],
    }

    empty_walk = MagicMock()
    empty_walk.status_code = 200
    empty_walk.json.return_value = {"code": "Ok", "routes": []}

    async def mock_get(url, *args, **kwargs):
        if "/route/v1/foot/" in url:
            return empty_walk
        return drive_resp

    async def mock_post(url, *args, **kwargs):
        resp = MagicMock()
        resp.status_code = 404
        return resp

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock, side_effect=mock_get), patch(
        "httpx.AsyncClient.post", new_callable=AsyncMock, side_effect=mock_post
    ), patch(
        "app.services.live_routing_service.BorderCrossingService.detect_crossings",
        new_callable=AsyncMock,
        return_value=[],
    ), patch(
        "app.services.live_routing_service.settings.google_routes_api_key",
        "test-google-key",
    ):
        res = client.post(
            "/api/v1/live/route-preview",
            json={
                "origin": {"latitude": 35.7, "longitude": -106.0, "source": "gps"},
                "destination": {
                    "latitude": 35.93572,
                    "longitude": -105.78893,
                    "name": "Sierra Mosca Trail",
                },
                "travelMode": "Drive",
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "ready"
        assert body["lastMileMode"] == "walk"
        assert body["lastMileApproximate"] is True
        assert body["walkStartIndex"] == 1
        assert len(body["geometry"]["coordinates"]) > 2


def test_route_preview_rejects_degenerate_zero_meter_foot(auth_user):
    from unittest.mock import patch, AsyncMock

    drive_resp = MagicMock()
    drive_resp.status_code = 200
    drive_resp.json.return_value = {
        "code": "Ok",
        "routes": [
            {
                "distance": 25000.0,
                "duration": 7000.0,
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[-107.2, 40.81], [-107.19, 40.812]],
                },
                "legs": [{"steps": []}],
            }
        ],
    }

    zero_walk = MagicMock()
    zero_walk.status_code = 200
    zero_walk.json.return_value = {
        "code": "Ok",
        "routes": [
            {
                "distance": 0.0,
                "duration": 0.0,
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[-107.19, 40.812], [-107.19, 40.812]],
                },
            }
        ],
    }

    async def mock_get(url, *args, **kwargs):
        if "/route/v1/foot/" in url:
            return zero_walk
        return drive_resp

    async def mock_post(url, *args, **kwargs):
        resp = MagicMock()
        resp.status_code = 404
        return resp

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock, side_effect=mock_get), patch(
        "httpx.AsyncClient.post", new_callable=AsyncMock, side_effect=mock_post
    ), patch(
        "app.services.live_routing_service.BorderCrossingService.detect_crossings",
        new_callable=AsyncMock,
        return_value=[],
    ), patch(
        "app.services.live_routing_service.settings.google_routes_api_key",
        "",
    ):
        res = client.post(
            "/api/v1/live/route-preview",
            json={
                "origin": {"latitude": 40.7, "longitude": -107.3, "source": "gps"},
                "destination": {
                    "latitude": 40.81301,
                    "longitude": -107.18569,
                    "name": "Slater Park Road",
                },
                "travelMode": "Drive",
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "ready"
        assert body["lastMileMode"] == "walk"
        assert body["lastMileApproximate"] is True
        assert (body["lastMileDistanceMeters"] or 0) > 100
        assert body["walkStartIndex"] == 1
        coords = body["geometry"]["coordinates"]
        assert len(coords) > 2
        end_lng, end_lat = coords[-1]
        assert abs(end_lat - 40.81301) < 0.001
        assert abs(end_lng - (-107.18569)) < 0.001


def test_route_preview_google_drive_alternatives(auth_user):
    from unittest.mock import patch, AsyncMock
    from app.schemas.live_routing import GeoJSONGeometry, RouteAlternativeOut

    toll_alt = RouteAlternativeOut(
        id="with_tolls",
        label="Fastest route",
        tollLabel="Tolls likely",
        hasTolls=True,
        distanceMeters=180000.0,
        durationSeconds=7200.0,
        geometry=GeoJSONGeometry(
            type="LineString",
            coordinates=[[-87.63, 41.88], [-89.0, 42.2], [-89.63, 42.22]],
        ),
        provider="google",
    )
    no_toll_alt = RouteAlternativeOut(
        id="avoid_tolls",
        label="Avoid tolls",
        tollLabel="No tolls",
        hasTolls=False,
        distanceMeters=195000.0,
        durationSeconds=7800.0,
        geometry=GeoJSONGeometry(
            type="LineString",
            coordinates=[[-87.63, 41.88], [-88.5, 41.95], [-89.63, 42.22]],
        ),
        provider="google",
    )

    with patch(
        "app.services.live_routing_service.fetch_google_drive_alternatives",
        new_callable=AsyncMock,
        return_value=[toll_alt, no_toll_alt],
    ), patch(
        "app.services.live_routing_service.append_last_mile_walk",
        new_callable=AsyncMock,
        side_effect=lambda _c, coords, dist, dur, man, *_args: (
            coords,
            dist,
            dur,
            man,
            None,
            None,
        ),
    ), patch(
        "app.services.live_routing_service.BorderCrossingService.detect_crossings",
        new_callable=AsyncMock,
        return_value=[],
    ), patch(
        "app.services.live_routing_service.settings.google_routes_api_key",
        "test-google-key",
    ), patch(
        "app.services.live_routing_service.is_land_connected_drive_route",
        return_value=True,
    ):
        res = client.post(
            "/api/v1/live/route-preview",
            json={
                "origin": {"latitude": 41.88, "longitude": -87.63, "source": "gps"},
                "destination": {
                    "latitude": 42.22,
                    "longitude": -89.63,
                    "name": "IL 26",
                },
                "travelMode": "Drive",
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "ready"
        assert body["provider"] == "google"
        assert body["alternatives"] is not None
        assert len(body["alternatives"]) == 2
        assert body["alternatives"][0]["id"] == "with_tolls"
        assert body["alternatives"][1]["id"] == "avoid_tolls"


def test_build_osrm_alternatives_dedupes_primary():
    from app.services.live_routing_service import build_osrm_alternatives

    primary = [[-87.63, 41.88], [-87.62, 41.89]]
    routes = [
        {"distance": 1000, "duration": 120, "geometry": {"coordinates": primary}},
        {
            "distance": 1100,
            "duration": 130,
            "geometry": {"coordinates": [[-87.63, 41.88], [-87.61, 41.885], [-87.62, 41.89]]},
        },
    ]
    alts = build_osrm_alternatives(routes, primary)
    assert len(alts) == 1
    assert alts[0].id == "osrm_alt_2"


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
                    "coordinates": [
                        [-87.63, 41.88],
                        [-88.5, 42.5],
                        [-89.5, 43.2],
                        [-90.5, 44.0],
                        [-91.5, 45.0],
                        [-93.0, 46.5],
                        [-94.5, 47.5],
                        [-96.0, 48.5],
                        [-97.0, 49.0],
                    ],
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
    ), patch(
        "app.services.live_routing_service.settings.google_routes_api_key",
        "",
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
