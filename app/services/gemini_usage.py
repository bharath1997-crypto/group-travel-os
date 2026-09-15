"""Structured Gemini token usage logging and in-process session counters."""

from __future__ import annotations

import logging
import threading
from typing import Any

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_session_totals: dict[str, int] = {
    "prompt_tokens": 0,
    "output_tokens": 0,
    "total_tokens": 0,
    "request_count": 0,
}


def parse_sdk_usage_metadata(response: Any) -> dict[str, int] | None:
    """Extract token counts from google-generativeai generate_content response."""
    usage_meta = getattr(response, "usage_metadata", None)
    if usage_meta is None:
        return None
    prompt = int(getattr(usage_meta, "prompt_token_count", 0) or 0)
    output = int(getattr(usage_meta, "candidates_token_count", 0) or 0)
    if prompt == 0 and output == 0:
        return None
    return {
        "prompt_tokens": prompt,
        "output_tokens": output,
        "total_tokens": prompt + output,
    }


def parse_http_usage_metadata(data: dict[str, Any]) -> dict[str, int] | None:
    """Extract token counts from Gemini REST generateContent JSON."""
    raw = data.get("usageMetadata") or data.get("usage_metadata")
    if not isinstance(raw, dict):
        return None
    prompt = int(raw.get("promptTokenCount") or raw.get("prompt_token_count") or 0)
    output = int(
        raw.get("candidatesTokenCount")
        or raw.get("candidates_token_count")
        or raw.get("completionTokenCount")
        or 0
    )
    if prompt == 0 and output == 0:
        return None
    return {
        "prompt_tokens": prompt,
        "output_tokens": output,
        "total_tokens": prompt + output,
    }


def record_gemini_usage(
    *,
    feature: str,
    model: str,
    usage: dict[str, int] | None,
) -> dict[str, int] | None:
    """Log one Gemini call and update in-process session totals."""
    if not usage:
        return None

    prompt = int(usage.get("prompt_tokens", 0) or 0)
    output = int(usage.get("output_tokens", 0) or 0)
    total = int(usage.get("total_tokens", prompt + output) or (prompt + output))

    with _lock:
        _session_totals["prompt_tokens"] += prompt
        _session_totals["output_tokens"] += output
        _session_totals["total_tokens"] += total
        _session_totals["request_count"] += 1
        feature_key = f"{feature}_total_tokens"
        _session_totals[feature_key] = _session_totals.get(feature_key, 0) + total
        feature_requests = f"{feature}_requests"
        _session_totals[feature_requests] = _session_totals.get(feature_requests, 0) + 1

        snapshot = dict(_session_totals)

    logger.info(
        "gemini_usage feature=%s model=%s prompt_tokens=%s output_tokens=%s total_tokens=%s "
        "session_prompt_total=%s session_output_total=%s session_grand_total=%s session_requests=%s",
        feature,
        model,
        prompt,
        output,
        total,
        snapshot["prompt_tokens"],
        snapshot["output_tokens"],
        snapshot["total_tokens"],
        snapshot["request_count"],
    )
    return {
        "prompt_tokens": prompt,
        "output_tokens": output,
        "total_tokens": total,
    }


def get_gemini_usage_totals() -> dict[str, int]:
    """Return cumulative Gemini token totals for this backend process."""
    with _lock:
        return dict(_session_totals)


def reset_gemini_usage_totals() -> None:
    """Reset in-process counters (tests only)."""
    with _lock:
        _session_totals.clear()
        _session_totals.update(
            {
                "prompt_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "request_count": 0,
            }
        )
