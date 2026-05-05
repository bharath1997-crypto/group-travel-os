"""Optional Gemini-assisted Explorer enrichment (stub for MVP)."""
from __future__ import annotations

from app.schemas.explorer import ExplorerResultItem


def search_gemini_explorer(location: str, query: str, limit: int = 8) -> list[ExplorerResultItem]:
    """
    Reserved for Gemini-backed discovery. Not wired yet — returns nothing so
    enabled flags can flip without risking crashes or latency.
    """
    del location, query, limit
    return []
