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

    with patch("app.services.flight_booking_service.settings") as mocked_settings:
        mocked_settings.duffel_api_key = "duffel_test_key"
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


@patch("app.services.flight_booking_service.get_order")
def test_order_detail_normalizes_duffel_airport_objects(mock_get_order, auth_header):
    airport_ord = {
        "iata_country_code": "US",
        "iata_city_code": "CHI",
        "city_name": "Chicago",
        "icao_code": "KORD",
        "iata_code": "ORD",
        "type": "airport",
        "name": "O'Hare International Airport",
        "id": "arp_ord",
    }
    airport_nag = {
        "iata_country_code": "IN",
        "iata_city_code": "NAG",
        "city_name": "Nagpur",
        "icao_code": "VANP",
        "iata_code": "NAG",
        "type": "airport",
        "name": "Dr. Babasaheb Ambedkar International Airport",
        "id": "arp_nag",
    }
    mock_get_order.return_value = {
        "id": "ord_123",
        "booking_references": [{"booking_reference": "ABC123"}],
        "total_amount": "458.28",
        "total_currency": "USD",
        "slices": [
            {
                "origin": airport_ord,
                "destination": airport_nag,
                "duration": "PT17H25M",
                "segments": [
                    {
                        "origin": airport_ord,
                        "destination": airport_nag,
                        "departing_at": "2026-09-03T01:32:00",
                        "arriving_at": "2026-09-03T05:27:00",
                        "duration": "PT17H25M",
                        "marketing_carrier": {"iata_code": "ZZ", "name": "Duffel Airways"},
                        "marketing_carrier_flight_number": "6846",
                    }
                ],
            }
        ],
        "passengers": [],
        "available_actions": [],
        "live_mode": False,
    }

    with patch("app.services.flight_booking_service.settings") as mocked_settings:
        mocked_settings.duffel_api_key = "duffel_test_key"
        response = client.get("/api/v1/flights/orders/ord_123")

    assert response.status_code == 200
    body = response.json()
    assert body["slices"][0]["origin"] == "ORD"
    assert body["slices"][0]["destination"] == "NAG"
    assert body["slices"][0]["duration_minutes"] == 1045
    assert body["slices"][0]["segments"][0]["origin"] == "ORD"
    assert body["slices"][0]["segments"][0]["destination"] == "NAG"
