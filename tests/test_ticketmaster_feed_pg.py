"""Ticketmaster bulk feed — rolled-back Postgres (SCAPER_PG_TEST_URL)."""
from __future__ import annotations

import gzip
import hashlib
import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text

from scaper.allocator import plan_connector_sources, plan_spare_budget_sources
from scaper.feed.load import load_ticketmaster_feed
from scaper.feed.persistence import (
    expire_unseen_for_country,
    feed_fresh_within_hours,
    insert_staging_batch,
    truncate_staging,
    upsert_events_from_staging,
    write_feed_state,
)
from scaper.models import Source
from scaper.store import PostgresStore
from tests.test_scaper_postgres import MIGRATIONS, _TxEngine

pytestmark = pytest.mark.scaper_postgres

FEED_MIGRATIONS = MIGRATIONS + [
    Path(__file__).resolve().parents[1] / "migrations" / name
    for name in (
        "015_events_country.sql",
        "016_run_api_calls.sql",
        "018_provider_registry.sql",
        "019_tm_feed.sql",
        "020_tm_feed_staging_city_slug.sql",
    )
]


@pytest.fixture()
def pg_feed():
    url = os.getenv("SCAPER_PG_TEST_URL")
    if not url:
        pytest.skip("set SCAPER_PG_TEST_URL to run Ticketmaster feed Postgres tests")
    engine = create_engine(url)
    conn = engine.connect()
    outer = conn.begin()
    try:
        conn.exec_driver_sql("SET LOCAL lock_timeout = '5s'")
        for _ in range(2):
            for migration in FEED_MIGRATIONS:
                conn.exec_driver_sql(migration.read_text(encoding="utf-8"))
        tx_engine = _TxEngine(conn)
        store = PostgresStore(tx_engine)  # type: ignore[arg-type]
        source = store.add_source(
            connector="ticketmaster_feed",
            name=f"tm-feed-it-{uuid.uuid4().hex[:8]}",
            config={"country": "US", "horizon_days": 365},
            city_slug=None,
            interval_minutes=1440,
        )
        conn.execute(
            text("UPDATE ingest.provider_registry SET enabled = true WHERE provider = 'ticketmaster_feed'")
        )
        yield store, conn, source, tx_engine
    finally:
        outer.rollback()
        conn.close()
        engine.dispose()


def _event(eid: str, *, city: str = "Orlando", state: str = "FL", cc: str = "US") -> dict:
    start = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%dT12:00:00Z")
    return {
        "eventId": eid,
        "eventName": f"Show {eid}",
        "eventStatus": "onsale",
        "eventStartDateTime": start,
        "eventImageUrl": "https://example.com/i.jpg",
        "primaryEventUrl": f"https://www.ticketmaster.com/event/{eid}",
        "classificationSegment": "Music",
        "venue": {
            "venueId": f"venue-{city.lower()}",
            "venueName": f"{city} Hall",
            "venueLatitude": "28.5383",
            "venueLongitude": "-81.3792",
            "venueCity": city,
            "venueStateCode": state,
            "venueCountryCode": cc,
            "venueStreet": "1 Main",
            "venueZipCode": "32801",
            "venueTimezone": "America/New_York",
        },
    }


def _gzip_bytes(events: list[dict]) -> bytes:
    return gzip.compress(json.dumps({"events": events}).encode("utf-8"))


def _mock_feed(monkeypatch, events: list[dict], *, md5: str | None = None) -> None:
    data = _gzip_bytes(events)
    digest = md5 or hashlib.md5(data).hexdigest()

    def fake_index(*_a, **_k):
        return {
            "uri": "https://example.com/feed.gz",
            "compressed_md5_checksum": digest,
            "last_updated": "2026-10-28T12:00:00Z",
        }

    def fake_stream(_uri, _client):
        for i in range(0, len(data), 8192):
            yield data[i : i + 8192]

    monkeypatch.setattr("scaper.feed.load.fetch_feed_index", fake_index)
    monkeypatch.setattr("scaper.feed.load._stream_download", fake_stream)


def test_migrations_018_020_apply_twice(pg_feed) -> None:
    assert pg_feed


def test_upsert_duplicate_event_id_in_staging(pg_feed) -> None:
    store, conn, source, _ = pg_feed
    start = datetime.now(timezone.utc) + timedelta(days=10)
    rows = [
        {
            "event_id": "dup-1",
            "legacy_id": None,
            "title": "First",
            "description": None,
            "category": "music",
            "start_time": start,
            "end_time": None,
            "timezone": "America/New_York",
            "status": "scheduled",
            "url": "https://www.ticketmaster.com/event/dup-1",
            "image_url": "https://example.com/a.jpg",
            "venue_id": "v1",
            "venue_name": "Hall",
            "venue_street": "1 Main",
            "venue_city": "Orlando",
            "venue_state": "FL",
            "venue_zip": "32801",
            "country_code": "US",
            "lat": 28.5,
            "lng": -81.3,
            "city_slug": "orlando",
        },
        {
            **{
                "event_id": "dup-1",
                "legacy_id": None,
                "title": "Second title wins",
                "description": None,
                "category": "music",
                "start_time": start + timedelta(hours=1),
                "end_time": None,
                "timezone": "America/New_York",
                "status": "scheduled",
                "url": "https://www.ticketmaster.com/event/dup-1",
                "image_url": "https://example.com/b.jpg",
                "venue_id": "v1",
                "venue_name": "Hall",
                "venue_street": "1 Main",
                "venue_city": "Orlando",
                "venue_state": "FL",
                "venue_zip": "32801",
                "country_code": "US",
                "lat": 28.5,
                "lng": -81.3,
                "city_slug": "orlando",
            },
        },
    ]
    truncate_staging(conn)
    insert_staging_batch(conn, rows)
    horizon = datetime.now(timezone.utc) + timedelta(days=365)
    ins, upd = upsert_events_from_staging(conn, source_id=source.id, country_code="US", horizon_cutoff=horizon)
    assert ins == 1 and upd == 0
    title = conn.execute(
        text("SELECT title FROM public.events WHERE provider = 'ticketmaster' AND external_id = 'dup-1'")
    ).scalar()
    assert title == "Second title wins"


def test_dry_run_creates_no_places(pg_feed, monkeypatch) -> None:
    store, conn, source, _ = pg_feed
    before_places = conn.execute(text("SELECT count(*) FROM places")).scalar()
    before_links = conn.execute(text("SELECT count(*) FROM ingest.place_links")).scalar()
    _mock_feed(monkeypatch, [_event("dry-1")])
    report = load_ticketmaster_feed(
        store.engine,
        store,
        source=source,
        api_key="test-key",
        country="US",
        dry_run=True,
        force=True,
    )
    assert report.status == "dry_run"
    assert report.venues_unlinked >= 1
    assert conn.execute(text("SELECT count(*) FROM places")).scalar() == before_places
    assert conn.execute(text("SELECT count(*) FROM ingest.place_links")).scalar() == before_links
    assert conn.execute(text("SELECT count(*) FROM public.events")).scalar() == 0


def test_md5_mismatch_writes_nothing(pg_feed, monkeypatch) -> None:
    store, conn, source, _ = pg_feed
    events = [_event("md5-1")]
    data = _gzip_bytes(events)

    monkeypatch.setattr(
        "scaper.feed.load.fetch_feed_index",
        lambda *a, **k: {
            "uri": "https://x/feed.gz",
            "compressed_md5_checksum": "0" * 32,
            "last_updated": "2026-10-28T12:00:00Z",
        },
    )
    monkeypatch.setattr(
        "scaper.feed.load._stream_download",
        lambda *_: (data[i : i + 4096] for i in range(0, len(data), 4096)),
    )
    report = load_ticketmaster_feed(
        store.engine, store, source=source, api_key="k", country="US", dry_run=False, force=True
    )
    assert report.status == "failed"
    assert conn.execute(text("SELECT count(*) FROM public.events")).scalar() == 0


def test_second_identical_load_updates_zero(pg_feed, monkeypatch) -> None:
    store, conn, source, _ = pg_feed
    ev = [_event("same-1")]
    _mock_feed(monkeypatch, ev)
    r1 = load_ticketmaster_feed(
        store.engine, store, source=source, api_key="k", country="US", dry_run=False, force=True
    )
    assert r1.inserted == 1
    _mock_feed(monkeypatch, ev)
    r2 = load_ticketmaster_feed(
        store.engine, store, source=source, api_key="k", country="US", dry_run=False, force=True
    )
    assert (r2.inserted, r2.updated) == (0, 0)


def test_expiry_guard_leaves_rows(pg_feed) -> None:
    store, conn, source, _ = pg_feed
    conn.execute(
        text(
            """
            INSERT INTO public.events (
              id, provider, external_id, title, start_time, country_code, source_id,
              fetched_at, expires_at, first_seen_at, last_seen_at, updated_at, status
            ) VALUES (
              gen_random_uuid(), 'ticketmaster', 'old-us', 'Old', now() + interval '10 days', 'US', :sid,
              now(), now() + interval '10 days', now(), now() - interval '1 hour', now(), 'scheduled'
            )
            """
        ),
        {"sid": source.id},
    )
    truncate_staging(conn)
    write_feed_state(
        conn,
        provider="ticketmaster_feed",
        country="US",
        last_md5="a",
        last_updated=datetime.now(timezone.utc),
        num_events=100,
        status="succeeded",
    )
    insert_staging_batch(
        conn,
        [
            {
                "event_id": "new-only",
                "legacy_id": None,
                "title": "New",
                "description": None,
                "category": "music",
                "start_time": datetime.now(timezone.utc) + timedelta(days=5),
                "end_time": None,
                "timezone": "America/New_York",
                "status": "scheduled",
                "url": "https://www.ticketmaster.com/event/new-only",
                "image_url": None,
                "venue_id": "v-new",
                "venue_name": "Hall",
                "venue_street": None,
                "venue_city": "Orlando",
                "venue_state": "FL",
                "venue_zip": None,
                "country_code": "US",
                "lat": 28.5,
                "lng": -81.3,
                "city_slug": "orlando",
            }
        ],
    )
    expired, guard = expire_unseen_for_country(
        conn,
        country_code="US",
        run_started=datetime.now(timezone.utc),
        staged_count=1,
        previous_count=100,
    )
    assert guard is True and expired == 0
    still = conn.execute(
        text("SELECT expires_at > now() FROM public.events WHERE external_id = 'old-us'")
    ).scalar()
    assert still is True


def test_country_scoped_expiry(pg_feed) -> None:
    store, conn, source, _ = pg_feed
    conn.execute(
        text(
            """
            INSERT INTO public.events (
              id, provider, external_id, title, start_time, country_code, source_id,
              fetched_at, expires_at, first_seen_at, last_seen_at, updated_at, status
            ) VALUES
              (gen_random_uuid(), 'ticketmaster', 'us-only', 'US', now() + interval '5 days', 'US', :sid,
               now(), now() + interval '5 days', now(), now() - interval '3 hours', now(), 'scheduled'),
              (gen_random_uuid(), 'ticketmaster', 'gb-only', 'GB', now() + interval '5 days', 'GB', :sid,
               now(), now() + interval '5 days', now(), now() - interval '3 hours', now(), 'scheduled')
            """
        ),
        {"sid": source.id},
    )
    truncate_staging(conn)
    insert_staging_batch(
        conn,
        [
            {
                "event_id": "gb-new",
                "legacy_id": None,
                "title": "GB new",
                "description": None,
                "category": "music",
                "start_time": datetime.now(timezone.utc) + timedelta(days=5),
                "end_time": None,
                "timezone": "Europe/London",
                "status": "scheduled",
                "url": "https://www.ticketmaster.com/event/gb-new",
                "image_url": None,
                "venue_id": "v-gb",
                "venue_name": "GB Hall",
                "venue_street": None,
                "venue_city": "London",
                "venue_state": None,
                "venue_zip": None,
                "country_code": "GB",
                "lat": 51.5,
                "lng": -0.12,
                "city_slug": "london",
            }
        ],
    )
    run_started = datetime.now(timezone.utc)
    expired, _ = expire_unseen_for_country(
        conn, country_code="GB", run_started=run_started, staged_count=50, previous_count=10
    )
    assert expired == 1
    us_alive = conn.execute(
        text("SELECT expires_at > now() FROM public.events WHERE external_id = 'us-only'")
    ).scalar()
    assert us_alive is True


def test_blocklisted_event_skipped(pg_feed, monkeypatch) -> None:
    store, conn, source, _ = pg_feed
    conn.execute(
        text(
            "INSERT INTO ingest.blocklist (provider, external_id) VALUES ('ticketmaster', 'blocked-1')"
        )
    )
    _mock_feed(monkeypatch, [_event("blocked-1"), _event("ok-1")])
    report = load_ticketmaster_feed(
        store.engine, store, source=source, api_key="k", country="US", dry_run=False, force=True
    )
    assert report.rejections["blocklisted"] == 1
    ids = conn.execute(text("SELECT external_id FROM public.events ORDER BY external_id")).scalars().all()
    assert ids == ["ok-1"]


def test_feed_fresh_unchanged_skips_discovery(pg_feed) -> None:
    store, conn, source, tx_engine = pg_feed
    write_feed_state(
        conn,
        provider="ticketmaster_feed",
        country="US",
        last_md5="abc",
        last_updated=datetime.now(timezone.utc),
        num_events=10,
        status="unchanged",
    )
    assert feed_fresh_within_hours(tx_engine, "US", hours=26.0) is True
    tm_city = Source(
        id=uuid.uuid4(), connector="ticketmaster", name="tm:orlando", city_slug="orlando", config={"lat": 1, "lng": 2}
    )
    tm_state = Source(
        id=uuid.uuid4(), connector="ticketmaster", name="tm:il", state_code="IL", config={"state_code": "IL"}
    )
    plan = plan_connector_sources(
        [tm_state, tm_city], connector="ticketmaster", store=store, engine=tx_engine, budget=4000
    )
    assert plan.to_run == []
    assert all("feed fresh" in why for _, why in plan.skipped)


def test_allocator_priority_and_budget(pg_feed) -> None:
    store, conn, _, tx_engine = pg_feed
    city = Source(
        id=uuid.uuid4(), connector="ticketmaster", name="tm:city", city_slug="orlando", config={"lat": 1, "lng": 2}
    )
    state = Source(
        id=uuid.uuid4(), connector="ticketmaster", name="tm:state", state_code="IL", config={"state_code": "IL"}
    )
    country = Source(
        id=uuid.uuid4(), connector="ticketmaster", name="tm:gb", config={"country_code": "GB"}
    )
    plan = plan_connector_sources(
        [country, state, city], connector="ticketmaster", store=store, engine=tx_engine, budget=4000
    )
    assert [s.name for s in plan.to_run] == ["tm:city", "tm:state", "tm:gb"]

    class _BudgetStore:
        def api_calls_last_24h(self, connector: str) -> int:
            return 4000

    broke = plan_connector_sources([city], connector="ticketmaster", store=_BudgetStore(), engine=tx_engine, budget=4000)
    assert broke.to_run == [] and broke.skipped[0][1] == "daily budget exhausted"

    spare = plan_spare_budget_sources(
        [Source(id=uuid.uuid4(), connector="ticketmaster", name="tm:r", config={"state_code": "NY", "days_ahead": 3, "ramp": [3, 14, 60]})],
        connector="ticketmaster",
        store=store,
        budget=4000,
    )
    assert len(spare) == 1
