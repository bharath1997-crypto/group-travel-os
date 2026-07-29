"""Tests for zero-token Wayra local replies."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.schemas.ai_assistant import AIAssistantRequest
from app.services.ai_assistant_service import AIAssistantService
from app.services.wayra_local_replies import (
    is_conversation_question,
    is_meta_ai_question,
    is_navigation_question,
    is_weather_question,
    resolve_language_reply,
    try_local_reply,
)

LIVE_CTX = {
    "pathname": "/live",
    "selectedPlace": {
        "name": "Red Square",
        "lat": 55.7539,
        "lng": 37.6208,
        "city": "Moscow",
        "country": "Russia",
    },
    "userLocation": {"lat": 40.7128, "lng": -74.0060, "city": "New York", "country": "United States"},
}


def test_meta_ai_detected():
    assert is_meta_ai_question("Are you using Gemini or DeepSeek?") is True
    assert is_meta_ai_question("How is the food?") is False


def test_conversation_detected():
    assert is_conversation_question("Hello Wayra!") is True
    assert is_conversation_question("What is the weather?") is False


def test_weather_detected():
    assert is_weather_question("What's the weather like here?") is True


def test_navigation_detected():
    assert is_navigation_question("How do I get to Red Square?") is True


def test_language_reply_russia():
    place = {"name": "Red Square", "country": "Russia", "city": "Moscow"}
    msg = resolve_language_reply("How do I say hello in Russian?", place)
    assert msg is not None
    assert "Privet" in msg or "Привет" in msg


def test_try_local_meta():
    out = try_local_reply("What model powers your answers?", "live", LIVE_CTX)
    assert out is not None
    assert out.summary and out.summary.get("provider") == "local"
    assert "Gemini" not in out.message and "DeepSeek" not in out.message


def test_try_local_conversation():
    out = try_local_reply("Hello Wayra!", "live", LIVE_CTX)
    assert out is not None
    assert "Red Square" in out.message


@patch(
    "app.services.wayra_local_replies.WeatherService.get_forecast",
    return_value={
        "temp_c": -2.0,
        "feels_like_c": -5.0,
        "description": "light snow",
        "humidity": 80,
        "wind_kph": 12.0,
    },
)
def test_try_local_weather(_mock_forecast):
    out = try_local_reply("What's the weather like here?", "live", LIVE_CTX)
    assert out is not None
    assert out.summary and out.summary.get("intent") == "weather_current"
    assert "light snow" in out.message.lower()
    assert len(out.sources) == 1
    assert out.sources[0].source_type == "weather"


def test_try_local_navigation_with_route():
    ctx = {
        **LIVE_CTX,
        "routePreview": {"distanceMeters": 8046700, "durationSeconds": 360000},
    }
    out = try_local_reply("How long is the drive to Red Square?", "live", ctx)
    assert out is not None
    assert out.summary and out.summary.get("intent") == "navigation"
    assert "hr" in out.message or "min" in out.message


def test_try_local_navigation_get_to():
    out = try_local_reply("How do I get to Red Square?", "live", LIVE_CTX)
    assert out is not None
    assert "Set destination" in out.message or "Solo Live" in out.message


@pytest.mark.asyncio
async def test_assistant_uses_local_weather_before_llm():
    req = AIAssistantRequest(
        page="live",
        user_message="What's the weather like here?",
        context=LIVE_CTX,
    )
    with patch(
        "app.services.wayra_local_replies.WeatherService.get_forecast",
        return_value={
            "temp_c": 10.0,
            "feels_like_c": 10.0,
            "description": "partly cloudy",
            "humidity": 55,
            "wind_kph": 8.0,
        },
    ):
        resp = await AIAssistantService.respond(req)
    assert resp.summary and resp.summary.get("provider") == "local"
    assert "partly cloudy" in resp.message.lower()


def test_try_local_app_guide_on_live():
    out = try_local_reply("How does Live work?", "live", LIVE_CTX)
    assert out is not None
    assert out.summary and out.summary.get("intent") == "app_guide"
    assert "Live" in out.message


def test_try_local_pencil_icon():
    out = try_local_reply("What does the pencil icon do?", "live", LIVE_CTX)
    assert out is not None
    assert "pencil" in out.message.lower()


def test_try_local_switch_travel_modes():
    out = try_local_reply("How do I switch travel modes?", "live", LIVE_CTX)
    assert out is not None
    assert out.summary and out.summary.get("provider") == "local"


def test_try_local_border():
    out = try_local_reply("Is Red Square near a border?", "live", LIVE_CTX)
    assert out is not None
    assert "not" in out.message.lower() and "border" in out.message.lower()


def test_try_local_last_mile():
    ctx = {**LIVE_CTX, "routePreview": {"lastMileNotice": "Walk 400 ft on cobblestones to the square."}}
    out = try_local_reply("What is the last mile like here?", "live", ctx)
    assert out is not None
    assert "cobblestones" in out.message.lower()


def test_try_local_tell_me_more():
    out = try_local_reply("That's interesting, tell me more.", "live", LIVE_CTX)
    assert out is not None
    assert out.summary and out.summary.get("intent") == "conversation"


def test_parse_summary_json_strips_fences():
    from app.services.wayra_llm_providers import _parse_summary_json

    raw = 'Here is the JSON requested: ```json\n{"message": "Clean answer."}\n```'
    assert _parse_summary_json(raw) == "Clean answer."
