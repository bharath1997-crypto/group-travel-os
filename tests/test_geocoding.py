from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.geocoding_service import clear_geocoding_cache_for_tests

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_geocoding_cache_for_tests()
    yield
    clear_geocoding_cache_for_tests()


def _mock_async_client_get(response: MagicMock):
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=response)
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None
    return mock_client


def test_geocoding_search_success():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {
            "place_id": 1,
            "lat": "40.7484",
            "lon": "-73.9855",
            "display_name": "Empire State Building, New York, NY, USA",
        }
    ]

    with patch(
        "app.services.geocoding_service.httpx.AsyncClient",
        return_value=_mock_async_client_get(mock_response),
    ):
        res = client.get("/api/v1/geocoding/search", params={"q": "Empire State Building"})

    assert res.status_code == 200
    body = res.json()
    assert isinstance(body, list)
    assert body[0]["display_name"].startswith("Empire State Building")


def test_geocoding_search_upstream_failure_returns_empty_list():
    mock_response = MagicMock()
    mock_response.status_code = 503
    mock_response.json.return_value = {"error": "upstream"}

    with patch(
        "app.services.geocoding_service.httpx.AsyncClient",
        return_value=_mock_async_client_get(mock_response),
    ):
        res = client.get("/api/v1/geocoding/search", params={"q": "Chicago"})

    assert res.status_code == 200
    assert res.json() == []


def test_geocoding_reverse_success():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "display_name": "646 North Michigan Avenue, Chicago, IL, USA",
        "name": "Starbucks Reserve",
        "address": {"city": "Chicago", "state": "Illinois"},
        "extratags": {"opening_hours": "24/7"},
    }

    with patch(
        "app.services.geocoding_service.httpx.AsyncClient",
        return_value=_mock_async_client_get(mock_response),
    ):
        res = client.get(
            "/api/v1/geocoding/reverse",
            params={"lat": 41.8947, "lng": -87.6233},
        )

    assert res.status_code == 200
    body = res.json()
    assert body["display_name"].startswith("646 North Michigan Avenue")
    assert body["extratags"]["opening_hours"] == "24/7"


def test_geocoding_reverse_upstream_failure_returns_empty_object():
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.json.return_value = {"error": "upstream"}

    with patch(
        "app.services.geocoding_service.httpx.AsyncClient",
        return_value=_mock_async_client_get(mock_response),
    ):
        res = client.get(
            "/api/v1/geocoding/reverse",
            params={"lat": 41.8947, "lng": -87.6233},
        )

    assert res.status_code == 200
    assert res.json() == {}


def test_geocoding_reverse_invalid_lat_returns_422():
    res = client.get(
        "/api/v1/geocoding/reverse",
        params={"lat": 999, "lng": -87.6233},
    )
    assert res.status_code == 422


def test_geocoding_reverse_invalid_lng_returns_422():
    res = client.get(
        "/api/v1/geocoding/reverse",
        params={"lat": 41.8947, "lng": 999},
    )
    assert res.status_code == 422


def test_geocoding_search_with_location_bias():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {
            "place_id": 2,
            "lat": "41.8781",
            "lon": "-87.6298",
            "display_name": "Chicago, Illinois, USA",
        }
    ]

    with patch(
        "app.services.geocoding_service.httpx.AsyncClient",
        return_value=_mock_async_client_get(mock_response),
    ) as client_factory:
        res = client.get(
            "/api/v1/geocoding/search",
            params={"q": "Chicago", "lat": 41.88, "lng": -87.63},
        )

    assert res.status_code == 200
    assert res.json()[0]["display_name"].startswith("Chicago")
    mock_client = client_factory.return_value.__aenter__.return_value
    call_kwargs = mock_client.get.await_args.kwargs
    assert call_kwargs["params"]["lat"] == 41.88
    assert call_kwargs["params"]["lon"] == -87.63
    assert "viewbox" in call_kwargs["params"]


def test_geocoding_search_validation_error_returns_422():
    res = client.get("/api/v1/geocoding/search", params={"q": ""})
    assert res.status_code == 422
