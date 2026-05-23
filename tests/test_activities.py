from __future__ import annotations

import uuid
from datetime import date
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.utils.auth import get_current_user

client = TestClient(app)


def _mock_user() -> MagicMock:
    user = MagicMock()
    user.id = uuid.UUID("00000000-0000-0000-0000-000000000031")
    user.email = "act@example.com"
    user.full_name = "Activities Tester"
    user.is_active = True
    return user


@pytest.fixture
def auth_header() -> dict[str, str]:
    app.dependency_overrides[get_current_user] = _mock_user
    yield {}
    app.dependency_overrides.pop(get_current_user, None)


def test_activity_search_returns_results(auth_header):
    res = client.get(
        "/api/v1/activities/search",
        params={
            "location": "NYC",
            "date": "2026-07-01",
            "adults": "2",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body, list)
    assert len(body) >= 1
    assert body[0]["booking_url"].startswith("https://tp.media/r")


def test_activity_search_requires_auth_401():
    res = client.get(
        "/api/v1/activities/search",
        params={
            "location": "Chicago",
            "date": date.today().isoformat(),
            "adults": "1",
        },
    )
    assert res.status_code == 401


def test_activity_search_missing_location_422(auth_header):
    res = client.get(
        "/api/v1/activities/search",
        params={
            "date": "2026-07-01",
            "adults": "1",
        },
    )
    assert res.status_code == 422


def test_activity_search_dynamic_location(auth_header):
    res = client.get(
        "/api/v1/activities/search",
        params={
            "location": "Hyderabad",
            "date": "2026-07-01",
            "adults": "1",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body, list)
    assert len(body) == 5
    assert any("Hyderabad" in a["title"] for a in body)
    assert body[0]["booking_url"].startswith("https://tp.media/r")
