"""Tests for Wayra quality refinements."""

from __future__ import annotations

from unittest.mock import patch

from app.services.wayra_events_context import is_future_event_question, try_future_events_reply
from app.services.wayra_route_feasibility import assess_drive_feasibility
from app.services.wayra_weather_intent import build_weather_reply, classify_weather_sub_intent
from app.services.wayra_local_replies import resolve_navigation_reply, resolve_weather_reply

LIVE_CTX = {
    "userLocation": {"lat": 40.7128, "lng": -74.0060, "city": "New York", "country": "United States"},
}
PLACE = {"name": "Red Square", "lat": 55.7539, "lng": 37.6208, "city": "Moscow", "country": "Russia"}


def test_weather_sub_intent_snow():
    assert classify_weather_sub_intent("Is it snowing in Moscow now?") == "weather_precipitation"


def test_weather_sub_intent_alerts():
    assert classify_weather_sub_intent("Any weather warnings for Moscow?") == "weather_alerts"


@patch(
    "app.services.wayra_local_replies.WeatherService.get_forecast",
    return_value={"temp_c": 28.0, "feels_like_c": 27.0, "description": "overcast", "humidity": 38, "wind_kph": 11.0, "weather_code": 3},
)
def test_weather_snow_answer_no(_mock):
    msg = resolve_weather_reply("Is it snowing in Moscow now?", PLACE)
    assert msg is not None
    assert "not snowing" in msg.lower() or "not raining" in msg.lower()


def test_drive_infeasible_ny_to_moscow():
    feas = assess_drive_feasibility({**LIVE_CTX, **{"selectedPlace": PLACE}}, PLACE)
    assert feas.feasible is False
    assert "fly" in (feas.message or "").lower()


def test_navigation_blocks_impossible_drive():
    msg = resolve_navigation_reply("How long is the drive to Red Square?", PLACE, LIVE_CTX)
    assert msg is not None
    assert "not available" in msg.lower() or "fly" in msg.lower()


def test_future_events_no_data():
    with patch("app.services.wayra_events_context.get_events_for_place", return_value=[]):
        out = try_future_events_reply("Will there be a parade this month?", PLACE)
    assert out is not None
    assert "no upcoming events" in out.message.lower()


def test_future_events_with_data():
    with patch(
        "app.services.wayra_events_context.get_events_for_place",
        return_value=[{"name": "Moscow Jazz", "date": "2026-08-01", "venue": "Hall", "url": "https://example.com"}],
    ):
        out = try_future_events_reply("Are there upcoming festivals?", PLACE)
    assert out is not None
    assert "Moscow Jazz" in out.message
    assert out.summary and out.summary.get("time_sensitive_data_available") is True


def test_future_events_filters_wrong_country():
    with patch(
        "app.services.wayra_events_context.get_events_for_place",
        return_value=[],
    ):
        out = try_future_events_reply("Will there be a parade this month?", PLACE)
    assert out is not None
    assert "no upcoming events" in out.message.lower()
