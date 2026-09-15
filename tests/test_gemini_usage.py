"""Tests for Gemini usage logging helpers."""

from types import SimpleNamespace

from app.services.gemini_usage import (
    get_gemini_usage_totals,
    parse_http_usage_metadata,
    parse_sdk_usage_metadata,
    record_gemini_usage,
    reset_gemini_usage_totals,
)


def setup_function() -> None:
    reset_gemini_usage_totals()


def test_parse_sdk_usage_metadata() -> None:
    response = SimpleNamespace(
        usage_metadata=SimpleNamespace(
            prompt_token_count=120,
            candidates_token_count=45,
        )
    )
    usage = parse_sdk_usage_metadata(response)
    assert usage == {
        "prompt_tokens": 120,
        "output_tokens": 45,
        "total_tokens": 165,
    }


def test_parse_http_usage_metadata() -> None:
    usage = parse_http_usage_metadata(
        {"usageMetadata": {"promptTokenCount": 80, "candidatesTokenCount": 20}}
    )
    assert usage == {
        "prompt_tokens": 80,
        "output_tokens": 20,
        "total_tokens": 100,
    }


def test_record_gemini_usage_updates_session_totals() -> None:
    record_gemini_usage(
        feature="wayra_assistant",
        model="gemini-2.5-flash",
        usage={"prompt_tokens": 100, "output_tokens": 50, "total_tokens": 150},
    )
    record_gemini_usage(
        feature="wayra_personal",
        model="gemini-2.5-flash",
        usage={"prompt_tokens": 200, "output_tokens": 30, "total_tokens": 230},
    )

    totals = get_gemini_usage_totals()
    assert totals["prompt_tokens"] == 300
    assert totals["output_tokens"] == 80
    assert totals["total_tokens"] == 380
    assert totals["request_count"] == 2
    assert totals["wayra_assistant_total_tokens"] == 150
    assert totals["wayra_personal_total_tokens"] == 230
