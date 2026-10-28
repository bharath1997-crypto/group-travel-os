"""Shared daily API budget helpers for pipeline and allocator."""
from __future__ import annotations

REFUSAL_MARKERS = ("HTTP 429", "HTTP 403", "HTTP 401", "gave up after")


def within_budget(store, connector: str, budget: int) -> bool:
    used_fn = getattr(store, "api_calls_last_24h", None)
    if used_fn is None:
        return True
    return int(used_fn(connector)) < budget
