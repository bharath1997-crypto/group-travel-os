from __future__ import annotations

import uuid
from datetime import datetime, date, timezone, timedelta
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, delete

from app.main import app
from app.models.explore_content import ExploreContent
from app.utils.database import SessionLocal
from app.jobs.daily_events_fetch import run_daily_events_fetch
from app.services.events_service import search_events_extended, get_national_picks

client = TestClient(app)

# Isolated coords unlikely to overlap with bulk Ticketmaster cache rows.
_ISOLATED_LAT = 64.8378
_ISOLATED_LON = -147.7164
_ISOLATED_CITY = "Fairbanks"


@pytest.fixture(autouse=True)
def _reset_db_session():
    """Clear failed transaction state left by other tests or background tasks."""
    db = SessionLocal()
    try:
        db.rollback()
    finally:
        db.close()
    yield


def _weekend_end(today: date) -> date:
    """Upcoming Sunday (or today when today is Sunday)."""
    return today + timedelta(days=(6 - today.weekday()) % 7)


def _open_tm_db():
    db = SessionLocal()
    db.rollback()
    return db


def _close_tm_db(db, event_ids: list[str] | None = None) -> None:
    try:
        db.rollback()
        if event_ids:
            db.execute(
                delete(ExploreContent).where(ExploreContent.event_id.in_(event_ids))
            )
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _purge_all_ticketmaster(db) -> None:
    db.rollback()
    db.execute(
        delete(ExploreContent).where(ExploreContent.content_type == "ticketmaster_event")
    )
    db.commit()


def _seed_ticketmaster_row(
    db,
    *,
    event_id: str,
    title: str,
    start: date,
    city: str,
    venue_lat: float,
    venue_lon: float,
    category: str = "Music",
    price_min: float = 20.0,
    price_max: float = 40.0,
    image_url: str | None = None,
) -> None:
    now = datetime.now(timezone.utc)
    db.add(
        ExploreContent(
            city=city,
            content_type="ticketmaster_event",
            data=[],
            fetched_at=now,
            event_id=event_id,
            title=title,
            category=category,
            venue_name=f"{city} Venue",
            venue_lat=venue_lat,
            venue_lon=venue_lon,
            state="Alaska" if city == _ISOLATED_CITY else "Texas",
            start_date=start,
            start_time="19:00",
            price_min=price_min,
            price_max=price_max,
            image_url=image_url,
            ticket_url=f"https://example.com/{event_id}",
            source="ticketmaster",
        )
    )


def test_admin_trigger_daily_fetch_returns_202(monkeypatch):
    """Verify that the admin trigger endpoint is registered and returns 202 Accepted."""
    monkeypatch.setattr(
        "app.routes.admin.run_daily_events_fetch",
        lambda: {"fetched": 0, "inserted": 0, "updated": 0, "deleted": 0},
    )
    response = client.post("/api/v1/admin/trigger-daily-fetch")
    assert response.status_code == 202
    assert response.json()["status"] == "success"
    assert "triggered" in response.json()["message"]


def test_run_daily_events_fetch_job(monkeypatch):
    """Test run_daily_events_fetch with a mocked Ticketmaster API response and verify DB insertion."""
    event_id = f"tm_job_test_{uuid.uuid4().hex[:12]}"
    db = _open_tm_db()
    try:
        db.execute(delete(ExploreContent).where(ExploreContent.event_id == event_id))
        db.commit()

        monkeypatch.setattr("config.settings.ticketmaster_api_key", "test-api-key")
        monkeypatch.setattr(
            "app.jobs.daily_events_fetch.settings.ticketmaster_api_key",
            "test-api-key",
        )

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "_embedded": {
                "events": [
                    {
                        "id": event_id,
                        "name": "Live Concert Show",
                        "url": "https://ticketmaster.com/test-101",
                        "images": [{"width": 640, "url": "https://ticketmaster.com/img1.jpg"}],
                        "classifications": [{"segment": {"name": "Music"}}],
                        "dates": {
                            "start": {
                                "localDate": date.today().strftime("%Y-%m-%d"),
                                "localTime": "20:00:00",
                            }
                        },
                        "_embedded": {
                            "venues": [
                                {
                                    "name": "Super Arena",
                                    "city": {"name": "Austin"},
                                    "state": {"name": "Texas", "stateCode": "TX"},
                                    "location": {"latitude": "30.2672", "longitude": "-97.7431"},
                                }
                            ]
                        },
                        "priceRanges": [{"min": 50.0, "max": 150.0}],
                    }
                ]
            }
        }

        with patch("httpx.Client.get", return_value=mock_response) as mock_get, patch(
            "time.sleep", return_value=None
        ):
            result = run_daily_events_fetch()

        assert mock_get.call_count == 50
        assert isinstance(result, dict)
        assert result is not None
        assert result["fetched"] > 0
        assert (result["inserted"] + result["updated"]) >= 1

        db.close()
        verify_db = SessionLocal()
        try:
            inserted = verify_db.scalar(
                select(ExploreContent).where(ExploreContent.event_id == event_id)
            )
            assert inserted is not None
            assert inserted.title == "Live Concert Show"
            assert inserted.category == "Music"
            assert inserted.venue_name == "Super Arena"
            assert inserted.venue_lat == 30.2672
            assert inserted.venue_lon == -97.7431
            assert inserted.city == "Austin"
            assert inserted.state == "Texas"
            assert inserted.price_min == 50.0
            assert inserted.price_max == 150.0
        finally:
            verify_db.close()

    finally:
        _close_tm_db(db, [event_id])


def test_haversine_db_query_and_live_fallback(monkeypatch):
    """
    Test search_events_extended:
    1. Returns db-cached events within radius with 0 live API calls.
    2. Falls back to live fetch when DB has 0 matching events.
    """
    local_id = "db_ev_haversine_local"
    db = _open_tm_db()
    try:
        _purge_all_ticketmaster(db)
        db.execute(delete(ExploreContent).where(ExploreContent.event_id == local_id))
        db.commit()

        _seed_ticketmaster_row(
            db,
            event_id=local_id,
            title="Keep Austin Weird Fest",
            start=date.today(),
            city=_ISOLATED_CITY,
            venue_lat=_ISOLATED_LAT,
            venue_lon=_ISOLATED_LON,
            category="Experience",
            price_min=10.0,
            price_max=30.0,
        )
        db.commit()

        monkeypatch.setattr("config.settings.ticketmaster_api_key", "test-api-key")

        mock_live_fetch = MagicMock(return_value={"events": [], "display_city": _ISOLATED_CITY})
        monkeypatch.setattr("app.services.events_service._fetch_ticketmaster_only", mock_live_fetch)

        res = search_events_extended(
            db=db,
            city=_ISOLATED_CITY,
            category="all",
            lat=_ISOLATED_LAT,
            lon=_ISOLATED_LON,
            radius_miles=50,
        )

        db.rollback()
        returned_ids = {ev["id"] for ev in res["events"]}
        assert local_id in returned_ids
        local_event = next(ev for ev in res["events"] if ev["id"] == local_id)
        assert local_event["name"] == "Keep Austin Weird Fest"
        assert res["fetch_mode"] == "local_db"
        assert res["radius_miles"] == 500
        assert local_event["distance_miles"] is not None
        assert mock_live_fetch.call_count == 0

        search_events_extended(
            db=db,
            city="New York",
            category="all",
            lat=40.7128,
            lon=-74.0060,
            radius_miles=50,
        )

        assert mock_live_fetch.call_count == 1

    finally:
        _close_tm_db(db, [local_id])


def test_explore_sections_from_db_haversine_events(monkeypatch):
    """Explore hub sections populate from haversine DB events (small pool)."""
    event_ids = ["db_near", "db_weekend", "db_popular"]
    db = _open_tm_db()
    try:
        _purge_all_ticketmaster(db)
        db.execute(delete(ExploreContent).where(ExploreContent.event_id.in_(event_ids)))
        db.commit()

        today = date.today()
        weekend_end = _weekend_end(today)
        weekend_day = min(today + timedelta(days=1), weekend_end)
        later_day = weekend_end + timedelta(days=14)

        events_to_seed = [
            ("db_near", "Near Show", today),
            ("db_weekend", "Weekend Show", weekend_day),
            ("db_popular", "Popular Show", later_day),
        ]
        for event_id, title, start in events_to_seed:
            _seed_ticketmaster_row(
                db,
                event_id=event_id,
                title=title,
                start=start,
                city=_ISOLATED_CITY,
                venue_lat=_ISOLATED_LAT,
                venue_lon=_ISOLATED_LON,
            )
        db.commit()

        monkeypatch.setattr("config.settings.ticketmaster_api_key", "test-api-key")
        mock_live_fetch = MagicMock(return_value={"events": [], "display_city": _ISOLATED_CITY})
        monkeypatch.setattr("app.services.events_service._fetch_ticketmaster_only", mock_live_fetch)

        response = client.get(
            "/api/v1/explore/events",
            params={
                "lat": _ISOLATED_LAT,
                "lon": _ISOLATED_LON,
                "radius": 200,
                "per_page": 100,
            },
        )
        assert response.status_code == 200
        data = response.json()

        assert mock_live_fetch.call_count == 0
        if data.get("fetch_mode") is not None:
            assert data["fetch_mode"] == "local_db"

        all_section_ids = {
            ev["id"]
            for section in (data["trending"], data["weekend"], data["popular"])
            for ev in section
        }
        assert event_ids[0] in all_section_ids or len(data["trending"]) >= 1
        assert len(data["popular"]) >= 1

        for ev in data["weekend"]:
            ev_date = datetime.strptime(ev["date"], "%Y-%m-%d").date()
            assert today <= ev_date <= weekend_end

    finally:
        _close_tm_db(db, event_ids)


def test_explore_weekend_calendar_window(monkeypatch):
    """Weekend section includes events from today through Sunday."""
    event_ids = ["ev_today", "ev_weekend", "ev_later"]
    db = _open_tm_db()
    try:
        _purge_all_ticketmaster(db)
        db.execute(delete(ExploreContent).where(ExploreContent.event_id.in_(event_ids)))
        db.commit()

        today = date.today()
        weekend_end = _weekend_end(today)
        in_window_day = weekend_end if weekend_end >= today else today

        seeds = [
            ("ev_today", "Today Show", today),
            ("ev_weekend", "Weekend Show", in_window_day),
            ("ev_later", "Later Show", weekend_end + timedelta(days=10)),
        ]
        for eid, title, start in seeds:
            _seed_ticketmaster_row(
                db,
                event_id=eid,
                title=title,
                start=start,
                city=_ISOLATED_CITY,
                venue_lat=_ISOLATED_LAT,
                venue_lon=_ISOLATED_LON,
            )
        db.commit()

        monkeypatch.setattr("config.settings.ticketmaster_api_key", "test-api-key")
        monkeypatch.setattr(
            "app.services.events_service._fetch_ticketmaster_only",
            MagicMock(return_value={"events": [], "display_city": _ISOLATED_CITY}),
        )

        response = client.get(
            "/api/v1/explore/events",
            params={
                "lat": _ISOLATED_LAT,
                "lon": _ISOLATED_LON,
                "radius": 200,
                "per_page": 100,
            },
        )
        assert response.status_code == 200
        data = response.json()

        weekend_ids = {ev["id"] for ev in data["weekend"]}
        assert "ev_later" not in weekend_ids
        assert "ev_today" in weekend_ids or "ev_weekend" in weekend_ids or len(weekend_ids) >= 1
        for ev in data["weekend"]:
            ev_date = datetime.strptime(ev["date"], "%Y-%m-%d").date()
            assert today <= ev_date <= weekend_end

    finally:
        _close_tm_db(db, event_ids)


def test_get_national_picks_nationwide_ranking():
    """National picks query the full US table, not the local radius pool."""
    local_id = "db_austin_local"
    national_id = "db_nyc_headliner"
    event_ids = [local_id, national_id]
    db = _open_tm_db()
    try:
        _purge_all_ticketmaster(db)

        today = date.today()
        _seed_ticketmaster_row(
            db,
            event_id=local_id,
            title="Neighborhood Open Mic",
            start=today,
            city="Austin",
            venue_lat=30.2672,
            venue_lon=-97.7431,
            price_min=10.0,
            price_max=20.0,
        )
        _seed_ticketmaster_row(
            db,
            event_id=national_id,
            title="Championship Finals",
            start=today + timedelta(days=7),
            city="New York",
            venue_lat=40.7505,
            venue_lon=-73.9934,
            category="Sports",
            price_min=120.0,
            price_max=450.0,
            image_url="https://example.com/msg.jpg",
        )
        db.commit()

        picks = get_national_picks(
            db,
            limit=20,
            lat=30.267,
            lon=-97.743,
            radius_miles=50,
        )
        pick_ids = {p["id"] for p in picks}
        assert local_id not in pick_ids
        assert national_id in pick_ids
        national_pick = next(p for p in picks if p["id"] == national_id)
        assert national_pick["city"] == "New York"
        assert national_pick["venue"] == "New York Venue"
    finally:
        _close_tm_db(db, event_ids)


def test_explore_national_section_uses_us_wide_picks(monkeypatch):
    """Explore hub national section surfaces nationwide picks outside the geo radius."""
    event_ids = ["db_near", "db_national"]
    db = _open_tm_db()
    try:
        _purge_all_ticketmaster(db)

        today = date.today()
        _seed_ticketmaster_row(
            db,
            event_id="db_near",
            title="Near Show",
            start=today,
            city=_ISOLATED_CITY,
            venue_lat=_ISOLATED_LAT,
            venue_lon=_ISOLATED_LON,
        )
        _seed_ticketmaster_row(
            db,
            event_id="db_national",
            title="All-Star World Tour",
            start=today + timedelta(days=10),
            city="New York",
            venue_lat=40.7505,
            venue_lon=-73.9934,
            price_min=90.0,
            price_max=350.0,
            image_url="https://example.com/national.jpg",
        )
        db.commit()

        monkeypatch.setattr("config.settings.ticketmaster_api_key", "test-api-key")
        mock_live_fetch = MagicMock(return_value={"events": [], "display_city": _ISOLATED_CITY})
        monkeypatch.setattr("app.services.events_service._fetch_ticketmaster_only", mock_live_fetch)

        response = client.get(
            "/api/v1/explore/events",
            params={
                "lat": _ISOLATED_LAT,
                "lon": _ISOLATED_LON,
                "radius": 200,
                "per_page": 100,
            },
        )
        assert response.status_code == 200
        data = response.json()
        national_ids = {ev["id"] for ev in data["national"]}
        assert "db_national" in national_ids
        assert mock_live_fetch.call_count == 0
    finally:
        _close_tm_db(db, event_ids)
