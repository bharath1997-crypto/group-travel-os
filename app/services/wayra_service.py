"""
Wayra — Travello explorer-facing Gemini summaries (Explorer results → short copy).
Bounded HTTP timeouts; failures never propagate to callers.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any

import httpx

from app.core.api_limits import API_TIMEOUT_SECONDS
from app.schemas.explorer import ExplorerResultItem
from config import settings

logger = logging.getLogger(__name__)

_GEMINI_MODEL = "gemini-2.5-flash"
_GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{_GEMINI_MODEL}:generateContent"
)


class WayraService:
    """Group-travel explorer helper; Explorer suggestions use minimal contextual payloads."""

    def generate_explorer_suggestion(
        self,
        query: str,
        location: str,
        results: list[ExplorerResultItem],
    ) -> str | None:
        key = _gemini_key()
        if not key:
            return None
        q = (query or "").strip()
        if not q:
            return None
        if not results:
            return None

        subset = _top_ticketmaster_yelp_for_prompt(results, limit=5)
        if not subset:
            return None

        payload_items = [_minimal_result_dict(r) for r in subset]
        try:
            text = _call_gemini_explorer_suggestion(
                api_key=key,
                query=q,
                location=(location or "").strip() or "Unknown",
                results_minimal=payload_items,
            )
        except Exception as exc:
            logger.debug("Wayra Gemini suggestion failed: %s", exc)
            return None

        out = (text or "").strip()
        return out or None


def _gemini_key() -> str:
    return (
        (settings.gemini_api_key or "").strip()
        or (os.environ.get("GEMINI_API_KEY") or "").strip()
    )


def _top_ticketmaster_yelp_for_prompt(
    results: list,
    *,
    limit: int,
) -> list[ExplorerResultItem]:
    out: list[ExplorerResultItem] = []
    for row in results:
        if len(out) >= limit:
            break
        if not isinstance(row, ExplorerResultItem):
            continue
        src = (row.source or "").lower()
        if src in ("ticketmaster", "yelp"):
            out.append(row)
    return out


def _minimal_result_dict(item: ExplorerResultItem) -> dict[str, Any]:
    venue = (item.venue or "").strip()
    city = (item.city or "").strip()
    price_label = (item.priceLabel or "").strip()
    if not price_label and item.price_from is not None:
        price_label = f"${item.price_from:.0f}" if item.price_from >= 1 else f"${item.price_from:.2f}"
    elif not price_label and item.is_free:
        price_label = "Free"
    date_label = (item.dateLabel or item.date_str or "").strip()
    return {
        "title": (item.title or "").strip(),
        "source": (item.source or "").strip(),
        "type": item.type,
        "venue": venue or None,
        "city": city or None,
        "priceLabel": price_label or None,
        "dateLabel": date_label or None,
    }


def _call_gemini_explorer_suggestion(
    *,
    api_key: str,
    query: str,
    location: str,
    results_minimal: list[dict[str, Any]],
) -> str:
    instruction = (
        "You are Wayra, Travello's group travel AI assistant. Based on this user's "
        "search and available Explorer results, write a helpful 2-3 sentence suggestion. "
        "Be practical, friendly, and concise. Do not invent places not included in the results."
    )
    context = json.dumps(
        {
            "query": query,
            "location": location,
            "results": results_minimal,
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )
    user_text = f"{instruction}\n\nContext (JSON):\n{context}\n\nReturn only plain text."

    body: dict[str, Any] = {
        "contents": [{"role": "user", "parts": [{"text": user_text}]}],
        "generationConfig": {
            "temperature": 0.35,
            "maxOutputTokens": 256,
        },
    }

    with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
        r = client.post(_GEMINI_URL, params={"key": api_key}, json=body)
    if r.status_code != 200:
        logger.debug("Wayra Gemini HTTP %s: %s", r.status_code, r.text[:300])
        return ""

    data = r.json()
    candidates = data.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        return ""

    first = candidates[0]
    if not isinstance(first, dict):
        return ""

    content = first.get("content")
    if not isinstance(content, dict):
        return ""

    parts = content.get("parts")
    if not isinstance(parts, list):
        return ""

    chunks: list[str] = []
    for p in parts:
        if isinstance(p, dict) and isinstance(p.get("text"), str):
            chunks.append(p["text"])
    return "".join(chunks)
