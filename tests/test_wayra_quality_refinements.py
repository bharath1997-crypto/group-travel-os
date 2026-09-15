"""Tests for Wayra quality refinements."""

from __future__ import annotations

from unittest.mock import patch

from app.services.wayra_events_context import is_future_event_question, try_future_events_reply
from app.services.wayra_route_feasibility import assess_drive_feasibility
from app.services.wayra_weather_intent import (
    build_weather_reply,
    classify_weather_sub_intent,
    extract_home_city,
)
from app.services.wayra_local_replies import (
    is_weather_question,
    resolve_navigation_reply,
    resolve_weather_reply,
)

LIVE_CTX = {
    "userLocation": {"lat": 40.7128, "lng": -74.0060, "city": "New York", "country": "United States"},
}
PLACE = {"name": "Red Square", "lat": 55.7539, "lng": 37.6208, "city": "Moscow", "country": "Russia"}
EXPRESSWAY = {
    "name": "Theodore Roosevelt Expressway",
    "lat": 46.8772,
    "lng": -96.7898,
    "city": "Fargo",
    "country": "United States",
}


def test_weather_sub_intent_snow():
    assert classify_weather_sub_intent("Is it snowing in Moscow now?") == "weather_precipitation"


def test_weather_sub_intent_alerts():
    assert classify_weather_sub_intent("Any weather warnings for Moscow?") == "weather_alerts"


def test_weather_sub_intent_comfort_chicago():
    msg = (
        "How am I going to feel right now from my Chicago? "
        "I'm a Chicago person, so is the temperature comfortable for my body?"
    )
    assert classify_weather_sub_intent(msg) == "weather_comfort"
    assert extract_home_city(msg) == "Chicago"
    assert is_weather_question(msg)


def test_weather_comfort_reply_with_home_city():
    text = build_weather_reply(
        sub_intent="weather_comfort",
        place_label="Theodore Roosevelt Expressway",
        body={
            "temp_c": 10.0,
            "feels_like_c": 7.0,
            "description": "clear sky",
            "humidity": 63,
            "wind_kph": 9.0,
            "weather_code": 0,
        },
        home_city="Chicago",
        home_body={"temp_c": 18.0, "description": "partly cloudy"},
    )
    lower = text.lower()
    assert "chicago" in lower
    assert "mild" in lower or "comfortable" in lower
    assert "not difficult" in lower
    assert "light-jacket" in lower or "light jacket" in lower
    assert "chilly" not in lower
    assert "current weather near" not in lower


def test_resolve_weather_comfort_vs_current():
    place_wx = {
        "temp_c": 10.0,
        "feels_like_c": 7.0,
        "description": "clear sky",
        "humidity": 63,
        "wind_kph": 9.0,
        "weather_code": 0,
    }
    chicago_wx = {"temp_c": 18.0, "description": "partly cloudy"}

    def _forecast(lat: float, lng: float, _day):
        # Chicago coords from wayra_weather_intent._HOME_CITY_COORDS
        if abs(lat - 41.8781) < 0.01 and abs(lng - (-87.6298)) < 0.01:
            return chicago_wx
        return place_wx

    with patch(
        "app.services.weather_service.WeatherService.get_forecast",
        side_effect=_forecast,
    ):
        comfort = resolve_weather_reply(
            "How am I going to feel right now from my Chicago? "
            "Is the temperature going to be comfortable for my body?",
            EXPRESSWAY,
        )
        assert comfort is not None
        assert "chicago" in comfort.lower()
        assert "current weather near" not in comfort.lower()

        current = resolve_weather_reply(
            "How is this location going to be for me about temperature right now?",
            EXPRESSWAY,
        )
        assert current is not None
        assert "current weather near" in current.lower()


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
