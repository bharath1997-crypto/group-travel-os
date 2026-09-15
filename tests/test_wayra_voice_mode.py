"""Wayra voice mode — compact budget and response shaping."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.schemas.ai_assistant import AIAssistantRequest, AIAssistantResponse
from app.services.ai_assistant_service import (
    _build_input_payload,
    _build_system_prompt,
    _finalize_response,
    _message_char_cap,
)
from app.services.wayra_intent import WayraMode
from app.services.wayra_output_budget import resolve_output_budget
from app.services import wayra_llm_providers as providers


def test_voice_output_budget_is_compact():
    budget = resolve_output_budget("full", "What's near me?", voice_mode=True)
    assert budget.style == "voice"
    assert budget.max_output_tokens <= 400
    assert budget.max_message_chars <= 600


def test_voice_mode_caps_long_local_reply():
    request = AIAssistantRequest(
        page="live",
        user_message="What's here?",
        voice_mode=True,
    )
    long_text = "A" * 900
    capped = _finalize_response(
        AIAssistantResponse(message=long_text, suggested_actions=[]),
        request,
    )
    assert len(capped.message) == _message_char_cap(request.user_message, voice_mode=True)
    assert capped.summary is not None
    assert capped.summary.get("voice_mode") is True


def test_voice_system_prompt_stays_tiny():
    prompt = _build_system_prompt(
        "live",
        None,
        mode=WayraMode.TRAVEL,
        on_live=True,
        voice_mode=True,
    )
    assert "ROVVY FEATURE KNOWLEDGE" not in prompt
    assert "suggested_actions" not in prompt
    assert "VOICE MODE" in prompt
    assert len(prompt) < 900


def test_voice_payload_skips_expensive_context():
    req = AIAssistantRequest(
        page="live",
        user_message="What's near me?",
        voice_mode=True,
        context={
            "pathname": "/live",
            "selectedPlace": {
                "name": "Red Square",
                "city": "Moscow",
                "lat": 55.75,
                "lng": 37.62,
                "unusedBlob": "x" * 4000,
            },
            "routePreview": {"polyline": "A" * 8000, "distanceMeters": 1200},
            "resolvedMapRegion": "Moscow, Russia",
        },
    )
    raw = _build_input_payload(req, mode=WayraMode.TRAVEL)
    assert "What's near me?" in raw
    assert "Red Square" in raw
    assert "unusedBlob" not in raw
    assert "polyline" not in raw
    assert "destination_intel" not in raw


@pytest.mark.asyncio
async def test_voice_full_response_is_one_deepseek_call():
    with (
        patch.object(providers, "_deepseek_key", return_value="ds-key"),
        patch.object(providers, "_gemini_key", return_value="gem-key"),
        patch.object(
            providers,
            "_call_deepseek",
            new=AsyncMock(
                return_value=('{"message": "A cafe is two minutes north."}', {"total_tokens": 30})
            ),
        ) as direct,
        patch.object(providers, "_ask_deepseek_to_route", new=AsyncMock()) as orchestrator,
        patch.object(providers, "_call_gemini_full_async", new=AsyncMock()) as gemini,
        patch.object(providers, "record_gemini_usage"),
    ):
        raw, provider, usage = await providers.generate_wayra_full_response(
            system_prompt="Speak briefly.",
            user_block='{"user_message":"What is near me?"}',
            user_message="What is near me?",
            voice_mode=True,
        )

    assert provider == "deepseek"
    assert "cafe" in raw.lower()
    assert usage == {"total_tokens": 30}
    direct.assert_awaited_once()
    orchestrator.assert_not_awaited()
    gemini.assert_not_awaited()


@pytest.mark.asyncio
async def test_voice_nearby_summary_skips_orchestrator():
    with (
        patch.object(providers, "_deepseek_key", return_value="ds-key"),
        patch.object(providers, "_gemini_key", return_value="gem-key"),
        patch.object(
            providers,
            "_call_deepseek",
            new=AsyncMock(
                return_value=('{"message": "Pharmacy on the next block."}', {"total_tokens": 22})
            ),
        ) as direct,
        patch.object(providers, "_ask_deepseek_to_route", new=AsyncMock()) as orchestrator,
        patch.object(providers, "record_gemini_usage"),
    ):
        message, provider, _usage = await providers.summarize_from_sources(
            user_message="Any pharmacy nearby?",
            place_label="Red Square",
            source_block="OSM: pharmacy 90m north.",
            tier="nearby",
            voice_mode=True,
        )

    assert provider == "deepseek"
    assert "pharmacy" in message.lower()
    direct.assert_awaited_once()
    orchestrator.assert_not_awaited()
