"""Ticketmaster Discovery Feed loader (index + S3 stream + staging + upsert)."""
from __future__ import annotations

import logging
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Iterator

import httpx

from scaper.feed.persistence import (
    expire_unseen_for_country,
    get_feed_state,
    insert_staging_batch,
    provider_enabled,
    truncate_staging,
    upsert_events_from_staging,
    write_feed_state,
)
from scaper.feed.stream import FeedMd5Mismatch, iter_feed_events
from scaper.feed.dedup import enqueue_staging_cities, process_dedup_queue
from scaper.feed.ticketmaster_map import map_feed_event, within_horizon
from scaper.feed.venues import match_staging_venues
from scaper.http import ConnectorError, RetryingClient
from scaper.budget import REFUSAL_MARKERS

logger = logging.getLogger(__name__)

FEED_INDEX_URL = "https://app.ticketmaster.com/discovery-feed/v2/events"
STAGING_BATCH = 400


@dataclass
class FeedLoadReport:
    country: str
    status: str
    skipped_reason: str | None = None
    api_calls: int = 0
    staged: int = 0
    inserted: int = 0
    updated: int = 0
    expired: int = 0
    rejections: Counter[str] = field(default_factory=Counter)
    expiry_guard: bool = False
    md5: str | None = None
    dry_run: bool = False
    deduped: int = 0


def fetch_feed_index(client: RetryingClient, *, country: str) -> dict[str, Any]:
    try:
        body = client.get_json(FEED_INDEX_URL)
    except ConnectorError as exc:
        msg = str(exc)
        if any(marker in msg for marker in REFUSAL_MARKERS):
            raise
        raise
    cc = country.upper()
    countries = body.get("countries") or {}
    entry = (countries.get(cc) or countries.get(cc.lower()) or {}).get("JSON") or {}
    if not entry.get("uri"):
        raise ConnectorError(f"no JSON feed entry for country {cc}")
    return entry


def _stream_download(uri: str, client: httpx.Client) -> Iterator[bytes]:
    with client.stream("GET", uri, follow_redirects=True) as response:
        response.raise_for_status()
        for chunk in response.iter_bytes(256 * 1024):
            if chunk:
                yield chunk


def load_ticketmaster_feed(
    engine,
    store,
    *,
    source,
    api_key: str,
    country: str,
    dry_run: bool = False,
    force: bool = False,
    client: httpx.Client | None = None,
) -> FeedLoadReport:
    """Load one country's feed. ``dry_run`` rolls back all DB changes."""
    cc = country.strip().upper()
    report = FeedLoadReport(country=cc, status="failed", dry_run=dry_run)
    http = client or httpx.Client(timeout=120.0)
    index_client = RetryingClient(http, params={"apikey": api_key.strip()})
    report.api_calls = 1

    try:
        entry = fetch_feed_index(index_client, country=cc)
    except ConnectorError as exc:
        report.skipped_reason = str(exc)
        if any(m in str(exc) for m in REFUSAL_MARKERS):
            report.status = "refused"
        return report

    md5_expected = str(entry.get("compressed_md5_checksum") or "").lower()
    last_updated_raw = entry.get("last_updated")
    last_updated = (
        datetime.fromisoformat(str(last_updated_raw).replace("Z", "+00:00")) if last_updated_raw else None
    )

    if not dry_run and not force:
        with engine.connect() as conn:
            if not provider_enabled(conn, "ticketmaster_feed"):
                report.status = "skipped"
                report.skipped_reason = "ticketmaster_feed disabled in provider_registry"
                return report
            if not source.enabled:
                report.status = "skipped"
                report.skipped_reason = "feed source row disabled"
                return report
            prior = get_feed_state(conn, "ticketmaster_feed", cc)
            if (
                prior
                and prior.get("last_md5") == md5_expected
                and prior.get("last_updated") == last_updated
                and prior.get("status") in ("succeeded", "partial", "unchanged")
            ):
                with engine.begin() as wconn:
                    write_feed_state(
                        wconn,
                        provider="ticketmaster_feed",
                        country=cc,
                        last_md5=md5_expected,
                        last_updated=last_updated,
                        num_events=prior.get("num_events"),
                        status="unchanged",
                    )
                report.status = "unchanged"
                return report

    uri = str(entry["uri"])
    horizon_days = int((source.config or {}).get("horizon_days") or 365)
    horizon_cutoff = datetime.now(timezone.utc) + timedelta(days=horizon_days)
    blocked = store.blocked_ids("ticketmaster")
    run_started = datetime.now(timezone.utc)

    events, md5_check = iter_feed_events(_stream_download(uri, http), expected_md5_hex=md5_expected or None)

    prior_count = None
    with engine.connect() as conn:
        prior = get_feed_state(conn, "ticketmaster_feed", cc)
        if prior:
            prior_count = prior.get("num_events")

    conn = engine.connect()
    trans = conn.begin()
    try:
        truncate_staging(conn)
        batch: list[dict[str, Any]] = []
        parsed = 0
        for raw in events:
            parsed += 1
            if str(raw.get("eventId") or "") in blocked:
                report.rejections["blocklisted"] += 1
                continue
            row, reason = map_feed_event(raw, fallback_country=cc)
            if reason:
                report.rejections[reason] += 1
                continue
            assert row is not None
            if not within_horizon(row["start_time"], horizon_days=horizon_days):
                report.rejections["beyond horizon"] += 1
                continue
            batch.append(row)
            if len(batch) >= STAGING_BATCH:
                insert_staging_batch(conn, batch)
                report.staged += len(batch)
                batch = []
        if batch:
            insert_staging_batch(conn, batch)
            report.staged += len(batch)

        report.md5 = md5_check.verify()
        match_staging_venues(conn, store)
        enqueue_staging_cities(conn)
        inserted, updated = upsert_events_from_staging(
            conn, source_id=source.id, country_code=cc, horizon_cutoff=horizon_cutoff
        )
        report.inserted = inserted
        report.updated = updated
        expired, guard = expire_unseen_for_country(
            conn,
            country_code=cc,
            run_started=run_started,
            staged_count=report.staged,
            previous_count=prior_count,
        )
        report.expired = expired
        report.expiry_guard = guard
        write_feed_state(
            conn,
            provider="ticketmaster_feed",
            country=cc,
            last_md5=report.md5,
            last_updated=last_updated,
            num_events=report.staged,
            status="partial" if guard else "succeeded",
        )
        if dry_run:
            trans.rollback()
            report.status = "dry_run"
        else:
            trans.commit()
            report.status = "partial" if guard else "succeeded"
            report.deduped = process_dedup_queue(engine, store)
    except FeedMd5Mismatch:
        trans.rollback()
        report.status = "failed"
        report.skipped_reason = "md5 mismatch"
    except Exception:
        trans.rollback()
        raise
    finally:
        conn.close()

    return report
