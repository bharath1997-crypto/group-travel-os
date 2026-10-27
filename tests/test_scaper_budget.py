"""Daily API budget, 3 -> 14 -> 60 day ramp and throttle stop in run_due (in-memory store)."""
from __future__ import annotations

import uuid
from typing import ClassVar

import pytest
from pydantic import BaseModel, ValidationError

from scaper import pipeline
from scaper.connectors.base import Connector
from scaper.connectors.ticketmaster import TicketmasterConnector
from scaper.models import RunReport, RunStats, Source
from tests.test_scaper_pipeline import MemoryStore


def _source(name: str, connector: str = "ticketmaster", **config) -> Source:
    return Source(id=uuid.uuid4(), connector=connector, name=name, config=config or {"state_code": "NY"})


class _Store(MemoryStore):
    def __init__(self, sources, used: int = 0) -> None:
        super().__init__(sources)
        self.used = used
        self.recorded: list[int] = []
        self.days: dict[uuid.UUID, int] = {}

    def api_calls_last_24h(self, connector: str) -> int:
        return self.used

    def record_api_calls(self, run, calls: int) -> None:
        self.recorded.append(calls)
        self.used += calls

    def set_days_ahead(self, source_id, days: int) -> None:
        self.days[source_id] = days


class _AnyConfig(BaseModel):
    model_config = {"extra": "allow"}


class _Fake(Connector):
    name: ClassVar[str] = "ticketmaster"
    config_model: ClassVar[type[BaseModel]] = _AnyConfig

    def __init__(self, calls: int = 10) -> None:
        self.api_calls_used = calls
        self.last_fetch_complete = True

    def fetch(self, config):
        return iter(())

    def extract(self, payload):  # pragma: no cover - never called, fetch is empty
        raise AssertionError


def _run(store, budgets=None, calls: int = 10, runner=None):
    ran: list[str] = []

    def fake_run_source(s, connector, source):
        ran.append(source.name)
        if runner:
            return runner(source)
        stats = RunStats(api_calls=calls)
        return RunReport(run_id=uuid.uuid4(), source=source.name, status="succeeded", stats=stats)

    original = pipeline.run_source
    pipeline.run_source = fake_run_source
    try:
        pipeline.run_due(store, lambda name: _Fake(calls), daily_call_budgets=budgets)
    finally:
        pipeline.run_source = original
    return ran


def test_budget_reached_skips_ticketmaster_but_not_other_connectors() -> None:
    store = _Store([_source("tm:a"), _source("tm:b"), _source("eb:1", connector="eventbrite", kind="organizer", id="1")], used=4000)
    assert _run(store, {"ticketmaster": 4000}) == ["eb:1"]


def test_sources_still_run_while_under_budget() -> None:
    store = _Store([_source("tm:a"), _source("tm:b"), _source("tm:c")], used=3990)
    # first run (10 calls recorded by the real pipeline) is simulated: used stays below budget until 4000
    ran = _run(store, {"ticketmaster": 4000})
    assert ran == ["tm:a", "tm:b", "tm:c"]  # fake runs do not record calls, so the budget is not exhausted


def test_no_budget_configured_means_no_limit() -> None:
    store = _Store([_source("tm:a")], used=999999)
    assert _run(store, None) == ["tm:a"]


def test_throttle_or_block_stops_the_rest_of_that_connector() -> None:
    store = _Store([_source("tm:a"), _source("tm:b"), _source("eb:1", connector="eventbrite", kind="organizer", id="1")])

    def refuse(source):
        status = "failed" if source.name == "tm:a" else "succeeded"
        err = "fetch: GET https://x: HTTP 429 slow down" if status == "failed" else None
        return RunReport(run_id=uuid.uuid4(), source=source.name, status=status, stats=RunStats(), error_summary=err)

    assert _run(store, {"ticketmaster": 4000}, runner=refuse) == ["tm:a", "eb:1"]


def test_ordinary_failure_does_not_stop_other_sources() -> None:
    store = _Store([_source("tm:a"), _source("tm:b")])

    def bad_extract(source):
        status = "failed" if source.name == "tm:a" else "succeeded"
        return RunReport(run_id=uuid.uuid4(), source=source.name, status=status, stats=RunStats(), error_summary="fetch: boom" if status == "failed" else None)

    assert _run(store, {"ticketmaster": 4000}, runner=bad_extract) == ["tm:a", "tm:b"]


def test_ramp_widens_after_a_clean_run_and_stops_at_the_top() -> None:
    a = _source("tm:a", state_code="NY", days_ahead=3, ramp=[3, 14, 60])
    b = _source("tm:b", state_code="NY", days_ahead=14, ramp=[3, 14, 60])
    c = _source("tm:c", state_code="NY", days_ahead=60, ramp=[3, 14, 60])
    d = _source("tm:d", state_code="NY", days_ahead=3)  # no ramp configured
    store = _Store([a, b, c, d])
    _run(store, {"ticketmaster": 4000})
    assert store.days == {a.id: 14, b.id: 60}


def test_ramp_does_not_advance_after_a_failed_run() -> None:
    a = _source("tm:a", state_code="NY", days_ahead=3, ramp=[3, 14, 60])
    store = _Store([a])

    def fail(source):
        return RunReport(run_id=uuid.uuid4(), source=source.name, status="failed", stats=RunStats(), error_summary="fetch: boom")

    _run(store, {"ticketmaster": 4000}, runner=fail)
    assert store.days == {}


def test_real_run_source_records_the_calls_the_connector_used() -> None:
    store = _Store([_source("tm:a")])
    pipeline.run_source(store, _Fake(calls=37), store.sources["tm:a"])
    assert store.recorded == [37]


def test_ramp_config_validation() -> None:
    connector = TicketmasterConnector(api_key="k")
    assert connector.parse_config({"state_code": "NY", "days_ahead": 3, "ramp": [3, 14, 60]}).ramp == [3, 14, 60]
    assert connector.parse_config({"country_code": "GB", "ramp": [3, 14]}).ramp == [3, 14]
    for bad in ([], [14, 3], [3, 3], [0, 5], [3, 61]):
        with pytest.raises(ValidationError):
            connector.parse_config({"state_code": "NY", "ramp": bad})
