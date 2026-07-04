"""
Rovi Route AI Service — compact JSON → Gemini → clean user-facing travel answer.

Token-safe flow:
  Backend builds top 3–5 route options (structured)
  ↓
  Compact JSON sent to Gemini (no raw OSM dumps)
  ↓
  Rovi writes user-facing explanation

Rules enforced in system prompt:
- Do not invent flight numbers, exact prices, exact schedules
- Do not hallucinate visa eligibility
- Always say "Provider check required" when live data is missing
"""
from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

from app.schemas.route_intelligence import RouteIntelligenceResponse
from config import settings

logger = logging.getLogger(__name__)

_GEMINI_MODEL = "gemini-2.5-flash"
_MAX_OUTPUT_TOKENS = 600
_CACHE_TTL_SECONDS = 1_800  # 30 min — route explanations change slowly
_MAX_CACHE_ENTRIES = 100

_route_cache: dict[str, tuple[float, str]] = {}


def _gemini_key() -> str:
    return (
        settings.gemini_api_key
        or os.environ.get("GEMINI_API_KEY")
        or ""
    ).strip()


def _cache_key(resp: RouteIntelligenceResponse) -> str:
    ids = "|".join(o.id for o in resp.route_options)
    return f"{resp.origin.name}|{resp.destination.name}|{ids}"


def _prune_cache() -> None:
    now = time.time()
    expired = [k for k, (exp, _) in _route_cache.items() if exp <= now]
    for k in expired:
        del _route_cache[k]
    overflow = len(_route_cache) - _MAX_CACHE_ENTRIES
    if overflow > 0:
        oldest = sorted(_route_cache, key=lambda k: _route_cache[k][0])[:overflow]
        for k in oldest:
            del _route_cache[k]


def _build_system_prompt() -> str:
    return """You are Rovi, the travel intelligence assistant inside Rovvy.

Your job:
Explain route options clearly using ONLY the structured route data provided by the backend.

NEVER invent:
- exact flight numbers
- exact ticket prices
- exact train or bus schedules
- visa/immigration eligibility
- road routes not provided

If live provider data is missing, say:
"Provider check required" or "Price varies — check provider"

Output style:
- Clear, practical, travel-planning focused
- Google-like summary style
- Not too long (under 350 words)
- No scary warnings or legal disclaimers
- No immigration eligibility decisions

Required format:
1. One short paragraph: route summary (2–3 sentences).
2. For each route option: option title, best for, segments list (abbreviated), provider status.
3. End with exactly: "Choose an option to build the full route plan."

IMPORTANT: Return only clean readable text. No markdown headers. No bullet symbols. Use line breaks between options."""


def _build_compact_payload(resp: RouteIntelligenceResponse) -> str:
    """Build minimal JSON — only what Rovi needs. Never sends raw OSM data."""
    payload: dict[str, Any] = {
        "origin": {
            "name": resp.origin.name,
            "country": resp.origin.country,
        },
        "destination": {
            "name": resp.destination.name,
            "country": resp.destination.country,
        },
        "distance_km": resp.distance_km,
        "is_international": resp.is_international,
        "requires_border_crossing": resp.requires_border_crossing,
        "route_options": [],
    }

    for opt in resp.route_options:
        option_dict: dict[str, Any] = {
            "id": opt.id,
            "title": opt.title,
            "type": opt.type,
            "recommended": opt.recommended,
            "best_for": opt.best_for or "",
            "provider_status": opt.provider_status,
            "segments": [
                {
                    "type": seg.type,
                    "from": seg.from_name,
                    "to": seg.to_name,
                    "title": seg.title,
                }
                for seg in opt.segments
            ],
        }
        if opt.estimated_duration:
            option_dict["estimated_duration"] = opt.estimated_duration
        if opt.notes:
            option_dict["notes"] = opt.notes
        payload["route_options"].append(option_dict)

    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def _call_gemini(system_prompt: str, compact_json: str) -> str:
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
            temperature=0.4,
        ),
    )
    prompt = "Route data (compact JSON). Write the Rovi travel explanation.\n" + compact_json
    response = model.generate_content(prompt)
    usage_meta = getattr(response, "usage_metadata", None)
    if usage_meta:
        logger.info(
            "rovi_route_ai model=%s prompt_tokens=%s output_tokens=%s",
            _GEMINI_MODEL,
            getattr(usage_meta, "prompt_token_count", 0),
            getattr(usage_meta, "candidates_token_count", 0),
        )
    return (response.text or "").strip()


def _fallback_explanation(resp: RouteIntelligenceResponse) -> str:
    """Template fallback when Gemini is unavailable."""
    origin_name = resp.origin.name
    dest_name = resp.destination.name
    lines = [
        f"Route options from {origin_name} to {dest_name}.",
        "",
    ]
    for opt in resp.route_options:
        prefix = "Recommended — " if opt.recommended else ""
        lines.append(f"{prefix}{opt.title}")
        lines.append(f"Best for: {opt.best_for or 'general travel'}")
        for seg in opt.segments:
            lines.append(f"  · {seg.title}")
        lines.append(f"Provider status: {opt.provider_status.replace('_', ' ')}")
        lines.append("")
    lines.append("Choose an option to build the full route plan.")
    return "\n".join(lines)


class RoviRouteAIService:
    """
    Converts deterministic RouteIntelligenceResponse into a Rovi user-facing explanation.
    """

    @staticmethod
    def explain(resp: RouteIntelligenceResponse) -> str:
        if not resp.route_options:
            return "No route options could be resolved. Try a different destination."

        key = _cache_key(resp)
        now = time.time()
        cached = _route_cache.get(key)
        if cached and cached[0] > now:
            return cached[1]

        explanation = ""
        if _gemini_key():
            try:
                compact = _build_compact_payload(resp)
                explanation = _call_gemini(_build_system_prompt(), compact)
            except Exception as exc:
                logger.warning(
                    "rovi_route_ai gemini failed: %s", exc, exc_info=False
                )

        if not explanation:
            explanation = _fallback_explanation(resp)

        _route_cache[key] = (now + _CACHE_TTL_SECONDS, explanation)
        _prune_cache()
        return explanation
