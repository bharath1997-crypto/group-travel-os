"""
Sidecar AI assistant: OpenAI Responses API, read-only help for the current page.

Integration follows the official OpenAI Python SDK:
  https://github.com/openai/openai-python

Primary API: synchronous ``OpenAI`` + ``client.responses.create`` + ``response.output_text``
(see upstream README: “The primary API for interacting with OpenAI models is the Responses API”).

No database access; no external memory.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

from openai import OpenAI

from config import settings

from app.schemas.ai_assistant import (
    AIAssistantRequest,
    AIAssistantResponse,
    AISuggestedAction,
)
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)

_client: OpenAI | None = None

# Lightweight, cost-effective model for in-app help UX
_MODEL = "gpt-4o-mini"
# Sensible request ceiling (seconds) — OpenAI() accepts a float; see openai-python HTTP client
_CLIENT_TIMEOUT_S = 60.0
_MAX_OUTPUT_TOKENS = 2048


def _openai_key() -> str:
    """
    Prefer Pydantic-loaded ``OPENAI_API_KEY`` from ``.env`` (see ``config.Settings``).
    Fall back to ``os.environ`` for tests or process-level injection.
    """
    from_env = (settings.openai_api_key or os.environ.get("OPENAI_API_KEY") or "").strip()
    return from_env


def _get_client() -> OpenAI:
    """
    Lazy singleton. Passes the API key explicitly so it works when the key comes
    only from ``.env`` via Pydantic Settings (not necessarily ``os.environ``).
    See: https://github.com/openai/openai-python
    """
    global _client
    if _client is not None:
        return _client
    key = _openai_key()
    if not key:
        AppException.bad_request("OPENAI_API_KEY not configured")
    _client = OpenAI(
        api_key=key,
        timeout=_CLIENT_TIMEOUT_S,
    )
    return _client


def _build_system_prompt(page: str, active_tab: str | None) -> str:
    tab = active_tab or "(not specified)"
    return f"""You are Travello’s in-app task assistant (sidecar) for a group travel product called Travello.

The user is on page identifier: {page!r} (active tab or section: {tab!r}).

Behaviors:
- Be helpful, concise, and practical. You explain what the user can do on the current view and how Travello’s features (trips, maps, expenses, polls, members, planning) generally work.
- You may summarize the structured context the app sends. If information is missing, work with what is provided and say what is unknown.
- Suggest clear next steps the user *could* take in the app (e.g. open a tab, review a list). Do not invent data that is not in context.
- You are read-only: you do NOT perform API calls, you do NOT change trips, expenses, polls, groups, or members, and you must not claim you saved, deleted, or updated anything. If the user wants an action, describe what they can tap or do in the UI.
- Do not claim a mutation occurred unless the user had independent confirmation outside this chat (assume you never have it).
- Output plain text in the "message" field: no markdown, no bullet markdown, no code fences, no emojis in the message body (emoji allowed only if the user used them, prefer none).
- Respond with a single JSON object only, no other text, with exactly this structure:
{{
  "message": "string, <= about 1200 characters",
  "suggested_actions": [
    {{
      "type": "string (e.g. open_tab, open_trip, review_expenses, view_map, create_poll_draft, plan_route, note)",
      "label": "short label shown on a button",
      "target": "string or null (e.g. tab id for open_tab)",
      "payload": {{}}  or null
    }}
  ],
  "summary": {{}}  or null, optional key-value metadata e.g. {{"intent": "expense_help"}}
}}
- suggested_actions can be an empty array. types must be simple strings. Do not add fields outside this shape."""


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


def _strip_markdown_lite(text: str) -> str:
    s = text
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
    s = re.sub(r"\*(.+?)\*", r"\1", s)
    s = re.sub(r"`([^`]+)`", r"\1", s)
    s = re.sub(r"^#{1,6}\s*", "", s, flags=re.MULTILINE)
    return s.strip()


def _extract_output_text(response: object) -> str:
    # Official convenience property on the Responses object (openai-python)
    t = getattr(response, "output_text", None)
    if isinstance(t, str) and t.strip():
        return t.strip()
    out = getattr(response, "output", None)
    if not out:
        return ""
    parts: list[str] = []
    for item in out:
        for content in getattr(item, "content", None) or []:
            t2 = getattr(content, "text", None) or getattr(
                content, "value", None
            ) or getattr(
                content,
                "input_text",
                None,
            )
            if isinstance(t2, str) and t2:
                parts.append(t2)
    return "".join(parts).strip()


def _parse_model_json(raw: str) -> dict[str, Any] | None:
    text = raw.strip()
    if not text:
        return None
    if text.startswith("```"):
        text = re.sub(
            r"^```(?:json)?\s*",
            "",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(r"\s*```\s*$", "", text, flags=re.DOTALL)
        text = text.strip()
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
    if not isinstance(data, dict):
        return None
    return data


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


def _fallback_response(
    user_message: str, detail: str = "I couldn’t process that just now."
) -> AIAssistantResponse:
    safe = f"{detail} You asked: {user_message[:200]}{'…' if len(user_message) > 200 else ''}"
    return AIAssistantResponse(
        message=safe[:1200],
        suggested_actions=[],
        summary={"fallback": True},
    )


class AIAssistantService:
    @staticmethod
    def _get_client() -> OpenAI:
        return _get_client()

    @staticmethod
    def _build_system_prompt(page: str, active_tab: str | None) -> str:
        return _build_system_prompt(page, active_tab)

    @staticmethod
    def _build_input_payload(request: AIAssistantRequest) -> str:
        return _build_input_payload(request)

    @staticmethod
    def respond(request: AIAssistantRequest) -> AIAssistantResponse:
        system_prompt = _build_system_prompt(request.page, request.active_tab)
        user_block = _build_input_payload(request)
        try:
            client = _get_client()
            # Responses API (primary in openai-python): instructions + input -> output_text
            resp = client.responses.create(
                model=_MODEL,
                instructions=system_prompt,
                input=f"Context and user message (JSON). Reply with JSON only as specified in instructions.\n{user_block}",
                max_output_tokens=_MAX_OUTPUT_TOKENS,
            )
        except Exception as exc:  # noqa: BLE001 — never crash; return safe fallback
            logger.warning("OpenAI assistant call failed: %s", exc, exc_info=False)
            return _fallback_response(
                request.user_message,
                "The assistant is temporarily unavailable. Please try again in a moment.",
            )
        # SDK exposes x-request-id on responses for support (openai-python docs)
        if getattr(resp, "_request_id", None):
            logger.debug("OpenAI response request_id=%s", resp._request_id)

        raw_text = _extract_output_text(resp)
        if not raw_text:
            return _fallback_response(
                request.user_message,
                "I didn’t get a clear answer. Please try rephrasing your question.",
            )

        data = _parse_model_json(raw_text)
        if data is None:
            clean = _strip_markdown_lite(raw_text)[:1200]
            return AIAssistantResponse(
                message=clean,
                suggested_actions=[],
                summary={"parse": "heuristic_plain_text"},
            )

        message = data.get("message", "")
        if not isinstance(message, str):
            message = str(message)
        message = _strip_markdown_lite(message)[:1200]

        actions: list[AISuggestedAction] = []
        raw_actions = data.get("suggested_actions", [])
        if isinstance(raw_actions, list):
            for a in raw_actions:
                act = _coerce_action(a)
                if act is not None:
                    actions.append(act)

        summary = data.get("summary")
        if summary is not None and not isinstance(summary, dict):
            summary = None

        if not message:
            return _fallback_response(request.user_message)

        return AIAssistantResponse(
            message=message,
            suggested_actions=actions,
            summary=summary,
        )
