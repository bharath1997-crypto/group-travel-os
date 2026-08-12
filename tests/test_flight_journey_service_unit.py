from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from unittest.mock import patch

from app.schemas.flight_journey import (
    FlightSearchPassengerRequest,
    FlightSearchRequest,
    FlightSearchSliceRequest,
)
from app.services.flight_journey_parser import (
    parse_duffel_journey,
    slice_matches_time_window,
)
from app.services.flight_journey_service import FlightJourneyService, _build_cache_key
from config import settings


def _round_trip_offer() -> dict:
    return {
        "id": "off_rt_1",
        "total_amount": "980.00",
        "total_currency": "USD",
        "expires_at": "2026-10-01T12:00:00Z",
        "live_mode": False,
        "slices": [
            {
                "duration": "PT18H",
                "origin": {"iata_code": "ORD"},
                "destination": {"iata_code": "HYD"},
                "segments": [
                    {
                        "departing_at": "2026-10-10T08:00:00-05:00",
                        "arriving_at": "2026-10-10T20:00:00+03:00",
                        "duration": "PT12H",
                        "marketing_carrier": {"iata_code": "QR", "name": "Qatar Airways"},
                        "operating_carrier": {"iata_code": "QR", "name": "Qatar Airways"},
                        "marketing_carrier_flight_number": "738",
                        "origin": {"iata_code": "ORD", "name": "Chicago O'Hare"},
                        "destination": {"iata_code": "DOH", "name": "Doha"},
                    },
                    {
                        "departing_at": "2026-10-11T02:00:00+03:00",
                        "arriving_at": "2026-10-11T09:30:00+05:30",
                        "duration": "PT4H30M",
                        "marketing_carrier": {"iata_code": "QR", "name": "Qatar Airways"},
                        "operating_carrier": {"iata_code": "QR", "name": "Qatar Airways"},
                        "marketing_carrier_flight_number": "477",
                        "origin": {"iata_code": "DOH", "name": "Doha"},
                        "destination": {"iata_code": "HYD", "name": "Hyderabad"},
                    },
                ],
            },
            {
                "duration": "PT20H",
                "origin": {"iata_code": "HYD"},
                "destination": {"iata_code": "ORD"},
                "segments": [
                    {
                        "departing_at": "2026-10-25T03:30:00+05:30",
                        "arriving_at": "2026-10-25T06:00:00+03:00",
                        "duration": "PT4H30M",
                        "marketing_carrier": {"iata_code": "QR", "name": "Qatar Airways"},
                        "operating_carrier": {"iata_code": "QR", "name": "Qatar Airways"},
                        "marketing_carrier_flight_number": "478",
                        "origin": {"iata_code": "HYD"},
                        "destination": {"iata_code": "DOH"},
                    },
                    {
                        "departing_at": "2026-10-25T08:30:00+03:00",
                        "arriving_at": "2026-10-25T14:30:00-05:00",
                        "duration": "PT14H",
                        "marketing_carrier": {"iata_code": "QR", "name": "Qatar Airways"},
                        "operating_carrier": {"iata_code": "QR", "name": "Qatar Airways"},
                        "marketing_carrier_flight_number": "739",
                        "origin": {"iata_code": "DOH"},
                        "destination": {"iata_code": "ORD"},
                    },
                ],
            },
        ],
    }


def test_parse_round_trip_preserves_both_slices():
    journey = parse_duffel_journey(
        _round_trip_offer(),
        currency_preference="USD",
        checked_at="2026-09-01T00:00:00Z",
    )
    assert journey is not None
    assert len(journey.slices) == 2
    assert journey.slices[0].origin == "ORD"
    assert journey.slices[0].destination == "HYD"
    assert journey.slices[1].origin == "HYD"
    assert journey.slices[1].destination == "ORD"
    assert journey.stops == 2
    assert len(journey.slices[0].connections) == 1
    assert journey.slices[0].connections[0].airport == "DOH"
    assert journey.slices[0].connections[0].overnight is True
    assert journey.slices[0].connections[0].protected is None
    assert journey.protected_connection is None


def test_slice_time_window_filters_morning_departures():
    journey = parse_duffel_journey(
        _round_trip_offer(),
        currency_preference="USD",
        checked_at="2026-09-01T00:00:00Z",
    )
    assert journey is not None
    assert slice_matches_time_window(journey.slices[0], "00:00", "12:00") is True
    assert slice_matches_time_window(journey.slices[0], "13:00", "17:00") is False


def test_cache_keys_differ_for_children():
    future = date.today() + timedelta(days=30)
    base = FlightSearchRequest(
        trip_type="one_way",
        slices=[
            FlightSearchSliceRequest(origin="ORD", destination="HYD", departure_date=future),
        ],
        passengers=[FlightSearchPassengerRequest(type="adult")],
        maximum_connections=1,
    )
    with_children = base.model_copy(
        update={
            "passengers": [
                FlightSearchPassengerRequest(type="adult"),
                FlightSearchPassengerRequest(type="child", age=8),
            ]
        }
    )
    FlightJourneyService.clear_cache()
    key_adult = _build_cache_key(base)
    key_child = _build_cache_key(with_children)
    assert key_adult != key_child


@patch("app.services.flight_journey_service.create_offer_request")
def test_search_returns_empty_without_mock_fallback(mock_create):
    mock_create.return_value = {"offers": []}
    future = date.today() + timedelta(days=30)
    body = FlightSearchRequest(
        trip_type="one_way",
        slices=[
            FlightSearchSliceRequest(origin="ORD", destination="HYD", departure_date=future),
        ],
        passengers=[FlightSearchPassengerRequest(type="adult")],
        maximum_connections=1,
    )
    with patch.object(settings, "duffel_api_key", "test-key"), patch.object(
        settings, "allow_estimated_flights", False
    ):
        FlightJourneyService.clear_cache()
        response = FlightJourneyService.search(body)
    assert response.journeys == []
    assert response.message == "No matching live offers for this search"


@patch("app.services.flight_journey_service.create_offer_request")
def test_multi_city_sends_all_slices(mock_create):
    mock_create.return_value = {"offers": []}
    future = date.today() + timedelta(days=30)
    future2 = future + timedelta(days=5)
    body = FlightSearchRequest(
        trip_type="multi_city",
        slices=[
            FlightSearchSliceRequest(origin="ORD", destination="HYD", departure_date=future),
            FlightSearchSliceRequest(origin="HYD", destination="SIN", departure_date=future2),
        ],
        passengers=[FlightSearchPassengerRequest(type="adult")],
        maximum_connections=1,
    )
    with patch.object(settings, "duffel_api_key", "test-key"):
        FlightJourneyService.clear_cache()
        FlightJourneyService.search(body)
    slices = mock_create.call_args.kwargs["slices"]
    assert len(slices) == 2
    assert slices[0]["origin"] == "ORD"
    assert slices[1]["destination"] == "SIN"
    assert mock_create.call_args.kwargs["max_connections"] == 1


def test_search_unconfigured_duffel_returns_503():
    future = date.today() + timedelta(days=30)
    body = FlightSearchRequest(
        trip_type="one_way",
        slices=[
            FlightSearchSliceRequest(origin="ORD", destination="HYD", departure_date=future),
        ],
        passengers=[FlightSearchPassengerRequest(type="adult")],
    )
    with patch.object(settings, "duffel_api_key", ""):
        with pytest.raises(HTTPException) as exc:
            FlightJourneyService.search(body)
        assert exc.value.status_code == 503
