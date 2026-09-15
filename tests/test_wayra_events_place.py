"""Tests for geo-anchored event lookup."""

from __future__ import annotations

from unittest.mock import patch

from app.services.events_service import get_events_for_place

MOSCOW = {
    "name": "Red Square",
    "lat": 55.7539,
    "lng": 37.6208,
    "city": "Moscow",
    "country": "Russia",
}


@patch("app.services.events_service._fetch_ticketmaster_events")
def test_get_events_for_place_filters_wrong_country(mock_fetch):
    from app.services import events_service

    events_service._cache.clear()
    mock_fetch.return_value = [
        {
            "name": "Idaho Vandals Football",
            "date": "2026-09-12",
            "venue": "Kibbie Dome",
            "ticket_url": "https://example.com",
            "country": "US",
            "venue_lat": 46.7,
            "venue_lon": -117.0,
        }
    ]
    out = get_events_for_place(MOSCOW)
    assert out == []


@patch("app.services.events_service._fetch_ticketmaster_events")
def test_get_events_for_place_keeps_matching_country(mock_fetch):
    from app.services import events_service

    events_service._cache.clear()
    mock_fetch.return_value = [
        {
            "name": "Moscow Jazz Festival",
            "date": "2026-08-01",
            "venue": "Concert Hall",
            "ticket_url": "https://example.com/jazz",
            "country": "RU",
            "venue_lat": 55.76,
            "venue_lon": 37.62,
        }
    ]
    out = get_events_for_place(MOSCOW)
    assert len(out) == 1
    assert out[0]["name"] == "Moscow Jazz Festival"
    assert out[0]["url"] == "https://example.com/jazz"
