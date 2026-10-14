"""Conservative opening_hours validation — no open-now without timezone."""
from __future__ import annotations

import re

# Subset of OSM opening_hours that we treat as structurally parseable for future use.
_SIMPLE_DAY = re.compile(
    r"^(Mo|Tu|We|Th|Fr|Sa|Su)(-(Mo|Tu|We|Th|Fr|Sa|Su))?\s+\d{1,2}:\d{2}-\d{1,2}:\d{2}$"
)


def opening_hours_structurally_valid(raw: str | None) -> bool:
    """True only for simple single-rule strings; complex OSM values stay display-only."""
    if raw is None:
        return False
    text = raw.strip()
    if not text or text.lower() in {"24/7", "24/7 open"}:
        return True
    if ";" in text or "," in text:
        return False
    return bool(_SIMPLE_DAY.match(text))
