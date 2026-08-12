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


def test_flight_search_no_estimated_results_without_flag(auth_header, monkeypatch):
    monkeypatch.setattr("app.services.flight_service.settings.duffel_api_key", "")
    monkeypatch.setattr("app.services.flight_service.settings.allow_estimated_flights", False)
    monkeypatch.setattr("app.services.flight_service.settings.flight_live_provider", "discovery")
    res = client.get(
        "/api/v1/flights/search",
        params={
            "fly_from": "CHI",
            "fly_to": "HYD",
            "date_from": "2026-09-01",
            "date_to": "2026-09-01",
        },
    )
    assert res.status_code == 200
    assert res.json() == []


def test_flight_search_post_round_trip(auth_header, monkeypatch):
    from app.schemas.flight_journey import FlightJourney, FlightJourneySearchResponse, FlightJourneySlice

    future_depart = "2026-10-10T08:00:00Z"
    sample = FlightJourney(
        id="off_1",
        provider_offer_id="off_1",
        price=980,
        currency="USD",
        checked_at="2026-09-01T00:00:00Z",
        expires_at="2026-10-01T12:00:00Z",
        live_mode=False,
        slices=[
            FlightJourneySlice(origin="ORD", destination="HYD", duration_minutes=1000, stops=1, segments=[]),
            FlightJourneySlice(origin="HYD", destination="ORD", duration_minutes=1100, stops=1, segments=[]),
        ],
        total_duration_minutes=2100,
        airlines=["QR"],
        departure_at=future_depart,
        arrival_at="2026-10-25T14:30:00Z",
        origin="ORD",
        destination="ORD",
        duration_minutes=2100,
        stops=2,
    )
    monkeypatch.setattr(
        "app.services.flight_journey_service.FlightJourneyService.search",
        lambda body: FlightJourneySearchResponse(journeys=[sample], provider="duffel", live_mode=False),
    )
    res = client.post(
        "/api/v1/flights/search",
        json={
            "trip_type": "round_trip",
            "slices": [
                {"origin": "ORD", "destination": "HYD", "departure_date": "2026-10-10"},
                {"origin": "HYD", "destination": "ORD", "departure_date": "2026-10-25"},
            ],
            "passengers": [{"type": "adult", "age": 32}],
            "cabin": "economy",
            "maximum_connections": 1,
            "currency": "USD",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body["journeys"]) == 1
    assert len(body["journeys"][0]["slices"]) == 2


def test_flight_search_discovery_mode_only_when_explicitly_allowed(auth_header, monkeypatch):
    monkeypatch.setattr("app.services.flight_service.settings.duffel_api_key", "")
    monkeypatch.setattr("app.services.flight_service.settings.kiwi_api_key", "")
    monkeypatch.setattr("app.services.flight_service.settings.travelpayouts_api_token", "")
    monkeypatch.setattr("app.services.flight_service.settings.flight_live_provider", "discovery")
    monkeypatch.setattr("app.services.flight_service.settings.allow_estimated_flights", True)
    from app.services.flight_service import _flight_cache

    _flight_cache.clear()
    res = client.get(
        "/api/v1/flights/search",
        params={
            "fly_from": "CHI",
            "fly_to": "HYD",
            "date_from": "2026-09-01",
            "date_to": "2026-09-01",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body) >= 1
    assert body[0]["id"].startswith("rovvy-")


def test_flight_search_missing_params_422(auth_header):
    res = client.get(
        "/api/v1/flights/search",
        params={
            "fly_from": "NYC",
            # missing fly_to and dates
        },
    )
    assert res.status_code == 422


def test_flight_search_allows_public_guest_access_200(monkeypatch):
    """Unauthenticated guest users can search flights publicly without 401."""
    monkeypatch.setattr(
        "app.services.flight_service.FlightService.search_flights",
        lambda **kwargs: [_sample_row()],
    )
    res = client.get(
        "/api/v1/flights/search",
        params={
            "fly_from": "NYC",
            "fly_to": "LON",
            "date_from": "2026-09-01",
            "date_to": "2026-09-01",
        },
    )
    assert res.status_code == 200


def test_get_flight_order_success(auth_header, monkeypatch):
    from app.schemas.flight_booking import FlightOrderResponse
    monkeypatch.setattr(
        "app.services.flight_booking_service.FlightBookingService.get_order_detail",
        lambda order_id: FlightOrderResponse(
            id=order_id,
            booking_reference="ABCDEF",
            status="confirmed",
            total_amount=350.0,
            currency="USD",
            available_actions=["cancel"],
        ),
    )
    res = client.get("/api/v1/flights/orders/ord_123456")
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == "ord_123456"
    assert body["booking_reference"] == "ABCDEF"
    assert body["status"] == "confirmed"


def test_cancel_quote_success(auth_header, monkeypatch):
    from app.schemas.flight_booking import FlightCancelQuoteResponse
    monkeypatch.setattr(
        "app.services.flight_booking_service.FlightBookingService.cancel_quote",
        lambda order_id: FlightCancelQuoteResponse(
            cancellation_id="noc_12345",
            order_id=order_id,
            refund_amount=320.0,
            currency="USD",
        ),
    )
    res = client.post("/api/v1/flights/orders/ord_123456/cancel-quote")
    assert res.status_code == 200
    body = res.json()
    assert body["cancellation_id"] == "noc_12345"
    assert body["refund_amount"] == 320.0


def test_get_seatmaps_success(auth_header, monkeypatch):
    monkeypatch.setattr(
        "app.services.flight_offer_service.FlightOfferService.get_seat_maps",
        lambda offer_id: [{"id": "sea_123", "cabins": []}],
    )
    res = client.get("/api/v1/flights/offers/off_12345/seatmaps")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["id"] == "sea_123"

