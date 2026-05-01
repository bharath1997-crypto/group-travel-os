"""
Travello AI assistant service.

Primary engine  : Google Gemini (gemini-2.0-flash via google-generativeai SDK)
Fallback engine : OpenAI GPT-4o-mini
Branding rule   : NEVER reveal the underlying model or provider to the user.
                  All responses must appear as Travello's own native AI.

The system prompt explicitly forbids the model from mentioning Google, Gemini,
OpenAI, GPT, or any third-party AI name — the user experience is "Travello AI".
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

from config import settings
from app.schemas.ai_assistant import (
    AIAssistantRequest,
    AIAssistantResponse,
    AISuggestedAction,
)

logger = logging.getLogger(__name__)

_GEMINI_MODEL = "gemini-2.5-flash"  # 2.0-flash deprecated June 1 2026
_OPENAI_MODEL = "gpt-4o-mini"
_MAX_OUTPUT_TOKENS = 2048


# ── Prompt construction ────────────────────────────────────────────────────────

def _build_system_prompt(page: str, active_tab: str | None) -> str:
    tab = active_tab or "(not specified)"
    return f"""You are the built-in AI assistant for Travello, a group travel app.
Your name is "Travello AI". You are a native feature of Travello — not a third-party service.

CRITICAL IDENTITY RULES (never break these):
- NEVER mention Google, Gemini, OpenAI, GPT, Claude, or any AI provider or model name.
- NEVER say you are "powered by" anything external.
- If asked what AI you are, say: "I'm Travello AI, your built-in travel assistant."
- If asked about your underlying technology, say: "I'm Travello's own AI, built to help you explore and plan travel."
- Always present yourself as a core part of the Travello product.

The user is on page: {page!r} (active tab/section: {tab!r}).

Your role:
- Help users find events, parks, routes, venues, and travel activities.
- Suggest what to do based on location, time of day, mood, and interests.
- Explain Travello features: trips, maps, expenses, polls, group planning.
- Be friendly, concise, and practical. Suggest clear next steps.
- You are read-only: do NOT claim to have saved, deleted, or changed anything.

Output: a single JSON object only, no other text:
{{
  "message": "string, plain text, <= 1200 chars, no markdown, no code fences",
  "suggested_actions": [
    {{
      "type": "string (e.g. open_tab, search_events, view_map, browse_url)",
      "label": "short button label",
      "target": "string or null",
      "payload": {{}} or null
    }}
  ],
  "summary": {{}} or null
}}
suggested_actions may be an empty array. Do not add fields outside this shape."""


def _build_input_payload(request: AIAssistantRequest) -> str:
    payload = {
        "page": request.page,
        "active_tab": request.active_tab,
        "trip_id": str(request.trip_id) if request.trip_id is not None else None,
        "group_id": str(request.group_id) if request.group_id is not None else None,
        "context": request.context,
        "user_message": request.user_message,
    }
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


# ── Gemini client ──────────────────────────────────────────────────────────────

def _gemini_key() -> str:
    return (
        settings.gemini_api_key
        or os.environ.get("GEMINI_API_KEY")
        or ""
    ).strip()


def _call_gemini(system_prompt: str, user_block: str) -> str:
    """Call Gemini and return the raw text response. Raises on failure."""
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
    prompt = (
        "Context and user message (JSON). Reply with JSON only as specified.\n"
        + user_block
    )
    response = model.generate_content(prompt)
    return response.text or ""


# ── OpenAI fallback ────────────────────────────────────────────────────────────

def _openai_key() -> str:
    return (
        settings.openai_api_key
        or os.environ.get("OPENAI_API_KEY")
        or ""
    ).strip()


def _call_openai(system_prompt: str, user_block: str) -> str:
    """Fallback to OpenAI when Gemini is unavailable. Returns raw text."""
    from openai import OpenAI  # type: ignore[import-untyped]

    key = _openai_key()
    if not key:
        raise ValueError("OPENAI_API_KEY not configured")

    client = OpenAI(api_key=key, timeout=60.0)
    resp = client.responses.create(
        model=_OPENAI_MODEL,
        instructions=system_prompt,
        input=(
            "Context and user message (JSON). Reply with JSON only as specified.\n"
            + user_block
        ),
        max_output_tokens=_MAX_OUTPUT_TOKENS,
    )
    t = getattr(resp, "output_text", None)
    if isinstance(t, str) and t.strip():
        return t.strip()
    out = getattr(resp, "output", None) or []
    parts: list[str] = []
    for item in out:
        for content in getattr(item, "content", None) or []:
            t2 = (
                getattr(content, "text", None)
                or getattr(content, "value", None)
                or getattr(content, "input_text", None)
            )
            if isinstance(t2, str) and t2:
                parts.append(t2)
    return "".join(parts).strip()


# ── JSON parsing / coercion ────────────────────────────────────────────────────

def _strip_markdown_lite(text: str) -> str:
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    s = re.sub(r"\*(.+?)\*", r"\1", s)
    s = re.sub(r"`([^`]+)`", r"\1", s)
    s = re.sub(r"^#{1,6}\s*", "", s, flags=re.MULTILINE)
    return s.strip()


def _parse_model_json(raw: str) -> dict[str, Any] | None:
    text = raw.strip()
    if not text:
        return None
    # Strip code fences if present
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```\s*$", "", text, flags=re.DOTALL).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}\s*$", text)
        if not m:
            return None
        try:
            data = json.loads(m.group(0))
        except json.JSONDecodeError:
            return None
    return data if isinstance(data, dict) else None


def _coerce_action(row: object) -> AISuggestedAction | None:
    if not isinstance(row, dict):
        return None
    t = row.get("type")
    label = row.get("label")
    if not isinstance(t, str) or not t.strip():
        return None
    if not isinstance(label, str) or not label.strip():
        return None
    target = row.get("target")
    if target is not None and not isinstance(target, str):
        target = str(target)
    payload = row.get("payload")
    if payload is not None and not isinstance(payload, dict):
        payload = None
    return AISuggestedAction(
        type=t.strip(),
        label=label.strip(),
        target=target,
        payload=payload,
    )


def _build_response(data: dict[str, Any] | None, raw: str, user_message: str) -> AIAssistantResponse:
    if data is None:
        clean = _strip_markdown_lite(raw)[:1200]
        return AIAssistantResponse(
            message=clean or "I couldn't process that right now. Please try again.",
            suggested_actions=[],
            summary={"parse": "plain_text"},
        )

    message = data.get("message", "")
    if not isinstance(message, str):
        message = str(message)
    message = _strip_markdown_lite(message)[:1200]

    actions: list[AISuggestedAction] = []
    for a in (data.get("suggested_actions") or []):
        act = _coerce_action(a)
        if act is not None:
            actions.append(act)

    summary = data.get("summary")
    if summary is not None and not isinstance(summary, dict):
        summary = None

    if not message:
        message = "I couldn't find an answer right now. Try asking something else!"

    return AIAssistantResponse(
        message=message,
        suggested_actions=actions,
        summary=summary,
    )


def _fallback_response(user_message: str, detail: str = "") -> AIAssistantResponse:
    msg = detail or "I'm having trouble right now. Please try again in a moment."
    safe = f"{msg} You asked: {user_message[:200]}{'…' if len(user_message) > 200 else ''}"
    return AIAssistantResponse(
        message=safe[:1200],
        suggested_actions=[],
        summary={"fallback": True},
    )


# ── Main service class ─────────────────────────────────────────────────────────

class AIAssistantService:
    @staticmethod
    def respond(request: AIAssistantRequest) -> AIAssistantResponse:
        system_prompt = _build_system_prompt(request.page, request.active_tab)
        user_block = _build_input_payload(request)

        raw_text = ""

        # 1. Try Gemini first
        if _gemini_key():
            try:
                raw_text = _call_gemini(system_prompt, user_block)
                logger.debug("Travello AI (primary) responded OK")
            except Exception as exc:  # noqa: BLE001
                logger.warning("Travello AI primary call failed: %s", exc, exc_info=False)
                raw_text = ""

        # 2. Fall back to OpenAI if Gemini failed or key missing
        if not raw_text and _openai_key():
            try:
                raw_text = _call_openai(system_prompt, user_block)
                logger.debug("Travello AI (secondary) responded OK")
            except Exception as exc:  # noqa: BLE001
                logger.warning("Travello AI secondary call failed: %s", exc, exc_info=False)
                raw_text = ""

        if not raw_text:
            return _fallback_response(
                request.user_message,
                "Travello AI is temporarily unavailable. Please try again in a moment.",
            )

        data = _parse_model_json(raw_text)
        return _build_response(data, raw_text, request.user_message)
