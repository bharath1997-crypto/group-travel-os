from __future__ import annotations

import uuid
from datetime import date
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
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


def test_route_search_returns_ground_options(monkeypatch):
    app.dependency_overrides[get_current_user] = _mock_user

    async def fake_ground(o: str, d: str):
        return [
            TransportOption(
                mode=TransportMode.DRIVE,
                summary=f"Drive {o} → {d}",
                duration_minutes=180,
                steps=["Merge onto highway"],
                booking_url="https://www.google.com/maps/dir/?api=1",
                provider="Google Maps",
            ),
            TransportOption(
                mode=TransportMode.TRANSIT,
                summary=f"Transit {o} → {d}",
                duration_minutes=90,
                steps=["Board metro"],
                booking_url="https://www.google.com/maps/dir/?api=1",
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
    assert modes == {"drive", "transit"}
    assert len(body["options"]) == 2


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


def test_route_search_survives_ground_failure(monkeypatch):
    app.dependency_overrides[get_current_user] = _mock_user

    async def boom(o: str, d: str):
        raise RuntimeError("google simulated outage")

    monkeypatch.setattr(
        "app.services.route_service._get_ground_options_async",
        boom,
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
    assert body["options"] == []
