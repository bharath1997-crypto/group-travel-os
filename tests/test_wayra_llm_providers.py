"""DeepSeek-controlled routing for Wayra LLM answers."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.services import wayra_llm_providers as providers


@pytest.mark.asyncio
async def test_deepseek_answers_when_controller_selects_it():
    decision = providers.DeepSeekRouteDecision(
        route="deepseek",
        rewritten_prompt="Explain local food using the supplied source.",
        answer_text='{"message": "Local food culture."}',
    )
    with (
        patch.object(providers, "_deepseek_key", return_value="ds-key"),
        patch.object(providers, "_gemini_key", return_value="gem-key"),
        patch.object(
            providers,
            "_ask_deepseek_to_route",
            new=AsyncMock(return_value=(decision, decision.answer_text, {"total_tokens": 40})),
        ) as controller,
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
    controller.assert_awaited_once()
    gemini.assert_not_awaited()


@pytest.mark.asyncio
async def test_deepseek_selected_gemini_receives_rewritten_prompt_and_context():
    decision = providers.DeepSeekRouteDecision(
        route="gemini",
        rewritten_prompt="Assess the border crossing and give practical route guidance.",
        answer_text='{"message": "Check the marked crossing before departure."}',
    )
    with (
        patch.object(providers, "_deepseek_key", return_value="ds-key"),
        patch.object(providers, "_gemini_key", return_value="gem-key"),
        patch.object(
            providers,
            "_ask_deepseek_to_route",
            new=AsyncMock(return_value=(decision, decision.answer_text, {"total_tokens": 40})),
        ),
        patch.object(
            providers,
            "_call_gemini_compact",
            new=AsyncMock(
                return_value=('{"message": "Route has a border crossing."}', {"total_tokens": 80})
            ),
        ) as gemini,
        patch.object(providers, "record_gemini_usage") as usage_log,
    ):
        message, provider, usage = await providers.summarize_from_sources(
            user_message="Any route warnings?",
            place_label="Red Square",
            source_block="Border notice ahead.",
            tier="location_hard",
        )

    assert provider == "gemini"
    assert "border" in message.lower()
    routed_input = gemini.await_args.args[0]
    assert decision.rewritten_prompt in routed_input
    assert "Border notice ahead." in routed_input
    assert usage["total_tokens"] == 120
    assert [call.kwargs["feature"] for call in usage_log.call_args_list] == [
        "wayra_location_hard_orchestrator",
        "wayra_location_hard_gemini_selected",
    ]


@pytest.mark.asyncio
async def test_placeholder_ellipsis_answer_falls_through_to_gemini():
    """Models sometimes echo the JSON example {"message":"..."} — never show that."""
    decision = providers.DeepSeekRouteDecision(
        route="deepseek",
        rewritten_prompt="Give a visit plan for the expressway pin.",
        answer_text='{"message": "..."}',
    )
    with (
        patch.object(providers, "_deepseek_key", return_value="ds-key"),
        patch.object(providers, "_gemini_key", return_value="gem-key"),
        patch.object(
            providers,
            "_ask_deepseek_to_route",
            new=AsyncMock(return_value=(decision, decision.answer_text, {"total_tokens": 20})),
        ),
        patch.object(
            providers,
            "_call_gemini_compact",
            new=AsyncMock(
                return_value=(
                    '{"message": "Treat this as a remote highway stop: fuel up, '
                    'then use Medicine Lake as your nature base for a half-day."}',
                    {"total_tokens": 60},
                )
            ),
        ) as gemini,
        patch.object(providers, "record_gemini_usage"),
    ):
        message, provider, _usage = await providers.summarize_from_sources(
            user_message="I am asking particularly for a plan for this particular location.",
            place_label="Theodore Roosevelt Expressway",
            source_block="Wikipedia: Antelope, Montana near Medicine Lake.",
            tier="discovery",
        )

    assert provider == "gemini"
    assert "medicine lake" in message.lower()
    assert message.strip() != "..."
    gemini.assert_awaited_once()


def test_coerce_orchestrator_accepts_direct_message_json():
    raw = '{"message": "A full plan for the expressway with drive tips."}'
    decision, msg = providers._coerce_orchestrator_result(None, raw, max_chars=4000)
    assert decision is not None
    assert decision.route == "deepseek"
    assert "plan" in msg.lower()


def test_parse_summary_rejects_ellipsis_placeholder():
    assert providers._parse_summary_json('{"message": "..."}') == ""
    assert providers._parse_summary_json('{"message": "…"}') == ""
    assert providers._is_usable_answer_text("...") is False
    assert providers._is_usable_answer_text(
        "A short visit plan around Medicine Lake works well."
    )


@pytest.mark.asyncio
async def test_uses_deepseek_provisional_answer_when_selected_gemini_fails():
    decision = providers.DeepSeekRouteDecision(
        route="gemini",
        rewritten_prompt="Assess the route.",
        answer_text='{"message": "Check the route conditions before leaving."}',
    )
    with (
        patch.object(providers, "_deepseek_key", return_value="ds-key"),
        patch.object(providers, "_gemini_key", return_value="gem-key"),
        patch.object(
            providers,
            "_ask_deepseek_to_route",
            new=AsyncMock(return_value=(decision, decision.answer_text, {"total_tokens": 40})),
        ),
        patch.object(
            providers,
            "_call_gemini_compact",
            new=AsyncMock(side_effect=RuntimeError("upstream down")),
        ),
        patch.object(providers, "record_gemini_usage"),
    ):
        message, provider, _usage = await providers.summarize_from_sources(
            user_message="Any route warnings?",
            place_label="Red Square",
            source_block="Border notice ahead.",
            tier="location_hard",
        )

    assert provider == "deepseek"
    assert "Check the route conditions" in message


@pytest.mark.asyncio
async def test_gemini_is_outage_fallback_when_deepseek_controller_is_unavailable():
    with (
        patch.object(providers, "_deepseek_key", return_value="ds-key"),
        patch.object(providers, "_gemini_key", return_value="gem-key"),
        patch.object(
            providers,
            "_ask_deepseek_to_route",
            new=AsyncMock(side_effect=RuntimeError("controller unavailable")),
        ),
        patch.object(
            providers,
            "_call_gemini_compact",
            new=AsyncMock(return_value=('{"message": "Gemini kept Wayra available."}', {"total_tokens": 70})),
        ),
        patch.object(providers, "record_gemini_usage") as usage_log,
    ):
        message, provider, _usage = await providers.summarize_from_sources(
            user_message="Any route warnings?",
            place_label="Red Square",
            source_block="Border notice ahead.",
            tier="location_hard",
        )

    assert provider == "gemini"
    assert "kept Wayra available" in message
    assert [c.kwargs["feature"] for c in usage_log.call_args_list] == [
        "wayra_location_hard_gemini_outage_fallback",
    ]


def test_route_decision_parser_accepts_nested_answer():
    decision = providers._parse_route_decision(
        '{"route":"gemini","rewritten_prompt":"Compare safe options.",'
        '"answer":{"message":"Here is the best available option."}}'
    )

    assert decision is not None
    assert decision.route == "gemini"
    assert decision.rewritten_prompt == "Compare safe options."
    assert providers._parse_summary_json(decision.answer_text) == (
        "Here is the best available option."
    )


def test_route_decision_parser_rejects_unknown_provider():
    assert (
        providers._parse_route_decision(
            '{"route":"openai","rewritten_prompt":"x","answer":{"message":"x"}}'
        )
        is None
    )


@pytest.mark.asyncio
async def test_full_response_obeys_deepseek_provider_decision():
    decision = providers.DeepSeekRouteDecision(
        route="deepseek",
        rewritten_prompt="Give a concise travel answer.",
        answer_text='{"message":"A useful answer.","suggested_actions":[]}',
    )
    with (
        patch.object(providers, "_deepseek_key", return_value="ds-key"),
        patch.object(providers, "_gemini_key", return_value="gem-key"),
        patch.object(
            providers,
            "_ask_deepseek_to_route",
            new=AsyncMock(return_value=(decision, decision.answer_text, {"total_tokens": 50})),
        ),
        patch.object(providers, "_call_gemini_full_async", new=AsyncMock()) as gemini,
        patch.object(providers, "record_gemini_usage"),
    ):
        raw, provider, usage = await providers.generate_wayra_full_response(
            system_prompt="Return the assistant response JSON.",
            user_block='{"user_message":"Help me plan today."}',
            user_message="Help me plan today.",
        )

    assert provider == "deepseek"
    assert "A useful answer." in raw
    assert usage == {"total_tokens": 50}
    gemini.assert_not_awaited()


@pytest.mark.asyncio
async def test_full_response_calls_gemini_only_when_deepseek_selects_it():
    decision = providers.DeepSeekRouteDecision(
        route="gemini",
        rewritten_prompt="Synthesize the multi-country route constraints.",
        answer_text='{"message":"A safe provisional route answer.","suggested_actions":[]}',
    )
    with (
        patch.object(providers, "_deepseek_key", return_value="ds-key"),
        patch.object(providers, "_gemini_key", return_value="gem-key"),
        patch.object(
            providers,
            "_ask_deepseek_to_route",
            new=AsyncMock(return_value=(decision, decision.answer_text, {"total_tokens": 50})),
        ),
        patch.object(
            providers,
            "_call_gemini_full_async",
            new=AsyncMock(
                return_value=(
                    '{"message":"Gemini route synthesis.","suggested_actions":[]}',
                    {"total_tokens": 90},
                )
            ),
        ) as gemini,
        patch.object(providers, "record_gemini_usage"),
    ):
        raw, provider, usage = await providers.generate_wayra_full_response(
            system_prompt="Return the assistant response JSON.",
            user_block='{"user_message":"Compare this multi-country route."}',
            user_message="Compare this multi-country route.",
        )

    assert provider == "gemini"
    assert "Gemini route synthesis" in raw
    assert usage is not None and usage["total_tokens"] == 140
    routed_input = gemini.await_args.args[1]
    assert decision.rewritten_prompt in routed_input
    assert "Compare this multi-country route." in routed_input
