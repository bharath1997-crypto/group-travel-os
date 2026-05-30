from __future__ import annotations

import uuid
from datetime import datetime, date, timezone, timedelta
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from sqlalchemy import select, delete

from app.main import app
from app.models.explore_content import ExploreContent
from app.utils.database import SessionLocal
from app.jobs.daily_events_fetch import run_daily_events_fetch
from app.services.events_service import search_events_extended, get_national_picks

client = TestClient(app)


def test_admin_trigger_daily_fetch_returns_202():
    """Verify that the admin trigger endpoint is registered and returns 202 Accepted."""
    response = client.post("/api/v1/admin/trigger-daily-fetch")
    assert response.status_code == 202
    assert response.json()["status"] == "success"
    assert "triggered" in response.json()["message"]


def test_run_daily_events_fetch_job(monkeypatch):
    """Test run_daily_events_fetch with a mocked Ticketmaster API response and verify DB insertion."""
    db = SessionLocal()
    try:
        # 1. Clear any existing test items
        db.execute(delete(ExploreContent).where(ExploreContent.content_type == "ticketmaster_event"))
        db.commit()

        # 2. Mock settings key
        monkeypatch.setattr("config.settings.ticketmaster_api_key", "test-api-key")

        # Mock httpx.Client.get to return fake events
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "_embedded": {
                "events": [
                    {
                        "id": "test_ev_101",
                        "name": "Live Concert Show",
                        "url": "https://ticketmaster.com/test-101",
                        "images": [{"width": 640, "url": "https://ticketmaster.com/img1.jpg"}],
                        "classifications": [{"segment": {"name": "Music"}}],
                        "dates": {
                            "start": {
                                "localDate": date.today().strftime("%Y-%m-%d"),
                                "localTime": "20:00:00"
                            }
                        },
                        "_embedded": {
                            "venues": [
                                {
                                    "name": "Super Arena",
                                    "city": {"name": "Austin"},
                                    "state": {"name": "Texas", "stateCode": "TX"},
                                    "location": {"latitude": "30.2672", "longitude": "-97.7431"}
                                }
                            ]
                        },
                        "priceRanges": [{"min": 50.0, "max": 150.0}]
                    }
                ]
            }
        }

        # Use patch to mock httpx.Client.get and speed up sleep
        with patch("httpx.Client.get", return_value=mock_response), patch("time.sleep", return_value=None):
            result = run_daily_events_fetch()

        print("DEBUG RESULT:", result)

        # 3. Assertions on the job results
        assert result["fetched"] > 0
        assert result["inserted"] > 0

        # Verify DB row actually exists
        db.close()
        db = SessionLocal()
        stmt = select(ExploreContent).where(ExploreContent.event_id == "test_ev_101")
        inserted = db.scalar(stmt)
        print("DEBUG INSERTED ROW:", inserted)
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
        # Clean up
        db.execute(delete(ExploreContent).where(ExploreContent.content_type == "ticketmaster_event"))
        db.commit()
        db.close()


def test_haversine_db_query_and_live_fallback(monkeypatch):
    """
    Test search_events_extended:
    1. Returns db-cached events within radius with 0 live API calls.
    2. Falls back to live fetch when DB has 0 matching events.
    """
    db = SessionLocal()
    try:
        # Clear database
        db.execute(delete(ExploreContent).where(ExploreContent.content_type == "ticketmaster_event"))
        db.commit()

        # Inject a mock event in database near Austin, TX
        now = datetime.now(timezone.utc)
        db_event = ExploreContent(
            city="Austin",
            content_type="ticketmaster_event",
            data=[],
            fetched_at=now,
            event_id="db_ev_austin",
            title="Keep Austin Weird Fest",
            category="Experience",
            venue_name="Austin City Hall",
            venue_lat=30.2672,
            venue_lon=-97.7431,
            state="Texas",
            start_date=date.today(),
            start_time="12:00",
            price_min=10.0,
            price_max=30.0,
            image_url="https://ticketmaster.com/austin.jpg",
            ticket_url="https://ticketmaster.com/austin-weird",
            source="ticketmaster"
        )
        db.add(db_event)
        db.commit()

        # Ensure ticketmaster key is present
        monkeypatch.setattr("config.settings.ticketmaster_api_key", "test-api-key")

        # Mock the live fetch function to prove it is NEVER called when DB has results
        mock_live_fetch = MagicMock(return_value={"events": [], "display_city": "Austin"})
        monkeypatch.setattr("app.services.events_service._fetch_ticketmaster_only", mock_live_fetch)

        # 1. Search near Austin (lat: 30.26, lon: -97.74) -> Should find the injected DB event
        res = search_events_extended(
            db=db,
            city="Austin",
            category="all",
            lat=30.267,
            lon=-97.743,
            radius_miles=50
        )

        assert res["total"] == 1
        assert res["events"][0]["id"] == "db_ev_austin"
        assert res["events"][0]["name"] == "Keep Austin Weird Fest"
        assert res["fetch_mode"] == "local_db"
        # Fewer than 10 DB hits expands through 300 → 500 mi
        assert res["radius_miles"] == 500
        assert res["events"][0]["distance_miles"] is not None
        # The mock live fetch function was NEVER called
        assert mock_live_fetch.call_count == 0

        # 2. Search far away (lat: 40.71, lon: -74.00 - NYC) -> Austin is out of radius
        # Should return 0 local results, falling back to mock live fetch!
        res_nyc = search_events_extended(
            db=db,
            city="New York",
            category="all",
            lat=40.7128,
            lon=-74.0060,
            radius_miles=50
        )

        # Since DB returned 0 matching rows for NYC, it fell back to live search!
        assert mock_live_fetch.call_count == 1

    finally:
        db.execute(delete(ExploreContent).where(ExploreContent.content_type == "ticketmaster_event"))
        db.commit()
        db.close()


def test_explore_sections_from_db_haversine_events(monkeypatch):
    """Explore hub sections populate from haversine DB events (small pool)."""
    db = SessionLocal()
    try:
        db.execute(delete(ExploreContent).where(ExploreContent.content_type == "ticketmaster_event"))
        db.commit()

        now = datetime.now(timezone.utc)
        today = date.today()
        weekend_day = today + timedelta(days=2)
        later_day = today + timedelta(days=14)

        events_to_seed = [
            ("db_near", "Near Show", today, 30.2672, -97.7431),
            ("db_weekend", "Weekend Show", weekend_day, 30.30, -97.75),
            ("db_popular", "Popular Show", later_day, 30.35, -97.80),
        ]
        for event_id, title, start, vlat, vlon in events_to_seed:
            db.add(
                ExploreContent(
                    city="Austin",
                    content_type="ticketmaster_event",
                    data=[],
                    fetched_at=now,
                    event_id=event_id,
                    title=title,
                    category="Music",
                    venue_name="Austin Venue",
                    venue_lat=vlat,
                    venue_lon=vlon,
                    state="Texas",
                    start_date=start,
                    start_time="19:00",
                    price_min=20.0,
                    price_max=40.0,
                    image_url="https://example.com/img.jpg",
                    ticket_url="https://example.com/tix",
                    source="ticketmaster",
                )
            )
        db.commit()

        monkeypatch.setattr("config.settings.ticketmaster_api_key", "test-api-key")
        mock_live_fetch = MagicMock(return_value={"events": [], "display_city": "Austin"})
        monkeypatch.setattr("app.services.events_service._fetch_ticketmaster_only", mock_live_fetch)

        response = client.get(
            "/api/v1/explore/events",
            params={"lat": 30.267, "lon": -97.743, "radius": 200},
        )
        assert response.status_code == 200
        data = response.json()

        assert data["fetch_mode"] == "local_db"
        assert len(data["trending"]) >= 1
        trending_ids = {ev["id"] for ev in data["trending"]}
        weekend_ids = {ev["id"] for ev in data["weekend"]}
        assert trending_ids.isdisjoint(weekend_ids)
        for ev in data["weekend"]:
            ev_date = datetime.strptime(ev["date"], "%Y-%m-%d").date()
            assert today <= ev_date <= today + timedelta(days=3)
        assert len(data["popular"]) >= 1
        assert mock_live_fetch.call_count == 0
    finally:
        db.execute(delete(ExploreContent).where(ExploreContent.content_type == "ticketmaster_event"))
        db.commit()
        db.close()


def test_explore_weekend_strict_three_day_window(monkeypatch):
    """Weekend section only includes events within 3 days and never duplicates Near You."""
    db = SessionLocal()
    try:
        db.execute(delete(ExploreContent).where(ExploreContent.content_type == "ticketmaster_event"))
        db.commit()

        now = datetime.now(timezone.utc)
        today = date.today()

        seeds = [
            ("ev_today", "Today Show", today),
            ("ev_weekend", "Soon Show", today + timedelta(days=2)),
            ("ev_later", "Later Show", today + timedelta(days=10)),
        ]
        for eid, title, start in seeds:
            db.add(
                ExploreContent(
                    city="Austin",
                    content_type="ticketmaster_event",
                    data=[],
                    fetched_at=now,
                    event_id=eid,
                    title=title,
                    category="Music",
                    venue_name="Austin Venue",
                    venue_lat=30.2672,
                    venue_lon=-97.7431,
                    state="Texas",
                    start_date=start,
                    start_time="19:00",
                    price_min=20.0,
                    price_max=40.0,
                    source="ticketmaster",
                )
            )
        db.commit()

        monkeypatch.setattr("config.settings.ticketmaster_api_key", "test-api-key")
        monkeypatch.setattr(
            "app.services.events_service._fetch_ticketmaster_only",
            MagicMock(return_value={"events": [], "display_city": "Austin"}),
        )

        response = client.get(
            "/api/v1/explore/events",
            params={"lat": 30.267, "lon": -97.743, "radius": 200, "per_page": 100},
        )
        assert response.status_code == 200
        data = response.json()

        trending_ids = {ev["id"] for ev in data["trending"]}
        weekend_ids = {ev["id"] for ev in data["weekend"]}

        assert "ev_today" in trending_ids
        assert "ev_later" not in weekend_ids
        assert trending_ids.isdisjoint(weekend_ids)
        for ev in data["weekend"]:
            ev_date = datetime.strptime(ev["date"], "%Y-%m-%d").date()
            assert today <= ev_date <= today + timedelta(days=3)
        if "ev_weekend" not in trending_ids:
            assert "ev_weekend" in weekend_ids
        else:
            assert "ev_weekend" not in weekend_ids
    finally:
        db.execute(delete(ExploreContent).where(ExploreContent.content_type == "ticketmaster_event"))
        db.commit()
        db.close()


def test_get_national_picks_nationwide_ranking():
    """National picks query the full US table, not the local radius pool."""
    db = SessionLocal()
    try:
        db.execute(delete(ExploreContent).where(ExploreContent.content_type == "ticketmaster_event"))
        db.commit()

        now = datetime.now(timezone.utc)
        today = date.today()
        local_id = "db_austin_local"
        national_id = "db_nyc_headliner"

        db.add(
            ExploreContent(
                city="Austin",
                content_type="ticketmaster_event",
                data=[],
                fetched_at=now,
                event_id=local_id,
                title="Neighborhood Open Mic",
                category="Music",
                venue_name="Small Club",
                venue_lat=30.2672,
                venue_lon=-97.7431,
                state="Texas",
                start_date=today,
                start_time="20:00",
                price_min=10.0,
                price_max=20.0,
                source="ticketmaster",
            )
        )
        db.add(
            ExploreContent(
                city="New York",
                content_type="ticketmaster_event",
                data=[],
                fetched_at=now,
                event_id=national_id,
                title="Championship Finals",
                category="Sports",
                venue_name="Madison Square Garden",
                venue_lat=40.7505,
                venue_lon=-73.9934,
                state="New York",
                start_date=today + timedelta(days=7),
                start_time="19:30",
                price_min=120.0,
                price_max=450.0,
                image_url="https://example.com/msg.jpg",
                source="ticketmaster",
            )
        )
        db.commit()

        picks = get_national_picks(db, exclude_ids=[local_id], limit=20)
        assert len(picks) == 1
        assert picks[0]["id"] == national_id
        assert picks[0]["city"] == "New York"
        assert picks[0]["venue"] == "Madison Square Garden"
    finally:
        db.execute(delete(ExploreContent).where(ExploreContent.content_type == "ticketmaster_event"))
        db.commit()
        db.close()


def test_explore_national_section_uses_us_wide_picks(monkeypatch):
    """Explore hub national section surfaces nationwide picks outside the geo radius."""
    db = SessionLocal()
    try:
        db.execute(delete(ExploreContent).where(ExploreContent.content_type == "ticketmaster_event"))
        db.commit()

        now = datetime.now(timezone.utc)
        today = date.today()

        db.add(
            ExploreContent(
                city="Austin",
                content_type="ticketmaster_event",
                data=[],
                fetched_at=now,
                event_id="db_near",
                title="Near Show",
                category="Music",
                venue_name="Austin Venue",
                venue_lat=30.2672,
                venue_lon=-97.7431,
                state="Texas",
                start_date=today,
                start_time="19:00",
                price_min=20.0,
                price_max=40.0,
                source="ticketmaster",
            )
        )
        db.add(
            ExploreContent(
                city="New York",
                content_type="ticketmaster_event",
                data=[],
                fetched_at=now,
                event_id="db_national",
                title="All-Star World Tour",
                category="Music",
                venue_name="Madison Square Garden",
                venue_lat=40.7505,
                venue_lon=-73.9934,
                state="New York",
                start_date=today + timedelta(days=10),
                start_time="20:00",
                price_min=90.0,
                price_max=350.0,
                image_url="https://example.com/national.jpg",
                source="ticketmaster",
            )
        )
        db.commit()

        monkeypatch.setattr("config.settings.ticketmaster_api_key", "test-api-key")
        mock_live_fetch = MagicMock(return_value={"events": [], "display_city": "Austin"})
        monkeypatch.setattr("app.services.events_service._fetch_ticketmaster_only", mock_live_fetch)

        response = client.get(
            "/api/v1/explore/events",
            params={"lat": 30.267, "lon": -97.743, "radius": 200},
        )
        assert response.status_code == 200
        data = response.json()
        national_ids = {ev["id"] for ev in data["national"]}
        assert "db_national" in national_ids
        assert mock_live_fetch.call_count == 0
    finally:
        db.execute(delete(ExploreContent).where(ExploreContent.content_type == "ticketmaster_event"))
        db.commit()
        db.close()
