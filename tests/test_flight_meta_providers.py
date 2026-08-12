from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from app.schemas.flight import FlightResult
from app.services.flight_meta_providers import _parse_kiwi_offer, merge_flight_results
from app.services.flight_service import FlightService
from config import settings


def test_parse_kiwi_offer():
    row = {
        "id": "abc123",
        "price": 512.0,
        "currency": "USD",
        "flyFrom": "ORD",
        "flyTo": "HYD",
        "airlines": ["QR", "AA"],
        "deep_link": "https://www.kiwi.com/booking?flightsId=abc123",
        "duration": {"total": 63000},
        "route": [
            {
                "flyFrom": "ORD",
                "flyTo": "DOH",
                "local_departure": "2026-09-01T18:30:00",
                "local_arrival": "2026-09-02T16:10:00",
            },
            {
                "flyFrom": "DOH",
                "flyTo": "HYD",
                "local_departure": "2026-09-02T19:00:00",
                "local_arrival": "2026-09-03T02:15:00",
            },
        ],
    }
    parsed = _parse_kiwi_offer(row, "USD")
    assert parsed is not None
    assert parsed.id == "kiwi-abc123"
    assert parsed.price == 512.0
    assert parsed.stops == 1
    assert parsed.airlines == ["QR", "AA"]
    assert "kiwi.com" in parsed.deep_link


def test_merge_flight_results_dedupes_and_sorts():
    a = FlightResult(
        id="a",
        price=500,
        currency="USD",
        airlines=["AA"],
        departure_at="2026-09-01T08:00:00",
        arrival_at="2026-09-01T18:00:00",
        origin="CHI",
        destination="HYD",
        duration_minutes=600,
        deep_link="",
        stops=1,
    )
    b = FlightResult(
        id="b",
        price=450,
        currency="USD",
        airlines=["QR"],
        departure_at="2026-09-01T09:00:00",
        arrival_at="2026-09-01T19:00:00",
        origin="CHI",
        destination="HYD",
        duration_minutes=610,
        deep_link="",
        stops=1,
    )
    merged = merge_flight_results([a], [b])
    assert merged[0].price == 450
    assert len(merged) == 2


@patch("app.services.flight_service.search_kiwi")
def test_search_flights_uses_kiwi_meta_search(mock_kiwi):
    mock_kiwi.return_value = [
        FlightResult(
            id="kiwi-live-1",
            price=799,
            currency="USD",
            airlines=["QR"],
            departure_at="2026-09-01T10:00:00Z",
            arrival_at="2026-09-02T06:00:00Z",
            origin="CHI",
            destination="HYD",
            duration_minutes=1200,
            deep_link="https://www.kiwi.com/deep",
            stops=1,
        )
    ]

    with patch.object(settings, "kiwi_api_key", "test-kiwi-key"), patch.object(
        settings, "flight_live_provider", "kiwi"
    ):
        from app.services.flight_service import _flight_cache

        _flight_cache.clear()
        results = FlightService.search_flights(
            fly_from="CHI",
            fly_to="HYD",
            date_from=date(2026, 9, 1),
            date_to=date(2026, 9, 1),
        )

    assert len(results) == 1
    assert results[0].id == "kiwi-live-1"
    mock_kiwi.assert_called_once()


@patch("app.services.flight_places_service._from_travelpayouts_places")
def test_flight_places_service_merges(mock_tp):
    from app.services.flight_places_service import FlightPlacesService
    from app.schemas.flight_places import FlightPlaceSuggestion

    mock_tp.return_value = [
        FlightPlaceSuggestion(
            id="tp-city-CHI",
            label="Chicago, United States",
            detail="All airports · CHI",
            iata="CHI",
            place_type="city",
        )
    ]
    rows = FlightPlacesService.suggest("chi")
    assert len(rows) == 1
    assert rows[0].iata == "CHI"
