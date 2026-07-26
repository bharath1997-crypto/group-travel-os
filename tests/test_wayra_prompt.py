"""Wayra mode-aware prompt construction tests."""

from app.services.ai_assistant_service import (
    _build_input_payload,
    _build_system_prompt,
    _generation_temperature,
)
from app.services.wayra_intent import WayraMode
from app.schemas.ai_assistant import AIAssistantRequest


def test_travel_live_prompt_prioritizes_discovery() -> None:
    prompt = _build_system_prompt(
        "live",
        None,
        mode=WayraMode.TRAVEL,
        on_live=True,
    )
    assert "TRAVEL DISCOVERY ON LIVE MAP" in prompt
    assert "4 to 8 sentences" in prompt
    assert "Do NOT tell users to \"open Plan\"" in prompt
    assert "travel" == WayraMode.TRAVEL.value or "travel" in prompt


def test_app_guide_prompt_stays_concise() -> None:
    prompt = _build_system_prompt(
        "dashboard",
        None,
        mode=WayraMode.APP_GUIDE,
        on_live=False,
    )
    assert "max 2 to 3 sentences" in prompt
    assert "TRAVEL DISCOVERY ON LIVE MAP" not in prompt


def test_input_payload_includes_mode_and_style() -> None:
    req = AIAssistantRequest(
        page="live",
        user_message="What's at Kitikmeot Region?",
        trip_id=None,
        group_id=None,
        active_tab=None,
        context={
            "pathname": "/live",
            "selectedPlace": {"name": "Kitikmeot Region", "lat": 68.0, "lng": -102.0},
        },
    )
    raw = _build_input_payload(req, mode=WayraMode.TRAVEL)
    assert '"wayra_mode":"travel"' in raw.replace(" ", "")
    assert "travel_discovery_live" in raw


def test_generation_temperature_higher_for_live_travel() -> None:
    assert _generation_temperature(WayraMode.TRAVEL, on_live=True) > _generation_temperature(
        WayraMode.APP_GUIDE,
        on_live=False,
    )
