from __future__ import annotations

import pytest
from datetime import date
from unittest.mock import MagicMock, patch
from fastapi import HTTPException

from app.services.flight_service import (
    FlightService,
    _normalize_fly_term,
    _parse_iso_duration_to_minutes,
    _parse_duffel_offer,
)
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
    # Mock Duffel Offer structure
    mock_offer = MagicMock()
    mock_offer.id = "off_123"
    mock_offer.total_amount = "250.50"
    mock_offer.total_currency = "USD"

    mock_segment = MagicMock()
    mock_segment.marketing_carrier.iata_code = "UA"
    mock_segment.departing_at = "2026-06-01T10:00:00Z"
    mock_segment.arriving_at = "2026-06-01T12:00:00Z"

    mock_slice = MagicMock()
    mock_slice.duration = "PT2H"
    mock_slice.origin.iata_code = "ORD"
    mock_slice.destination.iata_code = "LGA"
    mock_slice.segments = [mock_segment]

    mock_offer.slices = [mock_slice]

    parsed = _parse_duffel_offer(mock_offer, "USD")
    assert parsed is not None
    assert parsed.id == "off_123"
    assert parsed.price == 250.50
    assert parsed.currency == "USD"
    assert parsed.airlines == ["UA"]
    assert parsed.origin == "ORD"
    assert parsed.destination == "LGA"
    assert parsed.duration_minutes == 120
    assert parsed.stops == 0


@patch("app.services.flight_service.Duffel")
def test_search_flights_duffel_success(mock_duffel_class):
    # Setup Duffel mock
    mock_client = MagicMock()
    mock_duffel_class.return_value = mock_client

    mock_offer = MagicMock()
    mock_offer.id = "off_duffel"
    mock_offer.total_amount = "120.00"
    mock_offer.total_currency = "USD"
    
    mock_segment = MagicMock()
    mock_segment.marketing_carrier.iata_code = "AA"
    mock_segment.departing_at = "2026-06-01T12:00:00Z"
    mock_segment.arriving_at = "2026-06-01T15:00:00Z"

    mock_slice = MagicMock()
    mock_slice.duration = "PT3H"
    mock_slice.origin.iata_code = "NYC"
    mock_slice.destination.iata_code = "MIA"
    mock_slice.segments = [mock_segment]

    mock_offer.slices = [mock_slice]

    mock_offer_request = MagicMock()
    mock_offer_request.offers = [mock_offer]
    
    # Configure builder pattern mock
    mock_client.offer_requests.create.return_value.passengers.return_value.slices.return_value.cabin_class.return_value.return_offers.return_value.execute.return_value = mock_offer_request

    # Run flight search with mock duffel api key
    with patch.object(settings, "duffel_api_key", "mock-duffel-key"):
        # Clear local cache first to ensure we hit the service
        from app.services.flight_service import _flight_cache
        _flight_cache.clear()

        results = FlightService.search_flights(
            fly_from="NYC",
            fly_to="MIA",
            date_from=date(2026, 6, 1),
            date_to=date(2026, 6, 1),
        )

    assert len(results) == 1
    assert results[0].id == "off_duffel"
    assert results[0].price == 120.00
    assert results[0].origin == "NYC"
    assert results[0].destination == "MIA"
    assert results[0].stops == 0


@patch("app.services.flight_service.Duffel")
def test_search_flights_duffel_failure_returns_empty_list(mock_duffel_class):
    # Make Duffel raise an exception
    mock_duffel_client = MagicMock()
    mock_duffel_class.return_value = mock_duffel_client
    mock_duffel_client.offer_requests.create.side_effect = Exception("Duffel Outage")

    with patch.object(settings, "duffel_api_key", "mock-duffel-key"):
        # Clear local cache first to ensure we hit the service
        from app.services.flight_service import _flight_cache
        _flight_cache.clear()

        results = FlightService.search_flights(
            fly_from="LAX",
            fly_to="SEA",
            date_from=date(2026, 6, 1),
            date_to=date(2026, 6, 1),
        )

    # Asserts that failure catches exception and returns an empty list gracefully
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
    assert "Duffel requires a specific destination" in excinfo.value.detail

    with pytest.raises(HTTPException) as excinfo:
        FlightService.search_flights(
            fly_from="NYC",
            fly_to="LAX",
            date_from=date(2026, 6, 2),
            date_to=date(2026, 6, 1),
        )
    assert excinfo.value.status_code == 400
    assert "Invalid outbound date range" in excinfo.value.detail
