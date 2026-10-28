"""Run one ticketmaster_feed source through the bulk loader."""
from __future__ import annotations

import uuid

from scaper.config import ScaperSettings
from scaper.feed.load import load_ticketmaster_feed
from scaper.models import RunReport, RunStats


def run_feed_source(store, source, settings: ScaperSettings, *, dry_run: bool = False, force: bool = False) -> RunReport:
    country = str((source.config or {}).get("country") or "US")
    run = store.start_run(source)
    try:
        report = load_ticketmaster_feed(
            store.engine,
            store,
            source=source,
            api_key=settings.ticketmaster_api_key,
            country=country,
            dry_run=dry_run,
            force=force,
        )
        stats = RunStats(
            fetched=report.staged,
            inserted=report.inserted,
            updated=report.updated,
            rejected=sum(report.rejections.values()),
            api_calls=report.api_calls,
            deduped=report.deduped,
        )
        status = "failed" if report.status in ("failed", "refused") else "partial" if report.expiry_guard else "succeeded"
        if report.status == "skipped":
            status = "succeeded"
        if report.status == "unchanged":
            status = "succeeded"
        if report.status == "dry_run":
            status = "succeeded"
        error = report.skipped_reason
        store.finish_run(run, status, stats, error)
        if stats.api_calls:
            store.record_api_calls(run, stats.api_calls)
        return RunReport(run_id=run.id, source=source.name, status=status, stats=stats, error_summary=error)
    except Exception as exc:
        store.finish_run(run, "failed", RunStats(), str(exc))
        raise
