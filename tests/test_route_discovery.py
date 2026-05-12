from __future__ import annotations

import uuid
from datetime import date
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.flight import FlightResult
from app.schemas.route import TransportMode, TransportOption
from app.utils.auth import get_current_user

client = TestClient(app)


def _mock_user():
    u = MagicMock()
    u.id = uuid.UUID("00000000-0000-4000-a000-000000000088")
    u.email = "routes@example.com"
    u.full_name = "Routes Tester"
    u.is_active = True
    return u


@pytest.fixture(autouse=True)
def _clear_auth():
    yield
    app.dependency_overrides.pop(get_current_user, None)


def _sample_flight() -> FlightResult:
    return FlightResult(
        id="f1",
        price=189.0,
        currency="USD",
        airlines=["AA"],
        departure_at="2026-07-01T14:00:00.000000Z",
        arrival_at="2026-07-01T17:35:00.000000Z",
        origin="ORD",
        destination="JFK",
        duration_minutes=215,
        deep_link="https://kiwi.example/book",
        stops=0,
    )



def test_route_search_combines_kiwi_and_ground(monkeypatch):
    app.dependency_overrides[get_current_user] = _mock_user

    monkeypatch.setattr(
        "app.services.route_service.FlightService.search_flights",
        lambda **kw: [_sample_flight()],
    )

    async def fake_ground(o: str, d: str):
        return [
            TransportOption(
                mode=TransportMode.DRIVE,
                summary=f"Drive {o} → {d}",
                duration_minutes=180,
                steps=["Merge onto highway"],
                booking_url="https://www.travelpayouts.com/?x=1",
                provider="Google Maps",
            ),
        ]

    monkeypatch.setattr(
        "app.services.route_service._get_ground_options_async",
        fake_ground,
    )

    r = client.get(
        "/api/v1/routes/search",
        params={
            "origin": "ORD",
            "destination": "JFK",
            "date": "2026-07-01",
            "adults": "1",
        },
    )

    assert r.status_code == 200
    body = r.json()
    assert body["origin"] == "ORD"
    assert body["destination"] == "JFK"
    modes = {o["mode"] for o in body["options"]}
    assert "flight" in modes
    assert "drive" in modes
    assert len(body["options"]) >= 2


def test_route_search_requires_auth_401():
    r = client.get(
        "/api/v1/routes/search",
        params={
            "origin": "ORD",
            "destination": "JFK",
            "date": date.today().isoformat(),
            "adults": "1",
        },
    )
    assert r.status_code == 401


def test_route_search_survives_kiwi_failure(monkeypatch):
    app.dependency_overrides[get_current_user] = _mock_user

    def boom(**kw):
        raise RuntimeError("kiwi simulated outage")

    monkeypatch.setattr(
        "app.services.route_service.FlightService.search_flights",
        boom,
    )

    async def fake_ground(o: str, d: str):
        return [
            TransportOption(
                mode=TransportMode.TRANSIT,
                summary=f"Transit {o} → {d}",
                duration_minutes=90,
                steps=["Board metro"],
                booking_url="https://www.travelpayouts.com/",
                provider="Google Maps",
            ),
        ]

    monkeypatch.setattr(
        "app.services.route_service._get_ground_options_async",
        fake_ground,
    )

    r = client.get(
        "/api/v1/routes/search",
        params={
            "origin": "CHI",
            "destination": "NYC",
            "date": "2026-08-01",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["options"]) == 1
    assert body["options"][0]["mode"] == "transit"
