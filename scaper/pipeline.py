"""fetch -> raw_records -> extract -> places + events, for one source."""
from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass

from scaper.allocator import CyclePlan, log_cycle_summary, plan_connector_sources, plan_spare_budget_sources
from scaper.budget import REFUSAL_MARKERS, within_budget
from scaper.connectors.base import Connector
from scaper.connectors.ticketmaster import venue_city_and_state
from scaper.models import EventRecord, Rejected, RunReport, RunStats, RunStatus, Source
from scaper.store import RunInProgress, Store

logger = logging.getLogger(__name__)

EXTRACT_CHUNK_SIZE = 200


def _is_state_source(source: Source) -> bool:
    """Sources spanning many cities (US state or whole country): city comes from each venue."""
    return bool(source.state_code or source.config.get("state_code") or source.config.get("country_code"))


def _event_location(source: Source, event: EventRecord, payload: dict) -> tuple[str | None, str | None]:
    """Return (city_slug, state_code) stamped onto the event row."""
    if _is_state_source(source):
        slug, state = venue_city_and_state(payload)
        return slug, state
    state = None
    if event.venue and event.venue.region:
        state = str(event.venue.region).strip().upper() or None
    return source.city_slug, state


@dataclass(frozen=True)
class _PersistRow:
    raw_id: int
    event: EventRecord
    place_id: object
    city_slug: str | None
    state_code: str | None


def run_source(store: Store, connector: Connector, source: Source) -> RunReport:
    """
    Run one source end to end.

    - Fetch errors stop fetching, but everything already fetched is still
      extracted; the run is marked failed.
    - Per-record extraction errors mark that raw record failed (retried on the
      next run) and the run partial.
    - Vanished events are expired only after a complete, error-free fetch.
    - Past Scaper events (ended, or started 6h+ ago with no end) are deleted
      after any run whose fetch succeeded; never after a failed fetch.
    - Then every touched city is re-deduplicated (duplicate_of), after purge.
    """
    if source.connector != connector.name:
        raise ValueError(f"source {source.name} is for {source.connector}, not {connector.name}")
    connector.parse_config(source.config)

    blocked_ids = store.blocked_ids(connector.name)
    run = store.start_run(source)
    stats = RunStats()
    to_extract: list[tuple[int, dict]] = []
    fetch_error: str | None = None
    place_cache: dict[tuple[str, str], object] = {}
    touched_cities: set[str] = set()

    chunk: list[_PersistRow] = []

    def flush_chunk() -> None:
        nonlocal chunk
        if not chunk:
            return
        inserted, updated = store.persist_extractions(connector.name, source, chunk)
        stats.inserted += inserted
        stats.updated += updated
        chunk = []

    def extract_pending() -> None:
        """Extract and persist what has been fetched so far, then release the payloads.

        Runs while fetching, so memory stays bounded: a 60-day France or UK fetch holds
        tens of thousands of ~9 KB payloads and was OOM-killed at 512 MiB.
        """
        pending = list(to_extract)
        to_extract.clear()
        for raw_id, payload in pending:
            try:
                result = connector.extract(payload)
                if isinstance(result, Rejected):
                    store.mark_raw(raw_id, "rejected", result.reason)
                    stats.rejected += 1
                    continue
                city_slug, state_code = _event_location(source, result, payload)
                if city_slug:
                    touched_cities.add(city_slug)
                place_id = None
                if result.venue:
                    cache_key = (connector.name, result.venue.external_id)
                    if cache_key in place_cache:
                        place_id = place_cache[cache_key]
                    else:
                        place_id = store.resolve_place(
                            connector.name, result.venue, city_slug or source.city_slug
                        )
                        place_cache[cache_key] = place_id
                chunk.append(_PersistRow(raw_id, result, place_id, city_slug, state_code))
                if len(chunk) >= EXTRACT_CHUNK_SIZE:
                    flush_chunk()
            except Exception as exc:
                stats.failed += 1
                logger.exception("scaper extract failed for raw_record %s", raw_id)
                try:
                    store.mark_raw(raw_id, "failed", f"{exc.__class__.__name__}: {exc}")
                except Exception:
                    logger.exception("could not mark raw_record %s failed", raw_id)

        flush_chunk()

    try:
        for item in connector.fetch(source.config):
            stats.fetched += 1
            if item.external_id in blocked_ids:
                continue
            raw_id, needs_extraction = store.upsert_raw(source, run, connector.name, item)
            if needs_extraction:
                to_extract.append((raw_id, item.payload))
                if len(to_extract) >= EXTRACT_CHUNK_SIZE:
                    extract_pending()
            else:
                stats.unchanged += 1
                store.touch_event(connector.name, item.external_id)
    except Exception as exc:  # provider/network/config failure
        fetch_error = f"fetch: {exc}"
        logger.exception("scaper fetch failed for %s", source.name)

    extract_pending()
    stats.api_calls = int(getattr(connector, "api_calls_used", 0) or 0)

    if fetch_error is None and connector.last_fetch_complete:
        expired = store.expire_unseen(source, run)
        if expired:
            logger.info("scaper %s: expired %d vanished events", source.name, expired)

    if fetch_error is None:
        try:
            stats.purged = store.purge_past_events(source)
        except Exception:
            logger.exception("scaper purge failed after %s", source.name)
        if stats.purged:
            logger.info("scaper %s: purged %d past events", source.name, stats.purged)

    dedupe_targets = set(touched_cities)
    if source.city_slug:
        dedupe_targets.add(source.city_slug)
    for city in sorted(dedupe_targets):
        try:
            stats.deduped += store.dedupe_city(city)
        except Exception:
            logger.exception("scaper dedup failed for %s", city)

    status: RunStatus
    if fetch_error:
        status = "failed"
    elif stats.failed:
        status = "partial"
    else:
        status = "succeeded"
    error = fetch_error or (f"{stats.failed} records failed extraction" if stats.failed else None)
    store.finish_run(run, status, stats, error)
    record_calls = getattr(store, "record_api_calls", None)
    if record_calls is not None and stats.api_calls:
        record_calls(run, stats.api_calls)
    return RunReport(run_id=run.id, source=source.name, status=status, stats=stats, error_summary=error)


def _advance_ramp(store: Store, source: Source, report: RunReport) -> None:
    """Widen days_ahead one step after a clean run (3 -> 14 -> 60)."""
    ramp = source.config.get("ramp")
    setter = getattr(store, "set_days_ahead", None)
    if not ramp or setter is None or report.status != "succeeded":
        return
    current = int(source.config.get("days_ahead") or ramp[0])
    following = next((d for d in ramp if d > current), None)
    if following is not None:
        setter(source.id, following)
        logger.info("scaper %s: days_ahead %d -> %d", source.name, current, following)


def run_due(
    store: Store,
    connector_for: Callable[[str], Connector],
    *,
    city_slug: str | None = None,
    daily_call_budgets: dict[str, int] | None = None,
    feed_runner: Callable[..., RunReport] | None = None,
) -> list[RunReport]:
    reports: list[RunReport] = []
    failures = 0
    budgets = daily_call_budgets or {}
    stopped: set[str] = set()
    engine = getattr(store, "engine", None)
    due = store.due_sources()
    if city_slug is not None:
        due = [s for s in due if s.city_slug == city_slug]

    def _connector_order(name: str) -> tuple[int, str]:
        priority = {"ticketmaster": 0, "ticketmaster_feed": 1, "eventbrite": 2}.get(name, 9)
        return priority, name

    connectors = sorted({s.connector for s in due}, key=_connector_order)
    for connector in connectors:
        if connector in stopped:
            continue
        budget = budgets.get(connector)
        plan = (
            plan_connector_sources(
                due, connector=connector, store=store, engine=engine, budget=budget
            )
            if engine is not None
            else CyclePlan(to_run=[s for s in due if s.connector == connector])
        )
        calls_used = 0
        for source in plan.to_run:
            if source.connector in stopped:
                continue
            if budget is not None and not within_budget(store, connector, budget):
                plan.skipped.append((source.name, "daily budget exhausted"))
                stopped.add(connector)
                break
            try:
                if source.connector == "ticketmaster_feed":
                    if feed_runner is None:
                        plan.skipped.append((source.name, "feed runner not configured"))
                        continue
                    report = feed_runner(source)
                else:
                    report = run_source(store, connector_for(source.connector), source)
                reports.append(report)
                calls_used += int(report.stats.api_calls or 0)
                _advance_ramp(store, source, report)
                if report.status == "failed" and any(m in (report.error_summary or "") for m in REFUSAL_MARKERS):
                    logger.error(
                        "scaper: %s is refusing requests (%s); skipping its other sources this cycle",
                        source.connector, report.error_summary,
                    )
                    stopped.add(source.connector)
                    break
            except RunInProgress:
                logger.info("scaper %s already running; skipped", source.name)
            except Exception:
                logger.exception("scaper could not run %s", source.name)
                failures += 1
        if engine is not None and connector == "ticketmaster":
            for source in plan_spare_budget_sources(due, connector=connector, store=store, budget=budget):
                if source.connector in stopped or (budget is not None and not within_budget(store, connector, budget)):
                    break
                try:
                    report = run_source(store, connector_for(source.connector), source)
                    reports.append(report)
                    calls_used += int(report.stats.api_calls or 0)
                    _advance_ramp(store, source, report)
                except RunInProgress:
                    continue
        log_cycle_summary(connector, calls_used=calls_used, skipped=plan.skipped)
    if failures:
        raise RuntimeError(f"{failures} scheduled Scaper source(s) could not run")
    return reports
