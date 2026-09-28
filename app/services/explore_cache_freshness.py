"""Explore listing cache freshness metadata (G17/F6). Not provider publication time."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

ExploreCacheStatus = Literal[
    "fresh_cache",
    "provider_refresh",
    "stale_fallback",
    "empty",
    "unavailable",
]

VALID_CACHE_STATUSES: frozenset[str] = frozenset(
    {"fresh_cache", "provider_refresh", "stale_fallback", "empty", "unavailable"}
)


def dt_to_iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def explore_freshness_meta(
    *,
    refreshed_at: datetime | None,
    cache_status: str,
) -> dict[str, Any]:
    status: ExploreCacheStatus = (
        cache_status if cache_status in VALID_CACHE_STATUSES else "unavailable"
    )
    iso: str | None = None
    if refreshed_at is not None and status != "unavailable":
        iso = dt_to_iso(refreshed_at)
    return {"refreshed_at": iso, "cache_status": status}
