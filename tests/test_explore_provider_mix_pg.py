"""
F27b — window-wide provider mix in the Explore events feed (server-side, before paging).

Postgres-only (not sqlite CI). Run inside a rolled-back transaction:

  SCAPER_PG_TEST_URL=postgresql://USER:PASS@HOST:5432/db \\
    pytest tests/test_explore_provider_mix_pg.py -v

Uses the `pg` fixture from tests/test_scaper_postgres.py (migrations 008–011 applied,
then rolled back). No HTTP; rows are inserted into public.events directly.
"""
from __future__ import annotations

import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import Connection, text

from app.services.explore_scaper_events import MIN_PROVIDER_SHARE_EVERY, scaper_events_for_city
from tests.test_scaper_postgres import pg  # noqa: F401

pytestmark = pytest.mark.scaper_postgres

CITY_SLUG = "scaper-mix-it"
CITY = "Scaper-Mix-It"
TZ = "America/Chicago"
DAY_1 = datetime(2099, 3, 10, 12, 0, tzinfo=timezone.utc)
DAY_2 = DAY_1 + timedelta(days=1)
WEEK_LATER = DAY_1 + timedelta(days=5)


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


def test_window_mix_puts_minor_provider_in_first_page(pg) -> None:
    """200 Ticketmaster early + 5 Eventbrite later in the week: page 1 (24) has >= 3 Eventbrite."""
    _, conn = pg
    sid = _source_id(conn)
    _seed(conn, sid, "ticketmaster", "tm", _minutes(DAY_1, 200))
    _seed(conn, sid, "eventbrite", "eb", _minutes(WEEK_LATER, 5, offset=60))

    page_1 = _page(_ConnDb(conn), page=1, per_page=24)
    providers = [e["source"] for e in page_1]
    assert providers.count("eventbrite") >= 3
    assert providers.count("ticketmaster") + providers.count("eventbrite") == len(page_1)
    eb_times = [(e["date"], e["time"]) for e in page_1 if e["source"] == "eventbrite"]
    assert eb_times == sorted(eb_times)


def test_same_day_late_minor_still_gets_slots(pg) -> None:
    """30 Ticketmaster early, 3 Eventbrite later same day: minor rows appear by mix_position."""
    _, conn = pg
    sid = _source_id(conn)
    _seed(conn, sid, "ticketmaster", "tm", _minutes(DAY_1, 30))
    _seed(conn, sid, "eventbrite", "eb", _minutes(DAY_1, 3, offset=30 * 5 + 60))

    page_1 = _page(_ConnDb(conn), page=1, per_page=12)
    providers = [e["source"] for e in page_1]
    assert providers.count("eventbrite") >= 1
    for provider in ("ticketmaster", "eventbrite"):
        times = [(e["date"], e["time"]) for e in page_1 if e["source"] == provider]
        assert times == sorted(times)


def test_single_provider_is_plain_start_time_order(pg) -> None:
    _, conn = pg
    sid = _source_id(conn)
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

    assert [e["id"] for e in _page(db, page=2, per_page=12)] == [e["id"] for e in _page(db, page=2, per_page=12)]


def test_three_providers_each_get_slots_in_window(pg) -> None:
    _, conn = pg
    sid = _source_id(conn)
    _seed(conn, sid, "ticketmaster", "tm", _minutes(DAY_1, 6))
    _seed(conn, sid, "eventbrite", "eb", _minutes(DAY_1, 2, offset=300))
    _seed(conn, sid, "ticketweb", "tw", _minutes(DAY_1, 2, offset=600))

    providers = [e["source"] for e in _page(_ConnDb(conn), page=1, per_page=50)]
    assert "ticketmaster" in providers
    assert "eventbrite" in providers
    assert "ticketweb" in providers
    # First minor-provider slots land at mix_position 6 (rank 1 * MIN_PROVIDER_SHARE_EVERY).
    assert MIN_PROVIDER_SHARE_EVERY == 6
    assert providers.index("eventbrite") < 12
    assert providers.index("ticketweb") < 12
