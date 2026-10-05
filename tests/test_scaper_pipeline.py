"""Scaper pipeline semantics against an in-memory Store (no Postgres needed)."""
from __future__ import annotations

import uuid
from collections.abc import Iterator
from datetime import datetime, timezone
from typing import Any, ClassVar, Literal

import pytest
from pydantic import BaseModel

from scaper.connectors.base import Connector
from scaper.connectors.eventbrite import EventbriteConnector
from scaper.http import ConnectorError
from scaper.models import EventRecord, ExtractResult, RawItem, RunStats, RunStatus, Source, VenueRecord
from dataclasses import dataclass

from scaper.pipeline import run_due, run_source
from scaper.store import RunHandle, RunInProgress
from tests.scaper_fixtures import eventbrite_event


@dataclass
class _MemoryRow:
    raw_id: int
    event: EventRecord
    place_id: uuid.UUID | None
    city_slug: str | None
    state_code: str | None = None


class MemoryStore:
    def __init__(self, sources: list[Source] | None = None) -> None:
        self.sources = {s.name: s for s in sources or []}
        self.runs: dict[uuid.UUID, dict[str, Any]] = {}
        self.raw: dict[tuple[str, str], dict[str, Any]] = {}
        self.events: dict[tuple[str, str], dict[str, Any]] = {}
        self.links: dict[tuple[str, str], uuid.UUID] = {}
        self.clock = 0
        self.deduped_cities: list[str] = []

    def _tick(self) -> int:
        self.clock += 1
        return self.clock

    def get_source(self, name: str) -> Source | None:
        return self.sources.get(name)

    def due_sources(self) -> list[Source]:
        return [s for s in self.sources.values() if s.enabled]

    def start_run(self, source: Source) -> RunHandle:
        if any(r["source"] == source.id and r["status"] == "running" for r in self.runs.values()):
            raise RunInProgress(source.name)
        run = RunHandle(id=uuid.uuid4(), started_at=datetime.now(timezone.utc))
        self.runs[run.id] = {"source": source.id, "status": "running", "t": self._tick()}
        return run

    def finish_run(self, run: RunHandle, status: RunStatus, stats: RunStats, error: str | None) -> None:
        self.runs[run.id].update(status=status, stats=stats, error=error)

    def upsert_raw(self, source: Source, run: RunHandle, connector: str, item: RawItem) -> tuple[int, bool]:
        key = (connector, item.external_id)
        row = self.raw.get(key)
        if row is None:
            row = self.raw[key] = {"id": len(self.raw) + 1, "sha": item.sha256, "status": "pending"}
        elif row["sha"] != item.sha256 or row["status"] in ("pending", "failed"):
            row.update(sha=item.sha256, status="pending")
        return row["id"], row["status"] == "pending"

    def mark_raw(self, raw_id: int, status: Literal["extracted", "rejected", "failed"], error: str | None = None) -> None:
        for row in self.raw.values():
            if row["id"] == raw_id:
                row.update(status=status, error=error)

    def touch_event(self, connector: str, external_id: str) -> None:
        if (connector, external_id) in self.events:
            self.events[(connector, external_id)].update(seen=self._tick(), expired=False)

    def resolve_place(self, connector: str, venue: VenueRecord, city_slug: str | None) -> uuid.UUID:
        return self.links.setdefault((connector, venue.external_id), uuid.uuid4())

    def upsert_event(
        self, connector: str, source: Source, raw_id: int, event: EventRecord, place_id: uuid.UUID | None
    ) -> Literal["inserted", "updated"]:
        ins, upd = self.persist_extractions(
            connector,
            source,
            [_MemoryRow(raw_id, event, place_id, source.city_slug, None)],
        )
        return "inserted" if ins else "updated"

    def persist_extractions(self, connector: str, source: Source, rows: list) -> tuple[int, int]:
        inserted = updated = 0
        for row in rows:
            key = (connector, row.event.external_id)
            existed = key in self.events
            self.events[key] = {
                "event": row.event,
                "place_id": row.place_id,
                "source": source.id,
                "city_slug": row.city_slug,
                "seen": self._tick(),
                "expired": False,
            }
            if existed:
                updated += 1
            else:
                inserted += 1
            for raw in self.raw.values():
                if raw["id"] == row.raw_id:
                    raw["status"] = "extracted"
        return inserted, updated

    def disable_ticketmaster_city_sources_for_state(self, state_code: str) -> int:
        return 0

    def dedupe_city(self, city_slug: str) -> int:
        self.deduped_cities.append(city_slug)
        return 0

    def purge_past_events(self, source_id: uuid.UUID) -> int:
        now = datetime.now(timezone.utc)
        past = [
            k for k, e in self.events.items()
            if e["source"] == source_id and (e["event"].ends_at or e["event"].starts_at) < now
        ]
        for k in past:
            del self.events[k]
        return len(past)

    def expire_unseen(self, source: Source, run: RunHandle) -> int:
        started = self.runs[run.id]["t"]
        stale = [e for e in self.events.values() if e["source"] == source.id and e["seen"] < started and not e["expired"]]
        for e in stale:
            e["expired"] = True
        return len(stale)


class ListConnector(Connector):
    """Serves canned Eventbrite payloads; optionally fails mid-fetch."""

    name: ClassVar[str] = "eventbrite"
    config_model: ClassVar[type[BaseModel]] = EventbriteConnector.config_model

    def __init__(self, payloads: list[dict[str, Any]], *, fail_after: int | None = None, complete: bool = True):
        self.payloads = payloads
        self.fail_after = fail_after
        self.complete = complete
        self._real = EventbriteConnector(token="unused")

    def fetch(self, config: dict[str, Any]) -> Iterator[RawItem]:
        self.last_fetch_complete = False
        for n, payload in enumerate(self.payloads):
            if self.fail_after is not None and n == self.fail_after:
                raise ConnectorError("HTTP 503 after retries")
            yield RawItem(external_id=str(payload["id"]), payload=payload)
        self.last_fetch_complete = self.complete

    def extract(self, payload: dict[str, Any]) -> ExtractResult:
        if payload.get("explode"):
            raise RuntimeError("mapping bug")
        return self._real.extract(payload)


def _source(**overrides: Any) -> Source:
    fields: dict[str, Any] = {
        "id": uuid.uuid4(),
        "connector": "eventbrite",
        "name": "eventbrite:org:5550001",
        "config": {"kind": "organizer", "id": "5550001"},
        "city_slug": "chicago",
    }
    return Source(**(fields | overrides))


def test_first_run_inserts_and_links_venue() -> None:
    source = _source()
    store = MemoryStore([source])
    report = run_source(store, ListConnector([eventbrite_event(id="1"), eventbrite_event(id="2")]), source)

    assert report.status == "succeeded"
    assert report.stats.model_dump() == {
        "fetched": 2, "unchanged": 0, "inserted": 2, "updated": 0, "rejected": 0, "failed": 0, "purged": 0, "deduped": 0,
    }
    place_ids = {e["place_id"] for e in store.events.values()}
    assert place_ids == {store.links[("eventbrite", "7770001")]}


def test_unchanged_payload_skips_extraction_changed_payload_updates() -> None:
    source = _source()
    store = MemoryStore([source])
    run_source(store, ListConnector([eventbrite_event(id="1"), eventbrite_event(id="2")]), source)

    changed = eventbrite_event(id="2", status="canceled")
    report = run_source(store, ListConnector([eventbrite_event(id="1"), changed]), source)

    assert (report.stats.unchanged, report.stats.updated, report.stats.inserted) == (1, 1, 0)
    assert store.events[("eventbrite", "2")]["event"].status == "cancelled"


def test_rejected_payloads_are_counted_not_failed() -> None:
    source = _source()
    store = MemoryStore([source])
    report = run_source(store, ListConnector([eventbrite_event(id="1", online_event=True)]), source)

    assert report.status == "succeeded"
    assert report.stats.rejected == 1
    assert store.raw[("eventbrite", "1")]["status"] == "rejected"
    assert not store.events


def test_extract_error_marks_run_partial_and_retries_next_run() -> None:
    source = _source()
    store = MemoryStore([source])
    bad = eventbrite_event(id="2", explode=True)
    report = run_source(store, ListConnector([eventbrite_event(id="1"), bad]), source)

    assert report.status == "partial"
    assert report.stats.failed == 1 and report.stats.inserted == 1
    assert store.raw[("eventbrite", "2")]["status"] == "failed"

    fixed = eventbrite_event(id="2", explode=True)
    fixed.pop("explode")  # same id, payload now extractable
    report = run_source(store, ListConnector([eventbrite_event(id="1"), fixed]), source)
    assert report.status == "succeeded"
    assert report.stats.inserted == 1


def test_failed_raw_record_is_retried_even_if_payload_unchanged() -> None:
    source = _source()
    store = MemoryStore([source])
    store.raw[("eventbrite", "1")] = {"id": 1, "sha": RawItem(external_id="1", payload=eventbrite_event(id="1")).sha256, "status": "failed"}
    report = run_source(store, ListConnector([eventbrite_event(id="1")]), source)
    assert report.stats.inserted == 1 and report.stats.unchanged == 0


def test_fetch_failure_keeps_fetched_rows_and_skips_expiry() -> None:
    source = _source()
    store = MemoryStore([source])
    run_source(store, ListConnector([eventbrite_event(id=str(i)) for i in range(3)]), source)

    payloads = [eventbrite_event(id="0", summary="new"), eventbrite_event(id="1")]
    report = run_source(store, ListConnector(payloads, fail_after=1), source)

    assert report.status == "failed"
    assert "HTTP 503" in (report.error_summary or "")
    assert report.stats.updated == 1
    assert not any(e["expired"] for e in store.events.values())


def test_complete_fetch_expires_vanished_events_and_reappearance_restores() -> None:
    source = _source()
    store = MemoryStore([source])
    run_source(store, ListConnector([eventbrite_event(id="1"), eventbrite_event(id="2")]), source)

    run_source(store, ListConnector([eventbrite_event(id="1")]), source)
    assert store.events[("eventbrite", "2")]["expired"] is True
    assert store.events[("eventbrite", "1")]["expired"] is False

    run_source(store, ListConnector([eventbrite_event(id="1"), eventbrite_event(id="2")]), source)
    assert store.events[("eventbrite", "2")]["expired"] is False


def test_truncated_fetch_does_not_expire() -> None:
    source = _source()
    store = MemoryStore([source])
    run_source(store, ListConnector([eventbrite_event(id="1"), eventbrite_event(id="2")]), source)
    run_source(store, ListConnector([eventbrite_event(id="1")], complete=False), source)
    assert store.events[("eventbrite", "2")]["expired"] is False


def test_invalid_source_config_fails_before_run_starts() -> None:
    source = _source(config={"kind": "search", "id": "chicago"})
    store = MemoryStore([source])
    with pytest.raises(Exception):
        run_source(store, ListConnector([]), source)
    assert not store.runs


def test_run_due_skips_source_already_running() -> None:
    busy, idle = _source(name="busy"), _source(name="idle")
    store = MemoryStore([busy, idle])
    store.start_run(busy)
    reports = run_due(store, lambda name: ListConnector([eventbrite_event(id="1")]))
    assert [r.source for r in reports] == ["idle"]


def test_run_due_can_refresh_only_orlando() -> None:
    orlando = _source(name="orlando").model_copy(update={"city_slug": "orlando"})
    chicago = _source(name="chicago").model_copy(update={"city_slug": "chicago"})
    store = MemoryStore([orlando, chicago])
    reports = run_due(
        store, lambda name: ListConnector([eventbrite_event(id="1")]), city_slug="orlando"
    )
    assert [r.source for r in reports] == ["orlando"]
    assert len(store.runs) == 1


PAST = {"utc": "2020-01-01T00:00:00Z", "timezone": "UTC"}


def test_purge_runs_after_successful_fetch_and_is_counted() -> None:
    source = _source()
    store = MemoryStore([source])
    report = run_source(store, ListConnector([eventbrite_event(id="old", start=PAST, end=PAST), eventbrite_event(id="new")]), source)
    assert report.stats.inserted == 2
    assert report.stats.purged == 1
    assert list(store.events) == [("eventbrite", "new")]
    assert store.runs[report.run_id]["stats"].purged == 1


def test_state_run_dedupes_each_touched_city() -> None:
    source = _source(
        connector="ticketmaster",
        name="ticketmaster:state:tx",
        config={"state_code": "TX", "days_ahead": 60},
        city_slug=None,
    )
    source = source.model_copy(update={"state_code": "TX"})
    store = MemoryStore([source])

    class TmConnector(ListConnector):
        name = "ticketmaster"

        def __init__(self) -> None:
            from scaper.connectors.ticketmaster import TicketmasterStateConfig

            super().__init__([])
            self.config_model = TicketmasterStateConfig

        def fetch(self, config: dict[str, Any]) -> Iterator[RawItem]:
            from tests.scaper_fixtures import ticketmaster_event

            for city, eid in (("Austin", "a1"), ("Dallas", "d1")):
                payload = ticketmaster_event(id=eid)
                payload["_embedded"]["venues"][0]["city"]["name"] = city
                yield RawItem(external_id=eid, payload=payload)
            self.last_fetch_complete = True

        def extract(self, payload: dict[str, Any]) -> ExtractResult:
            from scaper.connectors.ticketmaster import TicketmasterConnector
            from scaper.http import RetryingClient
            import httpx

            tm = TicketmasterConnector(
                api_key="k",
                client=RetryingClient(httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(500)))),
            )
            return tm.extract(payload)

    run_source(store, TmConnector(), source)
    assert sorted(store.deduped_cities) == ["austin", "dallas"]


def test_purge_skipped_when_fetch_fails() -> None:
    source = _source()
    store = MemoryStore([source])
    report = run_source(
        store,
        ListConnector([eventbrite_event(id="old", start=PAST, end=PAST), eventbrite_event(id="x")], fail_after=1),
        source,
    )
    assert report.status == "failed"
    assert report.stats.purged == 0
    assert ("eventbrite", "old") in store.events
