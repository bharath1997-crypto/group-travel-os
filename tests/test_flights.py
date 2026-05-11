from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.flight import FlightResult
from app.utils.auth import get_current_user

client = TestClient(app)


def _mock_user() -> MagicMock:
    user = MagicMock()
    user.id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    user.email = "test@example.com"
    user.full_name = "Test User"
    user.is_active = True
    return user


@pytest.fixture
def auth_header() -> dict[str, str]:
    app.dependency_overrides[get_current_user] = _mock_user
    yield {}
    app.dependency_overrides.pop(get_current_user, None)


def _sample_row() -> FlightResult:
    return FlightResult(
        id="row-1",
        price=299.0,
        currency="USD",
        airlines=["AA", "LH"],
        departure_at="2026-06-01T08:00:00.000000Z",
        arrival_at="2026-06-01T18:35:00.000000Z",
        origin="NYC",
        destination="LON",
        duration_minutes=395,
        deep_link="https://www.kiwi.com/booking",
        stops=1,
    )


def test_flight_search_returns_results(auth_header, monkeypatch):
    monkeypatch.setattr(
        "app.services.flight_service.FlightService.search_flights",
        lambda **kwargs: [_sample_row()],
    )
    res = client.get(
        "/api/v1/flights/search",
        params={
            "fly_from": "NYC",
            "fly_to": "LON",
            "date_from": "2026-06-01",
            "date_to": "2026-06-01",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["id"] == "row-1"
    assert body[0]["price"] == 299.0
    assert body[0]["stops"] == 1


def test_flight_search_missing_params_422(auth_header):
    res = client.get(
        "/api/v1/flights/search",
        params={
            "fly_from": "NYC",
            # missing fly_to and dates
        },
    )
    assert res.status_code == 422


def test_flight_search_requires_auth_401():
    """No dependency override — Kiwi must not be hit (no bearer)."""
    res = client.get(
        "/api/v1/flights/search",
        params={
            "fly_from": "NYC",
            "fly_to": "LON",
            "date_from": "2026-06-01",
            "date_to": "2026-06-01",
        },
    )
    assert res.status_code == 401
