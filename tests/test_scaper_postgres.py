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

MIGRATIONS = [
    Path(__file__).resolve().parents[1] / "migrations" / name
    for name in ("008_scaper_ingest.sql", "009_scaper_dedup.sql", "010_scaper_state.sql")
]
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
        for _ in range(2):  # idempotent
            for migration in MIGRATIONS:
                conn.exec_driver_sql(migration.read_text(encoding="utf-8"))
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


# ── 009 dedup ─────────────────────────────────────────────────────────────

FUTURE = {"utc": "2099-01-01T00:00:00Z", "timezone": "UTC"}


def _visible(conn: Connection, source: Source) -> set[str]:
    return {
        r.external_id
        for r in conn.execute(
            text(
                "SELECT external_id FROM events WHERE source_id = :sid AND duplicate_of IS NULL "
                "AND status IN ('scheduled', 'sold_out', 'postponed')"
            ),
            {"sid": source.id},
        )
    }


def test_duplicate_hidden_distinct_kept_and_canonical_purge_frees_duplicate(pg) -> None:
    store, conn = pg
    source = _add_source(store)
    events = [
        _ocean_event("joey-a", name={"text": 'Joey Cash "Poser Tour"'}, start=FUTURE, end=None),
        _ocean_event("joey-b", name={"text": "Joey Cash at Scaper IT Hall"}, start=FUTURE, end=None, logo=None),
        _ocean_event("omri", name={"text": "OMRI. @ Scaper IT Hall"}, start=FUTURE, end=None),
        _ocean_event("mash", name={"text": "MashBit @ Scaper IT Hall ROOFTOP"}, start=FUTURE, end=None),
    ]
    report = run_source(store, ListConnector(events), source)

    assert report.stats.deduped == 1
    assert _visible(conn, source) == {"joey-a", "omri", "mash"}  # joey-a has the image -> canonical
    assert conn.execute(text("SELECT deduped FROM ingest.runs WHERE id = :id"), {"id": report.run_id}).scalar_one() == 1

    again = run_source(store, ListConnector(events), source)
    assert again.stats.deduped == 0  # idempotent

    conn.execute(text("DELETE FROM events WHERE external_id = 'joey-a' AND source_id = :sid"), {"sid": source.id})
    assert "joey-b" in _visible(conn, source)  # ON DELETE SET NULL resurfaces it


def test_wide_venue_match_and_relink_backfill(pg) -> None:
    store, conn = pg
    source = _add_source(store)
    run_source(store, ListConnector([_ocean_event("it-1", start=FUTURE, end=None)]), source)
    created = conn.execute(
        text("SELECT place_id FROM ingest.place_links WHERE external_id = 'scaper-it-venue' AND method = 'created'")
    ).scalar_one()

    # An Overture row ~180 m away with the same normalized name ("scaper it hall" minus city tokens).
    overture = conn.execute(
        text(
            "INSERT INTO places (gers_id, name, geog) VALUES ('scaper-it-gers', 'The Scaper IT Hall', "
            "ST_SetSRID(ST_MakePoint(-150.5, 0.5016), 4326)::geography) RETURNING id"
        )
    ).scalar_one()
    assert store.relink_created_places("scaper-it") == 1

    link = conn.execute(text("SELECT place_id, method FROM ingest.place_links WHERE external_id = 'scaper-it-venue'")).one()
    assert (link.place_id, link.method) == (overture, "geo_name_wide")
    assert conn.execute(text("SELECT venue_place_id FROM events WHERE external_id = 'it-1'")).scalar_one() == overture
    assert conn.execute(text("SELECT count(*) FROM places WHERE id = :id"), {"id": created}).scalar_one() == 0


def test_address_tier_matches_beyond_wide_radius_only_on_same_street(pg) -> None:
    store, conn = pg
    source = _add_source(store)
    run_source(store, ListConnector([_ocean_event("it-1", start=FUTURE, end=None)]), source)  # venue: 100 W Wacker Dr, 60601

    insert = text(
        "INSERT INTO places (gers_id, name, geog, address) VALUES (:gers, 'The Scaper IT Hall', "
        "ST_SetSRID(ST_MakePoint(-150.5, :lat), 4326)::geography, CAST(:address AS jsonb)) RETURNING id"
    )
    # ~300 m, same name and postcode, different street: must not match.
    conn.execute(insert, {"gers": "scaper-it-decoy", "lat": 0.5027, "address": '{"freeform": "200 W Wacker Dr", "postcode": "60601"}'})
    # ~400 m, same name, same street spelled out, ZIP+4: tier A3 match.
    target = conn.execute(
        insert, {"gers": "scaper-it-a3", "lat": 0.5036, "address": '{"freeform": "100 West Wacker Drive", "postcode": "60601-1234"}'}
    ).scalar_one()

    assert store.relink_created_places("scaper-it") == 1
    link = conn.execute(text("SELECT place_id, method FROM ingest.place_links WHERE external_id = 'scaper-it-venue'")).one()
    assert (link.place_id, link.method) == (target, "geo_address")


def test_reader_shows_next_upcoming_slot_per_group(pg) -> None:
    from app.services.scaper_event_visibility import visible_events_cte

    _, conn = pg
    insert = text(
        "INSERT INTO events (id, provider, external_id, title, start_time, expires_at, status, duplicate_of) "
        "VALUES (:id, 'scaper-it', :ext, 'Slot', now() + make_interval(mins => :mins), "
        "now() + make_interval(mins => :mins + 360), 'scheduled', :dup)"
    )
    canonical = uuid.uuid4()
    conn.execute(insert, {"id": canonical, "ext": "slot-0", "mins": -60, "dup": None})  # started an hour ago
    upcoming = [uuid.uuid4(), uuid.uuid4()]
    conn.execute(insert, {"id": upcoming[0], "ext": "slot-1", "mins": 60, "dup": canonical})
    conn.execute(insert, {"id": upcoming[1], "ext": "slot-2", "mins": 120, "dup": canonical})

    query = text(visible_events_cte("AND provider = 'scaper-it'") + " SELECT id FROM visible")
    assert [r.id for r in conn.execute(query, {"now": conn.execute(text("SELECT now()")).scalar_one()})] == [upcoming[0]]

    # Once every slot has started, the most recently started one is shown.
    later = conn.execute(text("SELECT now() + interval '3 hours'")).scalar_one()
    assert [r.id for r in conn.execute(query, {"now": later})] == [upcoming[1]]


# ── 010 state Ticketmaster ────────────────────────────────────────────────

from tests.scaper_fixtures import ticketmaster_event


class _TmStateConnector(ListConnector):
    name = "ticketmaster"

    def __init__(self, payloads: list[dict[str, Any]]) -> None:
        from scaper.connectors.ticketmaster import TicketmasterStateConfig

        super().__init__(payloads)
        self.config_model = TicketmasterStateConfig
        self.last_fetch_complete = True
        from scaper.connectors.ticketmaster import TicketmasterConnector
        from scaper.http import RetryingClient
        import httpx

        self._extract_fn = TicketmasterConnector(
            api_key="k",
            client=RetryingClient(httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(500)))),
        ).extract

    def extract(self, payload: dict[str, Any]):
        return self._extract_fn(payload)


def _tm_ocean_event(event_id: str, *, city: str, state: str) -> dict[str, Any]:
    ev = ticketmaster_event(id=event_id)
    ev["_embedded"]["venues"][0]["city"]["name"] = city
    ev["_embedded"]["venues"][0]["state"]["stateCode"] = state
    ev["_embedded"]["venues"][0]["location"] = {"latitude": OCEAN["lat"], "longitude": OCEAN["lng"]}
    return ev


def test_state_run_stamps_per_venue_city_and_state(pg) -> None:
    store, conn = pg
    source = store.add_source(
        connector="ticketmaster",
        name=f"ticketmaster:state:it-{uuid.uuid4().hex[:6]}",
        config={"state_code": "TX", "days_ahead": 60},
        city_slug=None,
        state_code="TX",
    )
    payloads = [
        _tm_ocean_event("tm-austin", city="Austin", state="TX"),
        _tm_ocean_event("tm-dallas", city="Dallas", state="TX"),
    ]
    report = run_source(store, _TmStateConnector(payloads), source)
    assert report.status == "succeeded"
    rows = conn.execute(
        text("SELECT external_id, city_slug, state_code FROM events WHERE source_id = :sid ORDER BY external_id"),
        {"sid": source.id},
    ).all()
    assert [(r.external_id, r.city_slug, r.state_code) for r in rows] == [
        ("tm-austin", "austin", "TX"),
        ("tm-dallas", "dallas", "TX"),
    ]


def test_scaper_city_enabled_without_city_source(pg) -> None:
    from app.services.explore_scaper_events import scaper_city_enabled
    from sqlalchemy.orm import Session

    store, conn = pg
    future = {"utc": "2099-06-01T00:00:00Z", "timezone": "UTC"}
    source = store.add_source(
        connector="ticketmaster",
        name=f"ticketmaster:state:it-{uuid.uuid4().hex[:6]}",
        config={"state_code": "AK", "days_ahead": 60},
        city_slug=None,
        state_code="AK",
    )
    run_source(store, _TmStateConnector([_tm_ocean_event("tm-anch", city="Anchorage", state="AK")]), source)
    session = Session(bind=conn)
    assert scaper_city_enabled(session, "Anchorage") is True
    assert scaper_city_enabled(session, "Nowhereville") is False
