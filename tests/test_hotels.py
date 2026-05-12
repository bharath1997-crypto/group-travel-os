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
    user.id = uuid.UUID("00000000-0000-0000-0000-000000000032")
    user.email = "hotels@example.com"
    user.full_name = "Hotels Tester"
    user.is_active = True
    return user


@pytest.fixture
def auth_header() -> dict[str, str]:
    app.dependency_overrides[get_current_user] = _mock_user
    yield {}
    app.dependency_overrides.pop(get_current_user, None)


def test_hotel_search_returns_results(auth_header):
    ci = date.today() + timedelta(days=10)
    co = ci + timedelta(days=3)
    res = client.get(
        "/api/v1/hotels/search",
        params={
            "location": "Toronto",
            "check_in": ci.isoformat(),
            "check_out": co.isoformat(),
            "adults": "2",
            "rooms": "1",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body, list)
    assert len(body) >= 1
    assert body[0]["booking_url"].startswith("https://tp.media/r")


def test_hotel_search_requires_auth_401():
    ci = date.today() + timedelta(days=5)
    res = client.get(
        "/api/v1/hotels/search",
        params={
            "location": "Miami",
            "check_in": ci.isoformat(),
            "check_out": (ci + timedelta(days=2)).isoformat(),
        },
    )
    assert res.status_code == 401


def test_hotel_search_missing_params_422(auth_header):
    res = client.get(
        "/api/v1/hotels/search",
        params={
            "location": "LA",
            "check_in": "2026-08-01",
        },
    )
    assert res.status_code == 422
