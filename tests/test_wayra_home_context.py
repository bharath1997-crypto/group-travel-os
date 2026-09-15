"""Home-context and from-my-house routing tests."""

from __future__ import annotations

from unittest.mock import patch

from app.services.wayra_local_replies import (
    is_home_context_question,
    resolve_home_context_reply,
)
from app.services.wayra_source_intent import classify_wayra_answer_tier, is_distance_from_me_question

PLACE = {
    "name": "Brus Laguna",
    "lat": 15.73,
    "lng": -84.85,
    "city": "Brus Laguna",
    "country": "Honduras",
}
CTX = {
    "pathname": "/live",
    "selectedPlace": PLACE,
    "userLocation": {
        "lat": 41.8781,
        "lng": -87.6298,
        "city": "Chicago",
        "state": "Illinois",
        "country": "United States",
    },
}


def test_from_my_house_is_home_context():
    assert is_home_context_question("For that location from my house")


def test_call_from_my_location_routes_location_hard():
    msg = "Call from my location to their location"
    assert classify_wayra_answer_tier(msg, CTX) == "location_hard"


@patch(
    "app.services.wayra_local_replies.WeatherService.get_forecast",
    return_value={
        "temp_c": 23.0,
        "feels_like_c": 28.0,
        "description": "dense drizzle",
        "humidity": 99,
        "wind_kph": 4.0,
        "weather_code": 53,
    },
)
@patch(
    "app.services.wayra_weather_intent._home_city_weather",
    return_value={"temp_c": 18.0, "description": "partly cloudy"},
)
def test_home_context_reply_includes_comfort(_home, _wx):
    text = resolve_home_context_reply("For that location from my house", PLACE, CTX)
    assert text is not None
    lower = text.lower()
    assert "brus laguna" in lower or "mi" in lower or "km" in lower
    assert "chicago" in lower or "comfort" in lower or "humid" in lower or "warm" in lower
