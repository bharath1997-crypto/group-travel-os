"""Explicit Wayra LLM output token budgets (chargeable DeepSeek / Gemini tiers)."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass

from app.services.wayra_intent import normalize_query

# Defaults — override via env (WAYRA_OUTPUT_TOKENS_*).
_DEFAULT_COMPACT = 400
_DEFAULT_STANDARD = 800
_DEFAULT_PLAN = 1200
_DEFAULT_FULL = 2048
_DEFAULT_ORCHESTRATOR = 1200

_DEFAULT_CHARS_COMPACT = 1200
_DEFAULT_CHARS_STANDARD = 2400
_DEFAULT_CHARS_PLAN = 4000
_DEFAULT_CHARS_FULL = 6000


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or not str(raw).strip().isdigit():
        return default
    return max(64, int(str(raw).strip()))


@dataclass(frozen=True)
class WayraOutputBudget:
    tier: str
    max_output_tokens: int
    max_message_chars: int
    orchestrator_max_tokens: int
    style: str  # compact | standard | plan | full


_PLAN_QUESTION_RE = re.compile(
    r"\b("
    r"plan(?:ning)?(?:\s+a\s+trip)?|"
    r"itinerary|"
    r"what do you say|"
    r"what should i do(?: here| at this)?|"
    r"how should i (?:visit|approach|prepare)|"
    r"help me plan|"
    r"trip plan|"
    r"visit plan|"
    r"how to reach|way to reach|how do i get there|"
    r"what flight|which flight|when should i (?:go|visit|plan|travel)|"
    r"how many days|what should i plan|"
    r"\$\d|\d+\s*(?:k|000)\s*(?:dollars|usd)|budget"
    r")\b",
    re.I,
)


def is_plan_question(message: str) -> bool:
    return bool(_PLAN_QUESTION_RE.search(normalize_query(message)))


def resolve_output_budget(tier: str, user_message: str = "") -> WayraOutputBudget:
    """Map answer tier + question shape to explicit output limits."""
    if tier == "nearby":
        tokens = _env_int("WAYRA_OUTPUT_TOKENS_COMPACT", _DEFAULT_COMPACT)
        chars = _env_int("WAYRA_OUTPUT_CHARS_COMPACT", _DEFAULT_CHARS_COMPACT)
        return WayraOutputBudget(
            tier=tier,
            max_output_tokens=tokens,
            max_message_chars=chars,
            orchestrator_max_tokens=min(tokens + 200, _env_int("WAYRA_OUTPUT_TOKENS_ORCHESTRATOR", _DEFAULT_ORCHESTRATOR)),
            style="compact",
        )

    if tier in {"location_hard", "plan"} or is_plan_question(user_message):
        tokens = _env_int("WAYRA_OUTPUT_TOKENS_PLAN", _DEFAULT_PLAN)
        chars = _env_int("WAYRA_OUTPUT_CHARS_PLAN", _DEFAULT_CHARS_PLAN)
        effective_tier = tier if tier in {"location_hard", "plan"} else "plan"
        return WayraOutputBudget(
            tier=effective_tier,
            max_output_tokens=tokens,
            max_message_chars=chars,
            orchestrator_max_tokens=_env_int("WAYRA_OUTPUT_TOKENS_ORCHESTRATOR", _DEFAULT_ORCHESTRATOR),
            style="plan",
        )

    if tier == "full":
        tokens = _env_int("WAYRA_OUTPUT_TOKENS_FULL", _DEFAULT_FULL)
        chars = _env_int("WAYRA_OUTPUT_CHARS_FULL", _DEFAULT_CHARS_FULL)
        return WayraOutputBudget(
            tier=tier,
            max_output_tokens=tokens,
            max_message_chars=chars,
            orchestrator_max_tokens=tokens,
            style="full",
        )

    tokens = _env_int("WAYRA_OUTPUT_TOKENS_STANDARD", _DEFAULT_STANDARD)
    chars = _env_int("WAYRA_OUTPUT_CHARS_STANDARD", _DEFAULT_CHARS_STANDARD)
    return WayraOutputBudget(
        tier=tier,
        max_output_tokens=tokens,
        max_message_chars=chars,
        orchestrator_max_tokens=_env_int("WAYRA_OUTPUT_TOKENS_ORCHESTRATOR", _DEFAULT_ORCHESTRATOR),
        style="standard",
    )
