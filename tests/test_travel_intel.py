from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
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


def _sample_weather() -> dict:
    return {
        "temp": 22.5,
        "description": "clear sky",
        "humidity": 55,
        "wind_speed": 3.2,
    }


def _sample_events() -> list[dict]:
    return [
        {
            "name": "Tokyo Jazz Night",
            "date": "2026-06-01",
            "venue": "Blue Note Tokyo",
            "url": "https://ticketmaster.com/example",
        }
    ]


def _sample_places() -> list[dict]:
    return [
        {
            "name": "Senso-ji Temple",
            "rating": 4.7,
            "address": "2 Chome-3-1 Asakusa, Tokyo",
            "photo_reference": "photo_ref_123",
        }
    ]


def test_weather_endpoint_returns_data(auth_header, monkeypatch):
    monkeypatch.setattr(
        "app.routes.travel_intel.get_weather",
        lambda city: _sample_weather(),
    )
    res = client.get("/api/v1/travel/weather", params={"city": "Tokyo"})
    assert res.status_code == 200
    body = res.json()
    assert body["temp"] == 22.5
    assert body["description"] == "clear sky"
    assert body["humidity"] == 55
    assert body["wind_speed"] == 3.2


def test_events_endpoint_returns_data(auth_header, monkeypatch):
    monkeypatch.setattr(
        "app.routes.travel_intel.get_events",
        lambda city: _sample_events(),
    )
    res = client.get("/api/v1/travel/events", params={"city": "Tokyo"})
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["name"] == "Tokyo Jazz Night"
    assert body[0]["venue"] == "Blue Note Tokyo"


def test_places_endpoint_returns_data(auth_header, monkeypatch):
    monkeypatch.setattr(
        "app.routes.travel_intel.get_places",
        lambda city: _sample_places(),
    )
    res = client.get("/api/v1/travel/places", params={"city": "Tokyo"})
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["name"] == "Senso-ji Temple"
    assert body[0]["rating"] == 4.7


def test_combined_intel_endpoint(auth_header, monkeypatch):
    monkeypatch.setattr(
        "app.routes.travel_intel.get_weather",
        lambda city: _sample_weather(),
    )
    monkeypatch.setattr(
        "app.routes.travel_intel.get_events",
        lambda city: _sample_events(),
    )
    monkeypatch.setattr(
        "app.routes.travel_intel.get_places",
        lambda city: _sample_places(),
    )
    res = client.get("/api/v1/travel/intel", params={"city": "Tokyo"})
    assert res.status_code == 200
    body = res.json()
    assert body["city"] == "Tokyo"
    assert body["weather"]["temp"] == 22.5
    assert len(body["events"]) == 1
    assert len(body["places"]) == 1
    assert "generated_at" in body


def test_travel_intel_requires_auth_401():
    res = client.get("/api/v1/travel/intel", params={"city": "Tokyo"})
    assert res.status_code == 401
