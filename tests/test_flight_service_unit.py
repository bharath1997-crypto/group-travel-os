from __future__ import annotations

import pytest
from datetime import date
from unittest.mock import MagicMock, patch
import httpx

from app.services.flight_service import (
    FlightService,
    _normalize_fly_term,
    _parse_iso_duration_to_minutes,
    _parse_duffel_offer,
    _parse_amadeus_offer,
)
from app.utils.exceptions import AppException
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


def test_parse_amadeus_offer():
    raw_amadeus = {
        "id": "1",
        "price": {
            "grandTotal": "180.75",
            "currency": "EUR"
        },
        "itineraries": [
            {
                "duration": "PT3H15M",
                "segments": [
                    {
                        "carrierCode": "LH",
                        "departure": {"iataCode": "MUC", "at": "2026-06-01T08:00:00"},
                        "arrival": {"iataCode": "LHR", "at": "2026-06-01T10:15:00"},
                    }
                ]
            }
        ]
    }

    parsed = _parse_amadeus_offer(raw_amadeus, "USD")
    assert parsed is not None
    assert parsed.id == "1"
    assert parsed.price == 180.75
    assert parsed.currency == "EUR"
    assert parsed.airlines == ["LH"]
    assert parsed.origin == "MUC"
    assert parsed.destination == "LHR"
    assert parsed.duration_minutes == 195
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
@patch("httpx.Client")
def test_search_flights_duffel_fail_amadeus_fallback(mock_httpx_client, mock_duffel_class):
    # Make Duffel raise an exception
    mock_duffel_client = MagicMock()
    mock_duffel_class.return_value = mock_duffel_client
    mock_duffel_client.offer_requests.create.side_effect = Exception("Duffel Outage")

    # Setup Amadeus httpx mocks
    mock_client_instance = MagicMock()
    mock_httpx_client.return_value.__enter__.return_value = mock_client_instance

    # Mock OAuth Token response
    mock_token_resp = MagicMock()
    mock_token_resp.json.return_value = {"access_token": "mock-amadeus-token"}
    mock_token_resp.status_code = 200

    # Mock Search response
    mock_search_resp = MagicMock()
    mock_search_resp.json.return_value = {
        "data": [
            {
                "id": "amadeus_1",
                "price": {"grandTotal": "220.00", "currency": "USD"},
                "itineraries": [
                    {
                        "duration": "PT4H",
                        "segments": [
                            {
                                "carrierCode": "DL",
                                "departure": {"iataCode": "LAX", "at": "2026-06-01T06:00:00"},
                                "arrival": {"iataCode": "SEA", "at": "2026-06-01T10:00:00"},
                            }
                        ]
                    }
                ]
            }
        ]
    }
    mock_search_resp.status_code = 200

    mock_client_instance.post.return_value = mock_token_resp
    mock_client_instance.get.return_value = mock_search_resp

    with patch.object(settings, "duffel_api_key", "mock-duffel-key"), \
         patch.object(settings, "amadeus_api_key", "mock-amadeus-key"), \
         patch.object(settings, "amadeus_api_secret", "mock-amadeus-secret"):
        
        # Clear local cache first to ensure we hit the services
        from app.services.flight_service import _flight_cache
        _flight_cache.clear()

        results = FlightService.search_flights(
            fly_from="LAX",
            fly_to="SEA",
            date_from=date(2026, 6, 1),
            date_to=date(2026, 6, 1),
        )

    assert len(results) == 1
    assert results[0].id == "amadeus_1"
    assert results[0].price == 220.00
    assert results[0].origin == "LAX"
    assert results[0].destination == "SEA"


from fastapi import HTTPException

def test_search_flights_validation_errors():
    with pytest.raises(HTTPException) as excinfo:
        FlightService.search_flights(
            fly_from="NYC",
            fly_to="ANYWHERE",
            date_from=date(2026, 6, 1),
            date_to=date(2026, 6, 1),
        )
    assert excinfo.value.status_code == 400
    assert "Duffel and Amadeus require a specific destination" in excinfo.value.detail

    with pytest.raises(HTTPException) as excinfo:
        FlightService.search_flights(
            fly_from="NYC",
            fly_to="LAX",
            date_from=date(2026, 6, 2),
            date_to=date(2026, 6, 1),
        )
    assert excinfo.value.status_code == 400
    assert "Invalid outbound date range" in excinfo.value.detail
