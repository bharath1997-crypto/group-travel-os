"""Orphan ingest.raw_records purge (rejected / no events row)."""
from __future__ import annotations

from datetime import datetime, timezone

import pytest

from scaper.pipeline import run_source
from scaper.raw_purge import raw_payload_past
from tests.scaper_fixtures import eventbrite_event
from tests.test_scaper_pipeline import ListConnector, MemoryStore, _source

PAST = {"utc": "2020-01-01T00:00:00Z", "timezone": "UTC"}
FUTURE = {"utc": "2099-06-01T00:00:00Z", "timezone": "UTC"}


def test_raw_payload_past_eventbrite_end_and_start_fallback() -> None:
    now = datetime(2021, 1, 1, tzinfo=timezone.utc)
    assert raw_payload_past("eventbrite", eventbrite_event(start=PAST, end=PAST), now=now)
    assert raw_payload_past(
        "eventbrite",
        eventbrite_event(start=PAST, end={"utc": None, "timezone": "UTC"}),
        now=now,
    )
    assert not raw_payload_past("eventbrite", eventbrite_event(start=FUTURE, end=FUTURE), now=now)


def test_memory_store_purge_drops_orphan_rejected_raw() -> None:
    source = _source()
    store = MemoryStore([source])
    key = ("eventbrite", "online-1")
    store.raw[key] = {
        "id": 1,
        "sha": "dead",
        "status": "rejected",
        "payload": eventbrite_event(id="online-1", online_event=True, start=PAST, end=PAST),
        "source_id": source.id,
    }
    assert store.purge_past_events(source) == 1
    assert key not in store.raw
