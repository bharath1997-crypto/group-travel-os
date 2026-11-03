"""Daily API budget allocator: priority order, spare budget, feed-fresh skip."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Callable

from scaper.feed.persistence import feed_fresh_within_hours
from scaper.models import Source
from scaper.budget import within_budget

logger = logging.getLogger(__name__)

FEED_FRESH_HOURS = 26.0
SPARE_TARGET_DAYS = 60


@dataclass
class CyclePlan:
    to_run: list[Source] = field(default_factory=list)
    skipped: list[tuple[str, str]] = field(default_factory=list)


def _source_tier(source: Source) -> int:
    if source.connector == "ticketmaster_feed":
        return 0
    if source.city_slug and not source.state_code and not source.config.get("country_code"):
        return 1
    if source.state_code or source.config.get("state_code"):
        return 2
    if source.config.get("country_code"):
        return 3
    return 4


def _country_for_source(source: Source) -> str | None:
    if source.connector == "ticketmaster_feed":
        return str((source.config or {}).get("country") or "US").upper()
    if source.config.get("country_code"):
        return str(source.config["country_code"]).upper()
    if source.state_code or source.config.get("state_code"):
        return "US"
    return None


def plan_connector_sources(
    sources: list[Source],
    *,
    connector: str,
    store,
    engine,
    budget: int | None,
    feed_fresh_skip: bool = True,
) -> CyclePlan:
    plan = CyclePlan()
    due = [s for s in sources if s.connector == connector]
    due.sort(key=lambda s: (_source_tier(s), s.last_run_at or s.name))

    for source in due:
        cc = _country_for_source(source)
        if (
            feed_fresh_skip
            and connector == "ticketmaster"
            and cc
            and engine is not None
            and feed_fresh_within_hours(engine, cc, hours=FEED_FRESH_HOURS)
        ):
            plan.skipped.append((source.name, f"feed fresh for {cc}"))
            continue
        if budget is not None and not within_budget(store, connector, budget):
            plan.skipped.append((source.name, "daily budget exhausted"))
            continue
        plan.to_run.append(source)
    return plan


def plan_spare_budget_sources(
    sources: list[Source],
    *,
    connector: str,
    store,
    budget: int | None,
) -> list[Source]:
    """After the primary pass, widen days_ahead toward 60 for sources still under budget."""
    if budget is None or not within_budget(store, connector, budget):
        return []
    extras: list[Source] = []
    for source in sources:
        if source.connector != connector:
            continue
        ramp = source.config.get("ramp") or [3, 14, 60]
        current = int(source.config.get("days_ahead") or ramp[0])
        if current >= SPARE_TARGET_DAYS:
            continue
        if not within_budget(store, connector, budget):
            break
        extras.append(source)
    return extras


def log_cycle_summary(
    connector: str,
    *,
    calls_used: int,
    skipped: list[tuple[str, str]],
) -> None:
    logger.info(
        "scaper allocator %s: api_calls=%d skipped=%d %s",
        connector,
        calls_used,
        len(skipped),
        "; ".join(f"{name} ({why})" for name, why in skipped[:8]),
    )
