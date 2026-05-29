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
from app.services.events_service import search_events_extended

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
        assert len(data["weekend"]) >= 1
        assert len(data["popular"]) >= 1
        assert mock_live_fetch.call_count == 0
    finally:
        db.execute(delete(ExploreContent).where(ExploreContent.content_type == "ticketmaster_event"))
        db.commit()
        db.close()
