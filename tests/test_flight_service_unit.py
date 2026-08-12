from __future__ import annotations

import pytest
from datetime import date, timedelta
from unittest.mock import MagicMock, patch
from fastapi import HTTPException

from app.services.flight_service import (
    FlightService,
    _normalize_fly_term,
    _parse_iso_duration_to_minutes,
    _parse_duffel_offer,
)
from app.services.flight_journey_service import FlightJourneyService
from config import settings


def test_normalize_fly_term():
    assert _normalize_fly_term("Chicago") == "CHI"
    assert _normalize_fly_term("NEWYORK") == "NYC"
    assert _normalize_fly_term("San Francisco") == "SFO"
    assert _normalize_fly_term("NYC") == "NYC"
    assert _normalize_fly_term("  MIA  ") == "MIA"
    assert _normalize_fly_term("") == ""
    assert _normalize_fly_term("ANYWHERE") == "ANYWHERE"


def test_parse_iso_duration_to_minutes():
    assert _parse_iso_duration_to_minutes("PT2H30M") == 150
    assert _parse_iso_duration_to_minutes("PT5H") == 300
    assert _parse_iso_duration_to_minutes("PT45M") == 45
    assert _parse_iso_duration_to_minutes(None) == 0
    assert _parse_iso_duration_to_minutes("invalid") == 0


def test_parse_duffel_offer():
    offer = {
        "id": "off_123",
        "total_amount": "250.50",
        "total_currency": "USD",
        "slices": [
            {
                "duration": "PT2H",
                "origin": {"iata_code": "ORD"},
                "destination": {"iata_code": "LGA"},
                "segments": [
                    {
                        "departing_at": "2026-06-01T10:00:00Z",
                        "arriving_at": "2026-06-01T12:00:00Z",
                        "marketing_carrier": {"iata_code": "UA"},
                    }
                ],
            }
        ],
    }

    parsed = _parse_duffel_offer(offer, "USD")
    assert parsed is not None
    assert parsed.id == "off_123"
    assert parsed.price == 250.50
    assert parsed.currency == "USD"
    assert parsed.airlines == ["UA"]
    assert parsed.origin == "ORD"
    assert parsed.destination == "LGA"
    assert parsed.duration_minutes == 120
    assert parsed.stops == 0


@patch("app.services.flight_journey_service.create_offer_request")
def test_search_flights_duffel_success(mock_create):
    mock_create.return_value = {
        "offers": [
            {
                "id": "off_duffel",
                "total_amount": "120.00",
                "total_currency": "USD",
                "expires_at": "2026-10-01T12:00:00Z",
                "live_mode": False,
                "slices": [
                    {
                        "duration": "PT3H",
                        "origin": {"iata_code": "NYC"},
                        "destination": {"iata_code": "MIA"},
                        "segments": [
                            {
                                "departing_at": "2026-06-01T12:00:00Z",
                                "arriving_at": "2026-06-01T15:00:00Z",
                                "marketing_carrier": {"iata_code": "AA"},
                                "origin": {"iata_code": "NYC"},
                                "destination": {"iata_code": "MIA"},
                            }
                        ],
                    }
                ],
            }
        ]
    }

    with patch.object(settings, "duffel_api_key", "mock-duffel-key"), patch.object(
        settings, "flight_live_provider", "duffel"
    ), patch.object(settings, "allow_estimated_flights", False):
        from app.services.flight_service import _flight_cache

        _flight_cache.clear()
        FlightJourneyService.clear_cache()

        future = date.today() + timedelta(days=30)
        results = FlightService.search_flights(
            fly_from="NYC",
            fly_to="MIA",
            date_from=future,
            date_to=future,
        )

    assert len(results) == 1
    assert results[0].id == "off_duffel"
    assert results[0].price == 120.00
    assert results[0].origin == "NYC"
    assert results[0].destination == "MIA"
    assert results[0].stops == 0


@patch("app.services.flight_service.create_offer_request")
def test_search_flights_duffel_failure_returns_empty_not_mock(mock_create):
    mock_create.side_effect = Exception("Duffel Outage")

    with patch.object(settings, "duffel_api_key", "mock-duffel-key"), patch.object(
        settings, "flight_live_provider", "duffel"
    ):
        from app.services.flight_service import _flight_cache

        _flight_cache.clear()

        results = FlightService.search_flights(
            fly_from="LAX",
            fly_to="SEA",
            date_from=date(2026, 6, 1),
            date_to=date(2026, 6, 1),
        )

    assert results == []


def test_search_flights_validation_errors():
    with pytest.raises(HTTPException) as excinfo:
        FlightService.search_flights(
            fly_from="NYC",
            fly_to="ANYWHERE",
            date_from=date(2026, 6, 1),
            date_to=date(2026, 6, 1),
        )
    assert excinfo.value.status_code == 400
    assert "specific destination" in excinfo.value.detail.lower()

    with pytest.raises(HTTPException) as excinfo:
        FlightService.search_flights(
            fly_from="NYC",
            fly_to="LAX",
            date_from=date(2026, 6, 2),
            date_to=date(2026, 6, 1),
        )
    assert excinfo.value.status_code == 400
    assert "Invalid outbound date range" in excinfo.value.detail
