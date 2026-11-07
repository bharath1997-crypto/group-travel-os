"""run_source must extract while it fetches so a big country cannot exhaust memory.

France and the UK (60-day windows, tens of thousands of ~9 KB payloads) were OOM-killed at
512 MiB because every payload was held until the fetch finished.
"""
from __future__ import annotations

from typing import Any

from scaper import pipeline
from scaper.pipeline import run_source
from tests.scaper_fixtures import eventbrite_event
from tests.test_scaper_pipeline import ListConnector, MemoryStore, _source


class _Watching(ListConnector):
    """Records how many extractions had already happened when each item was fetched."""

    def __init__(self, payloads: list[dict[str, Any]]) -> None:
        super().__init__(payloads)
        self.extracted = 0
        self.extracted_at_fetch: list[int] = []

    def fetch(self, config):
        for item in super().fetch(config):
            self.extracted_at_fetch.append(self.extracted)
            yield item

    def extract(self, payload):
        self.extracted += 1
        return super().extract(payload)


def test_events_are_extracted_during_the_fetch_not_after() -> None:
    n = pipeline.EXTRACT_CHUNK_SIZE * 3 + 7
    source = _source()
    store = MemoryStore([source])
    connector = _Watching([eventbrite_event(id=str(i)) for i in range(n)])

    report = run_source(store, connector, source)

    assert report.status == "succeeded"
    assert report.stats.fetched == n and report.stats.inserted == n
    assert connector.extracted == n
    # Before the last item is fetched, earlier chunks were already extracted (and released).
    assert connector.extracted_at_fetch[-1] >= pipeline.EXTRACT_CHUNK_SIZE * 3
    # Nothing was extracted before the first chunk filled.
    assert connector.extracted_at_fetch[pipeline.EXTRACT_CHUNK_SIZE - 1] == 0


def test_fetch_error_still_extracts_what_was_fetched() -> None:
    source = _source()
    store = MemoryStore([source])
    connector = ListConnector([eventbrite_event(id=str(i)) for i in range(10)], fail_after=6)

    report = run_source(store, connector, source)

    assert report.status == "failed"
    assert report.stats.inserted == 6
