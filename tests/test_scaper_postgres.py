"""
PostgresStore + migrations/008 against real Postgres/PostGIS.

Opt-in: set SCAPER_PG_TEST_URL. Everything — including the migration DDL —
runs inside one transaction that is rolled back, so nothing persists.

  SCAPER_PG_TEST_URL=postgresql://... pytest tests/test_scaper_postgres.py -v
"""
from __future__ import annotations

import os
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import Connection, create_engine, text

from scaper.models import Source
from scaper.pipeline import run_source
from scaper.store import PostgresStore, RunInProgress
from tests.scaper_fixtures import eventbrite_event
from tests.test_scaper_pipeline import ListConnector

pytestmark = pytest.mark.scaper_postgres

MIGRATION = Path(__file__).resolve().parents[1] / "migrations" / "008_scaper_ingest.sql"
# Open ocean, so no Overture place can match by accident.
OCEAN = {"lat": "0.5000", "lng": "-150.5000"}


class _TxEngine:
    """Engine stand-in: every store transaction becomes a savepoint on one outer transaction."""

    def __init__(self, conn: Connection) -> None:
        self.conn = conn

    @contextmanager
    def begin(self) -> Iterator[Connection]:
        with self.conn.begin_nested():
            yield self.conn

    @contextmanager
    def connect(self) -> Iterator[Connection]:
        yield self.conn


@pytest.fixture()
def pg() -> Iterator[tuple[PostgresStore, Connection]]:
    url = os.getenv("SCAPER_PG_TEST_URL")
    if not url:
        pytest.skip("set SCAPER_PG_TEST_URL to run Scaper Postgres tests")
    engine = create_engine(url)
    conn = engine.connect()
    outer = conn.begin()
    try:
        conn.exec_driver_sql("SET LOCAL lock_timeout = '5s'")
        sql = MIGRATION.read_text(encoding="utf-8")
        conn.exec_driver_sql(sql)
        conn.exec_driver_sql(sql)  # idempotent
        yield PostgresStore(_TxEngine(conn)), conn  # type: ignore[arg-type]
    finally:
        outer.rollback()
        conn.close()
        engine.dispose()


def _ocean_event(event_id: str, **overrides: Any) -> dict[str, Any]:
    venue = eventbrite_event()["venue"] | {"id": "scaper-it-venue", "name": "Scaper IT Hall", "latitude": OCEAN["lat"], "longitude": OCEAN["lng"]}
    return eventbrite_event(id=event_id, venue=venue, **overrides)


def _add_source(store: PostgresStore) -> Source:
    return store.add_source(
        connector="eventbrite",
        name=f"scaper-it-{uuid.uuid4().hex[:8]}",
        config={"kind": "organizer", "id": "5550001"},
        city_slug="scaper-it",
    )


def test_run_writes_events_places_and_links(pg) -> None:
    store, conn = pg
    source = _add_source(store)
    report = run_source(store, ListConnector([_ocean_event("it-1"), _ocean_event("it-2")]), source)

    assert report.status == "succeeded", report.error_summary
    assert (report.stats.inserted, report.stats.failed) == (2, 0)

    link = conn.execute(
        text("SELECT place_id, method FROM ingest.place_links WHERE connector='eventbrite' AND external_id='scaper-it-venue'")
    ).one()
    assert link.method == "created"
    place = conn.execute(text("SELECT gers_id, name, address->>'locality' AS city FROM places WHERE id = :id"), {"id": link.place_id}).one()
    assert (place.gers_id, place.name, place.city) == (None, "Scaper IT Hall", "Chicago")

    rows = conn.execute(
        text("SELECT external_id, venue_place_id, status, city_slug, ST_Y(geom) AS lat FROM events WHERE source_id = :sid ORDER BY external_id"),
        {"sid": source.id},
    ).all()
    assert [r.external_id for r in rows] == ["it-1", "it-2"]
    assert {r.venue_place_id for r in rows} == {link.place_id}
    assert rows[0].status == "scheduled" and rows[0].city_slug == "scaper-it"
    assert rows[0].lat == pytest.approx(0.5)

    run = conn.execute(text("SELECT status, inserted, fetched FROM ingest.runs WHERE id = :id"), {"id": report.run_id}).one()
    assert (run.status, run.inserted, run.fetched) == ("succeeded", 2, 2)


def test_second_run_is_unchanged_then_cancellation_updates(pg) -> None:
    store, conn = pg
    source = _add_source(store)
    run_source(store, ListConnector([_ocean_event("it-1")]), source)

    again = run_source(store, ListConnector([_ocean_event("it-1")]), source)
    assert (again.stats.unchanged, again.stats.inserted, again.stats.updated) == (1, 0, 0)

    cancelled = run_source(store, ListConnector([_ocean_event("it-1", status="canceled")]), source)
    assert cancelled.stats.updated == 1
    status = conn.execute(text("SELECT status FROM events WHERE provider='eventbrite' AND external_id='it-1'")).scalar_one()
    assert status == "cancelled"


def test_venue_matches_existing_place_by_geo_and_name(pg) -> None:
    store, conn = pg
    place_id = conn.execute(
        text(
            "INSERT INTO places (name, geog) VALUES ('Scaper IT Hall', "
            "ST_SetSRID(ST_MakePoint(-150.5003, 0.5002), 4326)::geography) RETURNING id"
        )
    ).scalar_one()
    source = _add_source(store)
    run_source(store, ListConnector([_ocean_event("it-1")]), source)

    link = conn.execute(text("SELECT place_id, method FROM ingest.place_links WHERE external_id='scaper-it-venue'")).one()
    assert (link.place_id, link.method) == (place_id, "geo_name")


def test_single_flight_lease(pg) -> None:
    store, _ = pg
    source = _add_source(store)
    store.start_run(source)
    with pytest.raises(RunInProgress):
        store.start_run(source)


def test_expire_unseen_hides_delisted_events_from_reader(pg) -> None:
    store, conn = pg
    source = _add_source(store)
    future = {"utc": "2099-01-01T00:00:00Z", "timezone": "UTC"}
    run_source(store, ListConnector([_ocean_event("it-1", start=future, end=None), _ocean_event("it-2", start=future, end=None)]), source)

    # now() is frozen inside the test transaction; backdate to simulate an earlier run.
    conn.execute(text("UPDATE events SET last_seen_at = now() - interval '1 day' WHERE source_id = :sid"), {"sid": source.id})
    conn.execute(text("UPDATE ingest.raw_records SET last_seen_at = now() - interval '1 day'"))
    run_source(store, ListConnector([_ocean_event("it-1", start=future, end=None)]), source)

    reader_sql = text(
        """
        SELECT external_id FROM events
        WHERE COALESCE(expires_at, end_time, start_time) > now() + interval '1 second'
          AND status IN ('scheduled', 'sold_out', 'postponed')
          AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(-150.5, 0.5), 4326)::geography, 1000)
          AND source_id = :sid
        """
    )
    visible = [r.external_id for r in conn.execute(reader_sql, {"sid": source.id})]
    assert visible == ["it-1"]


def test_purge_deletes_only_past_scaper_events(pg) -> None:
    store, conn = pg
    source = _add_source(store)
    past = {"utc": "2020-01-01T00:00:00Z", "timezone": "UTC"}
    future = {"utc": "2099-01-01T00:00:00Z", "timezone": "UTC"}
    # A non-Scaper row that is also in the past must survive.
    conn.execute(
        text(
            "INSERT INTO events (provider, external_id, title, start_time, end_time) "
            "VALUES ('other-writer', 'scaper-it-foreign', 'Foreign', '2020-01-01Z', '2020-01-01Z')"
        )
    )
    report = run_source(
        store,
        ListConnector([_ocean_event("it-past", start=past, end=past), _ocean_event("it-future", start=future, end=None)]),
        source,
    )
    assert report.stats.purged >= 1
    remaining = {r.external_id for r in conn.execute(text("SELECT external_id FROM events WHERE source_id = :sid"), {"sid": source.id})}
    assert remaining == {"it-future"}
    assert conn.execute(text("SELECT count(*) FROM events WHERE external_id = 'scaper-it-foreign'")).scalar_one() == 1
    logged = conn.execute(text("SELECT purged FROM ingest.runs WHERE id = :id"), {"id": report.run_id}).scalar_one()
    assert logged == report.stats.purged
