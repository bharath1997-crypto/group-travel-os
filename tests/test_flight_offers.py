"""Tests for flight offer detail and reprice endpoints."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.flight_offer import FlightOfferDetail, FlightOfferPriceResponse
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


def _sample_detail() -> FlightOfferDetail:
    return FlightOfferDetail(
        id="off_abc",
        price=217.0,
        currency="USD",
        airlines=["AA"],
        departure_at="2026-08-22T08:30:00Z",
        arrival_at="2026-08-22T10:51:00Z",
        origin="ORD",
        destination="LAX",
        duration_minutes=261,
        stops=0,
    )


@patch("app.routes.flights.FlightOfferService.get_offer_detail")
def test_get_flight_offer_200(mock_get, auth_header):
    mock_get.return_value = _sample_detail()
    res = client.get("/api/v1/flights/offers/off_abc")
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == "off_abc"
    assert body["origin"] == "ORD"


def test_get_flight_offer_requires_auth_401():
    res = client.get("/api/v1/flights/offers/off_abc")
    assert res.status_code == 401


@patch("app.routes.flights.FlightOfferService.reprice_offer")
def test_reprice_flight_offer_200(mock_reprice, auth_header):
    mock_reprice.return_value = FlightOfferPriceResponse(
        offer_id="off_abc",
        previous_price=217.0,
        current_price=231.0,
        currency="USD",
        price_changed=True,
        price_increased=True,
        message="The fare changed from 217.00 to 231.00 USD.",
    )
    res = client.post(
        "/api/v1/flights/offers/off_abc/price",
        params={"previous_price": 217.0},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["price_changed"] is True
    assert body["current_price"] == 231.0


def test_reprice_flight_offer_requires_auth_401():
    res = client.post("/api/v1/flights/offers/off_abc/price")
    assert res.status_code == 401
