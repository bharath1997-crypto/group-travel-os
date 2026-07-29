"""Cost-quality tier routing for Wayra compact summaries."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.services import wayra_llm_providers as providers


@pytest.mark.asyncio
async def test_discovery_prefers_deepseek():
    with (
        patch.object(providers, "_deepseek_key", return_value="ds-key"),
        patch.object(providers, "_gemini_key", return_value="gem-key"),
        patch.object(
            providers,
            "_call_deepseek",
            new=AsyncMock(return_value=('{"message": "Local food culture."}', {"total_tokens": 40})),
        ) as deepseek,
        patch.object(providers, "_call_gemini_compact", new=AsyncMock()) as gemini,
    ):
        message, provider, usage = await providers.summarize_from_sources(
            user_message="How is the food?",
            place_label="Red Square",
            source_block="Wikipedia snippet.",
            tier="discovery",
        )

    assert provider == "deepseek"
    assert "food" in message.lower()
    deepseek.assert_awaited_once()
    gemini.assert_not_awaited()


@pytest.mark.asyncio
async def test_location_hard_prefers_gemini_for_quality():
    with (
        patch.object(providers, "_deepseek_key", return_value="ds-key"),
        patch.object(providers, "_gemini_key", return_value="gem-key"),
        patch.object(providers, "_call_deepseek", new=AsyncMock()) as deepseek,
        patch.object(
            providers,
            "_call_gemini_compact",
            new=AsyncMock(return_value=('{"message": "Route has border crossing."}', {"total_tokens": 80})),
        ) as gemini,
        patch.object(providers, "record_gemini_usage"),
    ):
        message, provider, _usage = await providers.summarize_from_sources(
            user_message="Any route warnings?",
            place_label="Red Square",
            source_block="Border notice ahead.",
            tier="location_hard",
        )

    assert provider == "gemini"
    assert "border" in message.lower()
    gemini.assert_awaited_once()
    deepseek.assert_not_awaited()


@pytest.mark.asyncio
async def test_location_hard_falls_back_to_deepseek_when_gemini_fails():
    with (
        patch.object(providers, "_deepseek_key", return_value="ds-key"),
        patch.object(providers, "_gemini_key", return_value="gem-key"),
        patch.object(
            providers,
            "_call_gemini_compact",
            new=AsyncMock(side_effect=RuntimeError("upstream down")),
        ),
        patch.object(
            providers,
            "_call_deepseek",
            new=AsyncMock(return_value=('{"message": "DeepSeek route answer."}', {"total_tokens": 40})),
        ) as deepseek,
        patch.object(providers, "record_gemini_usage"),
    ):
        message, provider, _usage = await providers.summarize_from_sources(
            user_message="Any route warnings?",
            place_label="Red Square",
            source_block="Border notice ahead.",
            tier="location_hard",
        )

    assert provider == "deepseek"
    assert "DeepSeek route answer" in message
    deepseek.assert_awaited_once()
