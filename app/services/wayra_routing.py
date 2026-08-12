"""
Wayra response cascade (latency + cost).

Tier 0 — Internal (~0–50 ms, free):
  Exact local time, weather, distance, app how-tos, pin identity, greetings.

Tier 1 — Hybrid (~200 ms–1 s):
  OpenStreetMap / Wikipedia sources + compact LLM summary when snippets exist.

Tier 2 — DeepSeek controller (~0.5–40 s, chargeable):
  Normalizes the request, decides the answer provider, and supplies a provisional answer.
  Output token budgets (override via WAYRA_OUTPUT_TOKENS_* env):
    compact/nearby 400 · standard/discovery 800 · plan/location_hard 1200 · full assistant 2048

Tier 3 — Gemini (~1–40 s, chargeable):
  Called when selected by DeepSeek, or as an availability fallback if DeepSeek is down.

Complex questions (2+ lines, bullets, or multiple ?): allow up to 40 s total.
Simple one-liners: target ~1 s end-to-end (internal or DeepSeek).
"""

from __future__ import annotations

import re

from app.services.wayra_discovery import normalize_wayra_query

_SIMPLE_LLM_TIMEOUT_S = 12.0
_COMPLEX_LLM_TIMEOUT_S = 40.0


def normalize_query(message: str) -> str:
    return normalize_wayra_query(message)


def is_complex_wayra_question(message: str) -> bool:
    """Long or multi-part questions get a longer LLM budget (up to ~40 s)."""
    if not message or not message.strip():
        return False
    q = normalize_query(message)
    if len(q) > 220:
        return True
    if message.count("?") >= 2:
        return True
    bullet_lines = sum(
        1
        for line in message.split("\n")
        if line.strip().startswith(("-", "*", "•")) or re.match(r"^\d+\.", line.strip())
    )
    if bullet_lines >= 2:
        return True
    if len(message.split("\n")) >= 3:
        return True
    return False


def llm_timeout_seconds(message: str) -> float:
    return _COMPLEX_LLM_TIMEOUT_S if is_complex_wayra_question(message) else _SIMPLE_LLM_TIMEOUT_S
