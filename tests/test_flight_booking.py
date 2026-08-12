from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.utils.auth import get_current_user

client = TestClient(app)


def _mock_user() -> MagicMock:
    user = MagicMock()
    user.id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    user.email = "test@example.com"
    user.is_active = True
    return user


@pytest.fixture
def auth_header():
    app.dependency_overrides[get_current_user] = _mock_user
    yield {}
    app.dependency_overrides.pop(get_current_user, None)


@patch("app.services.flight_booking_service.create_order")
@patch("app.services.flight_booking_service.get_offer")
def test_flight_book_success(mock_get_offer, mock_create_order, auth_header):
    mock_get_offer.return_value = {
        "id": "off_123",
        "total_amount": "220.00",
        "total_currency": "USD",
        "passengers": [{"id": "pas_1", "type": "adult"}],
    }
    mock_create_order.return_value = {
        "id": "ord_123",
        "booking_reference": "ABC123",
        "total_amount": "220.00",
        "total_currency": "USD",
        "live_mode": False,
    }

    res = client.post(
        "/api/v1/flights/book",
        json={
            "offer_id": "off_123",
            "passengers": [
                {
                    "given_name": "Tony",
                    "family_name": "Stark",
                    "email": "tony@example.com",
                    "phone_number": "+14155550100",
                    "born_on": "1980-07-24",
                }
            ],
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["booking_reference"] == "ABC123"
    assert body["live_mode"] is False


def test_flight_book_requires_auth_401():
    res = client.post(
        "/api/v1/flights/book",
        json={
            "offer_id": "off_123",
            "passengers": [
                {
                    "given_name": "Tony",
                    "family_name": "Stark",
                    "email": "tony@example.com",
                    "phone_number": "+14155550100",
                    "born_on": "1980-07-24",
                }
            ],
        },
    )
    assert res.status_code == 401
