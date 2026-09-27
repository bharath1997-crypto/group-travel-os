"""Generated/editorial Explore event rows — never verified ticket inventory."""
from __future__ import annotations

from typing import Any

_GENERATED_SOURCE_EXACT = frozenset(
    {
        "ai",
        "ai_fallback",
        "editorial",
        "editorial_suggestions",
        "editorial_suggestion",
        "ai_seasonal",
    }
)


def _event_source_label(ev: dict[str, Any]) -> str:
    return str(ev.get("source") or ev.get("sourceType") or "").strip().lower()


def is_generated_explore_event_row(ev: dict[str, Any]) -> bool:
    event_id = str(ev.get("id") or "").strip()
    if event_id.startswith("ai-ev-") or event_id.startswith("editorial-"):
        return True

    source = _event_source_label(ev)
    if not source:
        return False
    if source in _GENERATED_SOURCE_EXACT:
        return True
    if source == "ai_fallback" or "ai_fallback" in source:
        return True
    if source.startswith("ai_"):
        return True
    if source.startswith("editorial_") or source.startswith("editorial-"):
        return True
    return False


def filter_verified_explore_event_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [row for row in rows if not is_generated_explore_event_row(row)]


def explore_list_total_after_defensive_filter(
    raw_page_events: list[dict[str, Any]],
    filtered_page_events: list[dict[str, Any]],
    reported_total: int,
) -> int:
    """Preserve service-reported totals when defensive route filter removes nothing."""
    removed = len(raw_page_events) - len(filtered_page_events)
    if removed <= 0:
        return int(reported_total)
    return max(0, int(reported_total) - removed)
