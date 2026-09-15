"""Heuristic quality grading for Wayra benchmark rows."""

from __future__ import annotations

import re
from typing import Any


def grade_answer_row(category: str, question: str, row: dict[str, Any]) -> dict[str, Any]:
    message = (row.get("message") or "").strip()
    provider = str(row.get("provider") or "unknown")
    q = question.lower()

    question_answered = bool(message) and len(message) > 20
    app_bot = any(
        x in message
        for x in (
            "Plan tab",
            "create a trip from your Dashboard",
            "I can help you with how to use the app",
        )
    )
    bad_json = "Here is the JSON" in message or message.startswith('{"message"')
    has_sources = int(row.get("sources_count") or 0) > 0

    location_grounded = any(
        tok in message.lower()
        for tok in ("red square", "moscow", "russia", "55.753", "37.620")
    ) or category in ("gps_location", "user_interaction", "conversation", "meta_ai")

    time_sensitive = category in ("weather", "future")
    time_data = False
    if category == "weather":
        time_data = "°c" in message.lower() or "°f" in message.lower() or "overcast" in message.lower()
    if category == "future":
        time_data = "event feed" in message.lower() or "•" in message

    if category == "weather" and "snow" in q:
        question_answered = question_answered and ("snow" in message.lower() or "not" in message.lower())
    if category == "travel" and "drive" in q and "new york" in str(row):
        question_answered = question_answered and (
            "not available" in message.lower()
            or "fly" in message.lower()
            or "route preview" in message.lower()
        )

    factually_supported = "uncertain"
    if provider == "local" and category in ("gps_location", "weather", "meta_ai"):
        factually_supported = "yes" if not bad_json else "no"
    elif has_sources:
        factually_supported = "yes"
    elif "based on general travel knowledge" in message.lower():
        factually_supported = "uncertain"
    elif category == "future" and "no upcoming events" in message.lower():
        factually_supported = "yes"
    elif app_bot or bad_json:
        factually_supported = "no"

    safe_actionable = not app_bot and not bad_json
    if category == "travel" and "solo live" in message.lower():
        if ("drive" in q or "route" in q) and "not available" not in message.lower() and "fly" not in message.lower():
            safe_actionable = False

    verbosity = len(message.split())
    if verbosity < 25:
        verbosity_score = "low"
    elif verbosity < 80:
        verbosity_score = "ok"
    else:
        verbosity_score = "high"

    human_score = 3
    if not question_answered or app_bot or bad_json:
        human_score = 2
    elif provider == "local" and category in ("gps_location", "weather", "meta_ai", "conversation"):
        human_score = 4
    if category == "travel" and "not available" in message.lower() and "fly" in message.lower():
        human_score = 5
    if category == "future" and "event feed" in message.lower():
        human_score = 4 if time_data else 3
    if category == "future" and any(
        tok in message.lower() for tok in ("idaho", "vandals", "kibbie dome", "montana state")
    ):
        human_score = 1
        factually_supported = "no"
        question_answered = False
        time_data = False

    return {
        "question_answered": question_answered,
        "factually_supported": factually_supported,
        "location_grounded": location_grounded,
        "time_sensitive_data_available": time_data if time_sensitive else None,
        "safe_actionable": safe_actionable,
        "verbosity_score": verbosity_score,
        "expected_provider": _expected_provider(category, q),
        "actual_provider": provider,
        "human_score_1_to_5": human_score,
    }


def _expected_provider(category: str, q: str) -> str:
    if category in ("gps_location", "meta_ai", "conversation", "user_interaction"):
        return "local"
    if category == "weather":
        return "local"
    if category == "future":
        return "local"
    if category == "travel" and any(k in q for k in ("drive", "route", "get to")):
        return "local"
    if category in ("food", "cultural", "crime_safety", "clothing", "language"):
        return "deepseek"
    return "local|deepseek"
