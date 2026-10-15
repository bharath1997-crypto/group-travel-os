"""Main Explore consumes Scaper's city inventory without distance filtering."""
from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.services.explore_scaper_events import (
    provider_mix_ranked_sql,
    scaper_event_detail,
    scaper_events_for_city,
)


class _Rows:
    def __init__(self, rows):
        self.rows = rows

    def mappings(self):
        return self

    def all(self):
        return self.rows

    def first(self):
        return self.rows[0] if self.rows else None

    def scalar_one(self):
        return 141


class FakeDb:
    bind = SimpleNamespace(dialect=SimpleNamespace(name="postgresql"))

    def __init__(self, row):
        self.row = row
        self.sql = []

    def begin_nested(self):
        return nullcontext()

    def execute(self, statement, params):
        sql = str(statement)
        self.sql.append((sql, params))
        return _Rows([self.row] if "SELECT id" in sql else [])


def test_orlando_hub_uses_city_not_five_km_and_preserves_unknown_price():
    row = {
        "id": uuid4(), "title": "Orlando show", "category": "Music",
        "start_time": datetime.now(timezone.utc) + timedelta(days=1),
        "venue_name": "Main Hall", "image_url": None,
        "ticket_url": "https://example.com/show", "price_min": None,
        "price_max": None, "is_free": None, "status": "scheduled",
        "provider": "eventbrite", "lat": 28.5, "lng": -81.4,
        "fetched_at": datetime.now(timezone.utc),
    }
    db = FakeDb(row)
    result = scaper_events_for_city(db, city="Orlando", per_page=300)
    assert result["total"] == 141
    assert result["radius_miles"] is None
    assert result["events"][0]["price_min"] is None
    assert result["events"][0]["id"].startswith("scaper:")
    assert all("ST_DWithin" not in sql and "radius" not in params for sql, params in db.sql)
    assert all("duplicate_of IS NULL" in sql for sql, _ in db.sql)


def test_provider_mix_ranked_sql_no_duplicate_rank_columns():
    """Catch AmbiguousColumn regressions before Postgres-only CI runs."""
    sql = " ".join(provider_mix_ranked_sql().split())
    assert "SELECT mixed.*" in sql or "SELECT mixed. *" in sql.replace(" ", "")
    assert "mixed.rank_p" not in sql
    assert "mixed.mix_position" not in sql
    assert sql.count("AS rank_p") == 1
    assert sql.count("AS mix_position") == 1


def test_hub_reader_mixes_providers_window_wide_in_sql():
    """F27b: the page query ranks by (mix_position, start_time, id) before LIMIT."""
    row = {
        "id": uuid4(), "title": "Chicago show", "category": "Music",
        "start_time": datetime.now(timezone.utc) + timedelta(days=1),
        "venue_name": "Hall", "image_url": None, "ticket_url": "", "price_min": None,
        "price_max": None, "is_free": None, "status": "scheduled",
        "provider": "ticketmaster", "lat": 41.8, "lng": -87.6,
        "timezone": "America/Chicago", "fetched_at": datetime.now(timezone.utc),
    }
    db = FakeDb(row)
    scaper_events_for_city(db, city="Chicago", page=2, per_page=24)
    page_sql = next(sql for sql, _ in db.sql if "LIMIT :limit" in sql)
    normalized = " ".join(page_sql.split())
    assert "row_number() OVER ( PARTITION BY v.provider ORDER BY v.start_time ASC, v.id ASC )" in normalized
    assert "AS rank_p" in normalized
    assert "AS mix_position" in normalized
    assert "ORDER BY mix_position ASC, start_time ASC, id ASC LIMIT :limit OFFSET :offset" in normalized
    assert "SELECT id, title, category, start_time" in normalized
    hub_select = normalized.split("FROM (")[0]
    assert "mix_position" not in hub_select
    assert "rank_p" not in hub_select
    # The window runs over the visibility CTE and the result is paged in SQL, not sorted in Python.
    assert normalized.index("WITH visible AS") < normalized.index("row_number()") < normalized.index("LIMIT :limit")
    _, params = db.sql[-1]
    assert (params["limit"], params["offset"]) == (24, 24)


def test_scaper_detail_has_no_invented_rating_or_distance():
    row = {
        "id": uuid4(), "title": "Orlando show", "category": "Music",
        "start_time": datetime.now(timezone.utc) + timedelta(days=1),
        "venue_name": "Main Hall", "image_url": None,
        "ticket_url": "https://example.com/show", "price_min": None,
        "price_max": None, "is_free": True, "status": "scheduled",
        "provider": "eventbrite", "lat": 28.5, "lng": -81.4,
        "city_slug": "orlando",
    }
    detail = scaper_event_detail(FakeDb(row), f"scaper:{row['id']}")
    assert detail is not None
    assert detail["rating"] is None
    assert detail["distance_miles"] is None
    assert detail["price_min"] == 0.0


def test_city_slug_matches_ingest_sources_format():
    from app.services.explore_scaper_events import city_slug

    assert city_slug("Chicago, IL") == "chicago"
    assert city_slug("  New York ") == "new-york"


def test_hub_routes_any_scaper_city_to_scaper_feed(monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import app

    calls = []
    monkeypatch.setattr("app.services.explore_scaper_events.scaper_city_enabled", lambda db, city: city == "Chicago")
    monkeypatch.setattr(
        "app.services.explore_scaper_events.scaper_events_for_city",
        lambda db, **kw: calls.append(kw["city"]) or {"city": kw["city"], "events": [], "total": 0, "fetch_mode": "scaper_city"},
    )
    response = TestClient(app).get("/api/v1/explore/events", params={"city": "Chicago, IL"})
    assert response.status_code == 200
    assert response.json()["fetch_mode"] == "scaper_city"
    assert calls == ["Chicago"]


def test_scaper_city_enabled_true_when_inventory_exists(monkeypatch):
    from app.services.explore_scaper_events import scaper_city_enabled

    calls = []

    class Db:
        bind = SimpleNamespace(dialect=SimpleNamespace(name="postgresql"))

        def begin_nested(self):
            return nullcontext()

        def execute(self, statement, params):
            calls.append(str(statement))
            if "ingest.sources" in str(statement):
                return SimpleNamespace(scalar=lambda: None)
            return SimpleNamespace(scalar=lambda: 1)

    assert scaper_city_enabled(Db(), "Austin") is True
    assert any("public.events" in c for c in calls)


def test_scaper_city_enabled_is_false_off_postgres():
    from types import SimpleNamespace

    from app.services.explore_scaper_events import scaper_city_enabled

    db = SimpleNamespace(bind=SimpleNamespace(dialect=SimpleNamespace(name="sqlite")))
    assert scaper_city_enabled(db, "Chicago") is False
