from __future__ import annotations

import uuid
from datetime import date, timedelta
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.utils.auth import get_current_user

client = TestClient(app)


def _mock_user() -> MagicMock:
    user = MagicMock()
    user.id = uuid.UUID("00000000-0000-0000-0000-000000000033")
    user.email = "buses@example.com"
    user.full_name = "Buses Tester"
    user.is_active = True
    return user


@pytest.fixture
def auth_header() -> dict[str, str]:
    app.dependency_overrides[get_current_user] = _mock_user
    yield {}
    app.dependency_overrides.pop(get_current_user, None)


def test_bus_search_returns_results(auth_header):
    res = client.get(
        "/api/v1/buses/search",
        params={
            "origin": "NYC",
            "destination": "Boston",
            "date": (date.today() + timedelta(days=7)).isoformat(),
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert "results" in body
    assert isinstance(body["results"], list)
    assert len(body["results"]) >= 1


def test_bus_search_nyc_boston_200(auth_header):
    res = client.get(
        "/api/v1/buses/search",
        params={
            "origin": "New York",
            "destination": "Boston",
            "date": "2026-08-01",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["origin"] == "New York"
    assert body["destination"] == "Boston"
    assert len(body["results"]) >= 1


def test_bus_search_requires_auth_401():
    res = client.get(
        "/api/v1/buses/search",
        params={
            "origin": "NYC",
            "destination": "Boston",
            "date": "2026-08-01",
        },
    )
    assert res.status_code == 401


def test_bus_search_missing_origin_422(auth_header):
    res = client.get(
        "/api/v1/buses/search",
        params={
            "destination": "Boston",
            "date": "2026-08-01",
        },
    )
    assert res.status_code == 422


def test_bus_search_missing_destination_422(auth_header):
    res = client.get(
        "/api/v1/buses/search",
        params={
            "origin": "NYC",
            "date": "2026-08-01",
        },
    )
    assert res.status_code == 422


def test_bus_search_missing_date_422(auth_header):
    res = client.get(
        "/api/v1/buses/search",
        params={
            "origin": "NYC",
            "destination": "Boston",
        },
    )
    assert res.status_code == 422


def test_bus_results_have_booking_urls(auth_header):
    res = client.get(
        "/api/v1/buses/search",
        params={
            "origin": "NYC",
            "destination": "Boston",
            "date": "2026-08-01",
        },
    )
    assert res.status_code == 200
    body = res.json()
    for bus in body["results"]:
        assert "booking_url" in bus
        assert bus["booking_url"].startswith("https://tp.media/r")
