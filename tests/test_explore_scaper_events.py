"""Main Explore consumes Scaper's city inventory without distance filtering."""
from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.services.explore_scaper_events import scaper_event_detail, scaper_events_for_city


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
