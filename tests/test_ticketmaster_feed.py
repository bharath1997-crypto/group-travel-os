"""Ticketmaster bulk feed: stream parser, mapping, allocator (mocked HTTP)."""
from __future__ import annotations

import gzip
import json
import uuid
from datetime import datetime, timezone

import pytest

from scaper.allocator import plan_connector_sources, plan_spare_budget_sources
from scaper.feed.stream import FeedMd5Mismatch, collect_with_md5, iter_events_from_bytes
from scaper.feed.ticketmaster_map import map_feed_event
from scaper.models import Source
from tests.test_scaper_pipeline import MemoryStore


def _gzip_feed(events: list[dict]) -> bytes:
    payload = json.dumps({"events": events}).encode("utf-8")
    return gzip.compress(payload)


def test_stream_across_chunk_boundaries() -> None:
    events = [{"eventId": "a", "eventName": "A", "eventStatus": "onsale", "eventStartDateTime": "2026-11-01T12:00:00Z", "venue": {"venueName": "V", "venueLatitude": "28.5", "venueLongitude": "-81.3", "venueCountryCode": "US"}}]
    data = _gzip_feed(events)
    parsed = iter_events_from_bytes(data, chunk=7)
    assert len(parsed) == 1


def test_md5_mismatch_aborts() -> None:
    data = _gzip_feed([])
    with pytest.raises(FeedMd5Mismatch):
        collect_with_md5((data[i : i + 10] for i in range(0, len(data), 10)), expected_md5_hex="deadbeef")


def test_map_rejects_missing_start() -> None:
    row, reason = map_feed_event({"eventId": "1", "eventName": "X", "eventStatus": "onsale", "venue": {}}, fallback_country="US")
    assert row is None and reason == "missing start time"


def test_allocator_skips_ticketmaster_when_feed_fresh(monkeypatch) -> None:
    store = MemoryStore([])
    tm = Source(id=uuid.uuid4(), connector="ticketmaster", name="tm:il", config={"state_code": "IL"})
    monkeypatch.setattr("scaper.allocator.feed_fresh_within_hours", lambda *a, **k: True)
    plan = plan_connector_sources([tm], connector="ticketmaster", store=store, engine=object(), budget=4000)
    assert plan.to_run == []
    assert plan.skipped[0][1].startswith("feed fresh")

