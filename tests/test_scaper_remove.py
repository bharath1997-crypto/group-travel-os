"""Scaper owner removal + ingest blocklist (spec item 9)."""
from __future__ import annotations

import uuid

from scaper.pipeline import run_source
from tests.scaper_fixtures import eventbrite_event
from tests.test_scaper_pipeline import ListConnector, MemoryStore, _source


def test_remove_deletes_event_and_raw_then_blocks_reingest() -> None:
    source = _source()
    store = MemoryStore([source])
    run_source(store, ListConnector([eventbrite_event(id="rm-1")]), source)
    assert ("eventbrite", "rm-1") in store.events
    assert ("eventbrite", "rm-1") in store.raw

    result = store.remove_provider_event("eventbrite", "rm-1", reason="owner request")
    assert result["events_deleted"] == 1
    assert result["blocked"] is True
    assert ("eventbrite", "rm-1") not in store.events
    assert ("eventbrite", "rm-1") not in store.raw
    assert store.is_provider_blocked("eventbrite", "rm-1")

    report = run_source(store, ListConnector([eventbrite_event(id="rm-1")]), source)
    assert report.stats.fetched == 1
    assert report.stats.inserted == 0
    assert report.stats.unchanged == 0
    assert ("eventbrite", "rm-1") not in store.events
    assert ("eventbrite", "rm-1") not in store.raw


def test_run_source_queries_blocked_ids_once_per_run() -> None:
    source = _source()
    store = MemoryStore([source])
    store.blocklist.add(("eventbrite", "blocked-a"))
    calls = 0
    real_blocked_ids = store.blocked_ids

    def counting_blocked_ids(provider: str) -> set[str]:
        nonlocal calls
        calls += 1
        return real_blocked_ids(provider)

    store.blocked_ids = counting_blocked_ids  # type: ignore[method-assign]

    report = run_source(
        store,
        ListConnector([eventbrite_event(id="blocked-a"), eventbrite_event(id="ok-1")]),
        source,
    )
    assert calls == 1
    assert report.stats.fetched == 2
    assert report.stats.inserted == 1
    assert ("eventbrite", "ok-1") in store.events
    assert ("eventbrite", "blocked-a") not in store.events


def test_blocklist_without_prior_event_still_skips_ingest() -> None:
    source = _source()
    store = MemoryStore([source])
    store.blocklist.add(("eventbrite", "never-seen"))
    report = run_source(store, ListConnector([eventbrite_event(id="never-seen")]), source)
    assert report.stats.fetched == 1
    assert not store.events
    assert not store.raw
