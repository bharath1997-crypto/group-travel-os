"""
F27 — provider mix in the Explore events feed (server-side, before paging).

Opt-in Postgres suite (SCAPER_PG_TEST_URL); every test runs inside the rolled-back
`pg` transaction from test_scaper_postgres. Rows are seeded straight into
public.events with a Scaper source id, so the reader's `source_id IS NOT NULL`
filter applies and no connector or external API is touched.
"""
from __future__ import annotations

import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import Connection, text

from app.services.explore_scaper_events import scaper_events_for_city
from tests.test_scaper_postgres import pg  # noqa: F401  (fixture; pytest_plugins in a test module is ignored in a full run)

pytestmark = pytest.mark.scaper_postgres

CITY_SLUG = "scaper-mix-it"
CITY = "Scaper-Mix-It"
TZ = "America/Chicago"
# Far in the future so expiry never hides a row; noon local keeps the local day stable.
DAY_1 = datetime(2099, 3, 10, 12, 0, tzinfo=timezone.utc)
DAY_2 = DAY_1 + timedelta(days=1)


class _ConnDb:
    """ORM Session(bind=conn) leaves bind unset in SQLAlchemy 2 — use the connection directly."""

    def __init__(self, conn: Connection) -> None:
        self.bind = conn
        self._conn = conn

    @contextmanager
    def begin_nested(self):
        with self._conn.begin_nested():
            yield

    def execute(self, statement, params=None):
        return self._conn.execute(statement, params or {})


def _source_id(conn: Connection) -> uuid.UUID:
    return conn.execute(
        text(
            """
            INSERT INTO ingest.sources (connector, name, config, city_slug)
            VALUES ('eventbrite', :name, '{}'::jsonb, :city)
            RETURNING id
            """
        ),
        {"name": f"scaper-mix-it-{uuid.uuid4().hex[:8]}", "city": CITY_SLUG},
    ).scalar_one()


def _seed(conn: Connection, source_id: uuid.UUID, provider: str, prefix: str, starts: list[datetime]) -> None:
    for index, start in enumerate(starts):
        conn.execute(
            text(
                """
                INSERT INTO public.events (
                  provider, external_id, title, start_time, end_time, status, source_id,
                  city_slug, timezone, fetched_at
                ) VALUES (
                  :provider, :ext, :title, :start, :start, 'scheduled', :sid,
                  :city, :tz, :start
                )
                """
            ),
            {
                "provider": provider,
                "ext": f"{prefix}-{index:03d}",
                "title": f"{provider} {prefix} {index:03d}",
                "start": start,
                "sid": source_id,
                "city": CITY_SLUG,
                "tz": TZ,
            },
        )


def _page(db: _ConnDb, *, page: int, per_page: int) -> list[dict]:
    return scaper_events_for_city(db, city=CITY, page=page, per_page=per_page)["events"]


def _minutes(base: datetime, count: int, *, offset: int = 0, step: int = 5) -> list[datetime]:
    return [base + timedelta(minutes=offset + step * i) for i in range(count)]


def test_first_page_mixes_providers_within_a_day(pg) -> None:
    """30 Ticketmaster rows early, 3 Eventbrite later: page 1 (size 12) holds all 3 Eventbrite rows."""
    _, conn = pg
    sid = _source_id(conn)
    _seed(conn, sid, "ticketmaster", "tm", _minutes(DAY_1, 30))
    _seed(conn, sid, "eventbrite", "eb", _minutes(DAY_1, 3, offset=30 * 5 + 60))

    page_1 = _page(_ConnDb(conn), page=1, per_page=12)
    providers = [e["source"] for e in page_1]
    assert providers.count("eventbrite") == 3
    assert providers.count("ticketmaster") == 9
    # Round-robin: both providers alternate until Eventbrite runs out.
    assert providers[:6] == ["ticketmaster", "eventbrite"] * 3
    # Within one provider the order stays chronological.
    for provider in ("ticketmaster", "eventbrite"):
        times = [(e["date"], e["time"]) for e in page_1 if e["source"] == provider]
        assert times == sorted(times)


def test_day_one_events_always_precede_day_two(pg) -> None:
    _, conn = pg
    sid = _source_id(conn)
    _seed(conn, sid, "ticketmaster", "tm1", _minutes(DAY_1, 4))
    _seed(conn, sid, "eventbrite", "eb1", _minutes(DAY_1, 2, offset=120))
    # Day 2 has an Eventbrite row earlier in the day than Day 1's Eventbrite rows would be.
    _seed(conn, sid, "eventbrite", "eb2", _minutes(DAY_2, 3))
    _seed(conn, sid, "ticketmaster", "tm2", _minutes(DAY_2, 3, offset=30))

    rows = _page(_ConnDb(conn), page=1, per_page=50)
    days = [e["date"] for e in rows]
    assert len(rows) == 12
    assert days == sorted(days)
    assert days[:6] == [DAY_1.date().isoformat()] * 6
    assert days[6:] == [DAY_2.date().isoformat()] * 6


def test_single_provider_is_plain_start_time_order(pg) -> None:
    _, conn = pg
    sid = _source_id(conn)
    # Insert out of chronological order so the result cannot be insertion order by accident.
    starts = _minutes(DAY_1, 10)
    _seed(conn, sid, "ticketmaster", "tm", list(reversed(starts)))

    rows = _page(_ConnDb(conn), page=1, per_page=50)
    assert [e["source"] for e in rows] == ["ticketmaster"] * 10
    times = [e["time"] for e in rows]
    assert times == sorted(times)


def test_paging_returns_every_row_exactly_once(pg) -> None:
    _, conn = pg
    sid = _source_id(conn)
    _seed(conn, sid, "ticketmaster", "tm", _minutes(DAY_1, 30))
    _seed(conn, sid, "eventbrite", "eb", _minutes(DAY_1, 3, offset=400))
    _seed(conn, sid, "ticketweb", "tw", _minutes(DAY_2, 7))
    _seed(conn, sid, "eventbrite", "eb2", _minutes(DAY_2, 5, offset=200))
    expected_total = 30 + 3 + 7 + 5

    db = _ConnDb(conn)
    first = scaper_events_for_city(db, city=CITY, page=1, per_page=12)
    assert first["total"] == expected_total

    seen: list[str] = []
    page = 1
    while True:
        rows = _page(db, page=page, per_page=12)
        if not rows:
            break
        seen.extend(e["id"] for e in rows)
        page += 1
    assert len(seen) == expected_total
    assert len(set(seen)) == expected_total

    # Deterministic: the same page twice yields the same ids in the same order.
    assert [e["id"] for e in _page(db, page=2, per_page=12)] == [e["id"] for e in _page(db, page=2, per_page=12)]


def test_round_robin_is_generic_over_three_providers(pg) -> None:
    _, conn = pg
    sid = _source_id(conn)
    _seed(conn, sid, "ticketmaster", "tm", _minutes(DAY_1, 6))
    _seed(conn, sid, "eventbrite", "eb", _minutes(DAY_1, 2, offset=300))
    _seed(conn, sid, "ticketweb", "tw", _minutes(DAY_1, 2, offset=600))

    providers = [e["source"] for e in _page(_ConnDb(conn), page=1, per_page=50)]
    # Rank 1 of each provider (ordered by start_time), then rank 2 of each, then the rest.
    assert providers[:3] == ["ticketmaster", "eventbrite", "ticketweb"]
    assert providers[3:6] == ["ticketmaster", "eventbrite", "ticketweb"]
    assert providers[6:] == ["ticketmaster"] * 4
