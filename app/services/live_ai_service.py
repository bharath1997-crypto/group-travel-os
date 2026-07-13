"""
Live Tab — Rovi AI place explanation (Layer 1).

Uses only compact structured context from the Location Context Engine.
"""
from __future__ import annotations

import json
import logging
import os
import re
import time
from typing import Any

from config import settings
from app.schemas.live_location_context import (
    LivePlaceExplanationRequest,
    LivePlaceExplanationResponse,
    RoviCompactContext,
    RoviRiskLevel,
)
from app.services.live_location_context_service import TEMPLATE_COPY

logger = logging.getLogger(__name__)

_GEMINI_MODEL = "gemini-2.5-flash"
_MAX_OUTPUT_TOKENS = 220
_CACHE_TTL_SECONDS = 900
_MAX_CACHE_ENTRIES = 200

_explanation_cache: dict[str, tuple[float, LivePlaceExplanationResponse]] = {}


def clear_live_ai_cache_for_tests() -> None:
    _explanation_cache.clear()


def _gemini_key() -> str:
    return (
        settings.gemini_api_key
        or os.environ.get("GEMINI_API_KEY")
        or ""
    ).strip()


def _cache_key(compact: RoviCompactContext) -> str:
    miles = compact.distance_miles if compact.distance_miles is not None else -1
    return (
        f"{compact.place_name}|{compact.place_area}|{compact.user_area}|"
        f"{compact.classification}|{miles:.1f}|{compact.live_safe}"
    )


def _prune_cache() -> None:
    now = time.time()
    expired = [key for key, (expires_at, _) in _explanation_cache.items() if expires_at <= now]
    for key in expired:
        del _explanation_cache[key]
    overflow = len(_explanation_cache) - _MAX_CACHE_ENTRIES
    if overflow <= 0:
        return
    oldest = sorted(_explanation_cache.keys(), key=lambda k: _explanation_cache[k][0])[:overflow]
    for key in oldest:
        del _explanation_cache[key]


def _risk_level(compact: RoviCompactContext) -> RoviRiskLevel:
    if compact.classification in {"country_mismatch", "very_far_destination"}:
        return "very_far"
    if compact.classification in {"far_destination", "incomplete_place_data"}:
        return "far"
    miles = compact.distance_miles
    if miles is None:
        return "far"
    if miles <= 100:
        return "normal"
    return "far"


def _template_fallback(compact: RoviCompactContext) -> LivePlaceExplanationResponse:
    template = TEMPLATE_COPY.get(compact.classification) or TEMPLATE_COPY["far_destination"]
    return LivePlaceExplanationResponse(
        summary=template.summary,
        recommendation=template.recommendation,
        actions=list(compact.recommended_actions),
        risk_level=_risk_level(compact),
    )


def _build_system_prompt() -> str:
    return """You are Rovi AI, Rovvy's built-in Live Tab assistant.

RULES (never break):
- Use ONLY facts present in the compact JSON context.
- Do not invent distances, flight times, traffic, or prices.
- Do not mention flights, hotels, or tickets unless explicitly present in the context.
- Do not use web search or claim live external data.
- NEVER mention Google, Gemini, OpenAI, GPT, or any AI provider.
- Keep total output under 100 words across summary and recommendation.

Output a single JSON object only:
{
  "summary": "1-2 sentences about what is known",
  "recommendation": "1-2 sentences on what the user can do next",
  "actions": ["Search near me", "Change destination", "Plan Trip", "Continue anyway"],
  "risk_level": "normal" | "far" | "very_far"
}"""


def _build_user_payload(compact: RoviCompactContext) -> str:
    return json.dumps(
        compact.model_dump(exclude_none=True),
        ensure_ascii=False,
        separators=(",", ":"),
    )


def _parse_json(raw: str) -> dict[str, Any] | None:
    text = raw.strip()
    if not text:
        return None
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```\s*$", "", text, flags=re.DOTALL).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}\s*$", text)
        if not match:
            return None
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    return data if isinstance(data, dict) else None


def _coerce_response(
    data: dict[str, Any] | None,
    compact: RoviCompactContext,
) -> LivePlaceExplanationResponse:
    fallback = _template_fallback(compact)
    if not data:
        return fallback

    summary = data.get("summary")
    recommendation = data.get("recommendation")
    actions = data.get("actions")
    risk = data.get("risk_level")

    if not isinstance(summary, str) or not summary.strip():
        summary = fallback.summary
    if not isinstance(recommendation, str) or not recommendation.strip():
        recommendation = fallback.recommendation

    action_list = list(fallback.actions)
    if isinstance(actions, list):
        cleaned = [str(a).strip() for a in actions if str(a).strip()]
        if cleaned:
            action_list = cleaned[:4]

    risk_level = _risk_level(compact)
    if risk in ("normal", "far", "very_far"):
        risk_level = risk

    return LivePlaceExplanationResponse(
        summary=summary.strip()[:500],
        recommendation=recommendation.strip()[:500],
        actions=action_list,
        risk_level=risk_level,
    )


def _call_gemini(system_prompt: str, user_block: str) -> tuple[str, dict[str, int] | None]:
    import google.generativeai as genai  # type: ignore[import-untyped]

    key = _gemini_key()
    if not key:
        raise ValueError("GEMINI_API_KEY not configured")

    genai.configure(api_key=key)
    model = genai.GenerativeModel(
        model_name=_GEMINI_MODEL,
        system_instruction=system_prompt,
        generation_config=genai.types.GenerationConfig(  # type: ignore[attr-defined]
            max_output_tokens=_MAX_OUTPUT_TOKENS,
            temperature=0.3,
        ),
    )
    prompt = "Compact context (JSON). Reply with JSON only.\n" + user_block
    response = model.generate_content(prompt)
    usage: dict[str, int] | None = None
    usage_meta = getattr(response, "usage_metadata", None)
    if usage_meta is not None:
        usage = {
            "prompt_tokens": int(getattr(usage_meta, "prompt_token_count", 0) or 0),
            "output_tokens": int(getattr(usage_meta, "candidates_token_count", 0) or 0),
        }
    return (response.text or "").strip(), usage


class LiveAIService:
    @staticmethod
    def explain_place(request: LivePlaceExplanationRequest) -> LivePlaceExplanationResponse:
        compact = request.compact_context
        key = _cache_key(compact)
        now = time.time()
        cached = _explanation_cache.get(key)
        if cached and cached[0] > now:
            return cached[1]

        raw_text = ""
        usage: dict[str, int] | None = None
        if _gemini_key():
            try:
                raw_text, usage = _call_gemini(
                    _build_system_prompt(),
                    _build_user_payload(compact),
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "live_ai place_explanation gemini failed: %s",
                    exc,
                    exc_info=False,
                )

        if usage:
            logger.info(
                "live_ai feature=place_explanation model=%s prompt_tokens=%s output_tokens=%s",
                _GEMINI_MODEL,
                usage.get("prompt_tokens", 0),
                usage.get("output_tokens", 0),
            )

        result = (
            _coerce_response(_parse_json(raw_text), compact)
            if raw_text
            else _template_fallback(compact)
        )

        _explanation_cache[key] = (now + _CACHE_TTL_SECONDS, result)
        _prune_cache()
        return result
