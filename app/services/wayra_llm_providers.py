"""Compact LLM calls for Perplexity-style Wayra (cheap default, Gemini for hard location)."""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import httpx

from config import settings
from app.services.gemini_usage import parse_sdk_usage_metadata, record_gemini_usage

logger = logging.getLogger(__name__)

_DEEPSEEK_MODEL = "deepseek-chat"
_GEMINI_MODEL = "gemini-2.5-flash"
_SUMMARY_MAX_TOKENS = 220

_WAYRA_SUMMARY_SYSTEM = """You are Wayra, Rovvy's built-in travel assistant.
Summarize ONLY from the provided source snippets. Plain text, no markdown.
Write 2 to 4 short sentences (max 120 words). Do not invent business names, prices, or hours.
Never mention Google, Gemini, DeepSeek, OpenAI, or any AI vendor.
If sources are thin, say what is known and invite the user to open the source links.
Reply with JSON: {"message": "..."}"""


def _deepseek_key() -> str:
    return (
        getattr(settings, "deepseek_api_key", None)
        or os.environ.get("DEEPSEEK_API_KEY")
        or ""
    ).strip()


def _gemini_key() -> str:
    return (settings.gemini_api_key or os.environ.get("GEMINI_API_KEY") or "").strip()


def _openai_key() -> str:
    return (settings.openai_api_key or os.environ.get("OPENAI_API_KEY") or "").strip()


def _parse_summary_json(raw: str) -> str:
    text = raw.strip()
    if text.startswith("{"):
        try:
            data = json.loads(text)
            msg = data.get("message")
            if isinstance(msg, str) and msg.strip():
                return msg.strip()[:600]
        except json.JSONDecodeError:
            pass
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
    """
    user_block = (
        f"Place context: {place_label}\n"
        f"User question: {user_message}\n\n"
        f"SOURCE SNIPPETS:\n{source_block}\n\n"
        "Reply with JSON only: {\"message\": \"...\"}"
    )

    if tier == "location_hard" and _gemini_key():
        try:
            text, usage = await _call_gemini_compact(user_block)
            record_gemini_usage(feature="wayra_location_hard", model=_GEMINI_MODEL, usage=usage)
            return _parse_summary_json(text), "gemini", usage
        except Exception as exc:  # noqa: BLE001
            logger.warning("Wayra compact Gemini failed: %s", exc)

    if _deepseek_key():
        try:
            text, usage = await _call_deepseek(user_block)
            record_gemini_usage(feature="wayra_discovery", model=_DEEPSEEK_MODEL, usage=usage)
            return _parse_summary_json(text), "deepseek", usage
        except Exception as exc:  # noqa: BLE001
            logger.warning("Wayra DeepSeek failed: %s", exc)

    if _openai_key():
        try:
            text = await _call_openai_compact(user_block)
            return _parse_summary_json(text), "openai", None
        except Exception as exc:  # noqa: BLE001
            logger.warning("Wayra OpenAI compact failed: %s", exc)

    first_line = source_block.split("\n")[0].strip() if source_block else ""
    fallback = (
        f"Here's what I found for {place_label}. "
        f"{first_line} Open the source links below to read more."
    )
    return fallback[:600], "template", None


async def _call_deepseek(user_block: str) -> tuple[str, dict[str, int] | None]:
    key = _deepseek_key()
    body = {
        "model": _DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": _WAYRA_SUMMARY_SYSTEM},
            {"role": "user", "content": user_block},
        ],
        "max_tokens": _SUMMARY_MAX_TOKENS,
        "temperature": 0.35,
        "response_format": {"type": "json_object"},
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
