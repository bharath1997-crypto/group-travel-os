"""Compact LLM calls for Perplexity-style Wayra (cost-aware tiers, quality where it matters)."""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

import httpx

from config import settings
from app.services.gemini_usage import parse_sdk_usage_metadata, record_gemini_usage

logger = logging.getLogger(__name__)

_DEEPSEEK_MODEL_DEFAULT = "deepseek-v4-flash"
_GEMINI_MODEL = "gemini-2.5-flash"
_SUMMARY_MAX_TOKENS = 220

_WAYRA_SUMMARY_SYSTEM = """You are Wayra, Rovvy's built-in travel assistant.
Summarize ONLY from the provided source snippets. Plain text, no markdown.
Write 2 to 4 short sentences (max 120 words). Do not invent business names, prices, or hours.
Never mention Google, Gemini, DeepSeek, OpenAI, or any AI vendor.
For culture or must-try food questions: use Wikipedia and Live map context (region, country, coordinates).
Describe regional traditions, landscape, and typical cuisine categories — not specific restaurant names unless listed in NEARBY OSM data.
If OpenStreetMap has no nearby POIs, explain the area may be remote and still answer from regional context.
Never say only "Dropped pin" — use the resolved region name from context when the label is generic.
If sources are thin, share what the region is known for and invite the user to open the source links.
Do not open every answer with "UNESCO World Heritage Site" — lead with what the user asked.
Vary your opening sentence; avoid repeating the same template across questions.
Reply with JSON: {"message": "..."}"""


def _discovery_style_hint(user_message: str) -> str:
    q = user_message.lower()
    hints: list[str] = []
    if any(k in q for k in ("activities", "what can i do", "things to do", "not miss", "hidden gems")):
        hints.append(
            "Structure the answer with short group labels when helpful: "
            "Must-see, Food nearby, Museums, Walking/time tips."
        )
    if any(k in q for k in ("food", "eat", "bite", "restaurant", "cuisine", "coffee")):
        hints.append(
            "When NEARBY OSM listings exist, mention name, walking distance, and cuisine type from the snippet."
        )
    if any(k in q for k in ("culture", "famous", "worth visiting", "customs", "etiquette")):
        hints.append("Lead with what makes this specific place distinct for visitors.")
    if hints:
        return "Style: " + " ".join(hints)
    return "Style: Answer the exact question first; keep it conversational and specific to the pinned place."


def _deepseek_key() -> str:
    return (
        getattr(settings, "deepseek_api_key", None)
        or os.environ.get("DEEPSEEK_API_KEY")
        or ""
    ).strip()


def _deepseek_model() -> str:
    raw = getattr(settings, "deepseek_model", None) or os.environ.get("DEEPSEEK_MODEL")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return _DEEPSEEK_MODEL_DEFAULT


def _gemini_key() -> str:
    return (settings.gemini_api_key or os.environ.get("GEMINI_API_KEY") or "").strip()


def _openai_key() -> str:
    return (settings.openai_api_key or os.environ.get("OPENAI_API_KEY") or "").strip()


def _parse_summary_json(raw: str) -> str:
    text = raw.strip()
    if "```" in text:
        fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL | re.IGNORECASE)
        if fence:
            text = fence.group(1).strip()
    if not text.startswith("{"):
        inline = re.search(r'\{[^{}]*"message"\s*:\s*"[^"]*"[^{}]*\}', text, re.DOTALL)
        if inline:
            text = inline.group(0)
        else:
            loose = re.search(r'"message"\s*:\s*"((?:\\.|[^"\\])*)"', text, re.DOTALL)
            if loose:
                try:
                    return json.loads(f'"{loose.group(1)}"')[:600]
                except json.JSONDecodeError:
                    return loose.group(1).replace('\\"', '"')[:600]
    if text.startswith("{"):
        try:
            data = json.loads(text)
            msg = data.get("message")
            if isinstance(msg, str) and msg.strip():
                return msg.strip()[:600]
        except json.JSONDecodeError:
            pass
    cleaned = re.sub(r"^here is the json requested:?\s*", "", text, flags=re.I).strip()
    if cleaned != text:
        return _parse_summary_json(cleaned)
    if text.startswith("{"):
        return text[:600]
    return text[:600]


async def summarize_from_sources(
    *,
    user_message: str,
    place_label: str,
    source_block: str,
    tier: str,
) -> tuple[str, str, dict[str, int] | None]:
    """
    Returns (message, provider_used, usage_dict).
    provider_used: deepseek | gemini | openai | template

    Cost-quality tiers:
    - nearby / discovery: DeepSeek first (cheap summaries from open sources).
    - location_hard: Gemini first (route / distance / border quality), DeepSeek fallback.
    """
    user_block = (
        f"Place context: {place_label}\n"
        f"User question: {user_message}\n"
        f"{_discovery_style_hint(user_message)}\n\n"
        f"SOURCE SNIPPETS:\n{source_block}\n\n"
        "Reply with JSON only: {\"message\": \"...\"}"
    )

    if tier == "location_hard":
        return await _summarize_quality_first(user_block, tier)
    return await _summarize_cost_first(user_block, tier)


async def _summarize_cost_first(
    user_block: str,
    tier: str,
) -> tuple[str, str, dict[str, int] | None]:
    """Cheap path: DeepSeek → Gemini → OpenAI → template."""
    if _deepseek_key():
        try:
            text, usage = await _call_deepseek(user_block)
            record_gemini_usage(feature="wayra_discovery", model=_deepseek_model(), usage=usage)
            return _parse_summary_json(text), "deepseek", usage
        except Exception as exc:  # noqa: BLE001
            logger.warning("Wayra DeepSeek failed (tier=%s): %s", tier, exc)

    if _gemini_key():
        try:
            text, usage = await _call_gemini_compact(user_block)
            record_gemini_usage(feature="wayra_discovery_fallback", model=_GEMINI_MODEL, usage=usage)
            return _parse_summary_json(text), "gemini", usage
        except Exception as exc:  # noqa: BLE001
            logger.warning("Wayra compact Gemini failed (tier=%s): %s", tier, exc)

    return await _summarize_openai_or_template(user_block, source_block_from_user(user_block))


async def _summarize_quality_first(
    user_block: str,
    tier: str,
) -> tuple[str, str, dict[str, int] | None]:
    """Quality path for route/navigation: Gemini → DeepSeek → OpenAI → template."""
    if _gemini_key():
        try:
            text, usage = await _call_gemini_compact(user_block)
            record_gemini_usage(feature="wayra_location_hard", model=_GEMINI_MODEL, usage=usage)
            return _parse_summary_json(text), "gemini", usage
        except Exception as exc:  # noqa: BLE001
            logger.warning("Wayra compact Gemini failed (tier=%s): %s", tier, exc)

    if _deepseek_key():
        try:
            text, usage = await _call_deepseek(user_block)
            record_gemini_usage(feature="wayra_location_hard_fallback", model=_deepseek_model(), usage=usage)
            return _parse_summary_json(text), "deepseek", usage
        except Exception as exc:  # noqa: BLE001
            logger.warning("Wayra DeepSeek failed (tier=%s): %s", tier, exc)

    return await _summarize_openai_or_template(user_block, source_block_from_user(user_block))


def source_block_from_user(user_block: str) -> str:
    marker = "SOURCE SNIPPETS:\n"
    if marker in user_block:
        tail = user_block.split(marker, 1)[1]
        if "\n\nReply with JSON" in tail:
            return tail.split("\n\nReply with JSON", 1)[0].strip()
        return tail.strip()
    return ""


async def _summarize_openai_or_template(
    user_block: str,
    source_block: str,
) -> tuple[str, str, dict[str, int] | None]:
    if _openai_key():
        try:
            text = await _call_openai_compact(user_block)
            return _parse_summary_json(text), "openai", None
        except Exception as exc:  # noqa: BLE001
            logger.warning("Wayra OpenAI compact failed: %s", exc)

    first_line = source_block.split("\n")[0].strip() if source_block else ""
    place_ctx = user_block.split("\n", 1)[0].replace("Place context: ", "").strip()
    fallback = (
        f"Here's what I found for {place_ctx or 'this place'}. "
        f"{first_line} Open the source links below to read more."
    )
    return fallback[:600], "template", None


async def _call_deepseek(user_block: str) -> tuple[str, dict[str, int] | None]:
    key = _deepseek_key()
    model = _deepseek_model()
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": _WAYRA_SUMMARY_SYSTEM},
            {"role": "user", "content": user_block},
        ],
        "max_tokens": _SUMMARY_MAX_TOKENS,
        "temperature": 0.35,
        "response_format": {"type": "json_object"},
        "thinking": {"type": "disabled"},
    }
    async with httpx.AsyncClient(timeout=45.0) as client:
        r = await client.post(
            "https://api.deepseek.com/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json=body,
        )
    r.raise_for_status()
    data = r.json()
    text = data["choices"][0]["message"]["content"]
    usage_raw = data.get("usage") or {}
    usage = None
    if usage_raw:
        prompt = int(usage_raw.get("prompt_tokens") or 0)
        output = int(usage_raw.get("completion_tokens") or 0)
        if prompt or output:
            usage = {
                "prompt_tokens": prompt,
                "output_tokens": output,
                "total_tokens": prompt + output,
            }
    return str(text), usage


async def _call_openai_compact(user_block: str) -> str:
    from openai import AsyncOpenAI  # type: ignore[import-untyped]

    client = AsyncOpenAI(api_key=_openai_key(), timeout=45.0)
    resp = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": _WAYRA_SUMMARY_SYSTEM},
            {"role": "user", "content": user_block},
        ],
        max_tokens=_SUMMARY_MAX_TOKENS,
        temperature=0.35,
        response_format={"type": "json_object"},
    )
    return str(resp.choices[0].message.content or "")


async def _call_gemini_compact(user_block: str) -> tuple[str, dict[str, int] | None]:
    import google.generativeai as genai  # type: ignore[import-untyped]

    genai.configure(api_key=_gemini_key())
    model = genai.GenerativeModel(
        model_name=_GEMINI_MODEL,
        system_instruction=_WAYRA_SUMMARY_SYSTEM,
        generation_config=genai.types.GenerationConfig(  # type: ignore[attr-defined]
            max_output_tokens=_SUMMARY_MAX_TOKENS,
            temperature=0.4,
            response_mime_type="application/json",
        ),
    )
    response = model.generate_content(user_block)
    usage = parse_sdk_usage_metadata(response)
    return (response.text or "").strip(), usage
