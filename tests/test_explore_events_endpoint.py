from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_explore_events_endpoint_ticketmaster(monkeypatch):
    """
    Verify /api/v1/explore/events successfully queries and returns events from Ticketmaster.
    """
    mock_event = {
        "id": "e1",
        "title": "Concert",
        "imageUrl": "https://example.com/img.jpg",
        "url": "https://ticketmaster.com/e1",
        "start_date": "2026-06-01",
        "venue": "Grand Hall",
        "category": "Music",
        "sourceType": "ticketmaster"
    }

    # Mock get_ticketmaster_cached in app.routes.explore
    monkeypatch.setattr(
        "app.routes.explore.get_ticketmaster_cached",
        lambda db, city, start_date, end_date, lat, lon, radius: [mock_event]
    )

    response = client.get("/api/v1/explore/events?city=Chicago")
    assert response.status_code == 200
    data = response.json()
    assert data["city"] == "Chicago"
    assert len(data["events"]) == 1
    assert data["events"][0]["title"] == "Concert"
    assert data["events"][0]["category"] == "Music"


@pytest.mark.anyio
async def test_explore_events_endpoint_ai_fallback(monkeypatch):
    """
    Verify /api/v1/explore/events gracefully falls back to AI suggested seasonal events when Ticketmaster is empty.
    """
    mock_ai_event = {
        "title": "Ubud Festival",
        "emoji": "🎨",
        "description": "Art festival in Ubud",
        "location": "Ubud Art Center",
        "time": "Throughout the month"
    }

    # Mock get_ticketmaster_cached to return empty list
    monkeypatch.setattr(
        "app.routes.explore.get_ticketmaster_cached",
        lambda db, city, start_date, end_date, lat, lon, radius: []
    )

    # Mock get_ai_seasonal_events to return the mock AI event
    async def mock_get_ai_seasonal_events(city: str):
        return [mock_ai_event]

    monkeypatch.setattr(
        "app.services.explore_city_extended_service.get_ai_seasonal_events",
        mock_get_ai_seasonal_events
    )

    response = client.get("/api/v1/explore/events?city=Bali")
    assert response.status_code == 200
    data = response.json()
    assert data["city"] == "Bali"
    assert len(data["events"]) == 1
    
    event = data["events"][0]
    assert "🎨 Ubud Festival" in event["title"]
    assert "Ubud Art Center" in event["venue"]
    assert event["sourceType"] == "ai_fallback"


def test_get_explore_event_detail():
    """
    Verify GET /api/v1/explore/events/{event_id} returns detail for mock events or 404 for unknown ones.
    """
    response = client.get("/api/v1/explore/events/mock-12345")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "mock-12345"
    assert data["title"] == "Local Experience"
    assert data["category"] == "Festival"
    
    response_nf = client.get("/api/v1/explore/events/unknown-event-id")
    assert response_nf.status_code == 404


def test_get_explore_event_detail_ticketmaster_row():
    """Detail lookup resolves ticketmaster_event rows by event_id."""
    from datetime import date, datetime, timezone
    from sqlalchemy import delete

    from app.models.explore_content import ExploreContent
    from app.utils.database import SessionLocal

    db = SessionLocal()
    try:
        db.execute(delete(ExploreContent).where(ExploreContent.event_id == "tm_detail_test_1"))
        db.commit()

        row = ExploreContent(
            city="Austin",
            content_type="ticketmaster_event",
            data=[],
            fetched_at=datetime.now(timezone.utc),
            event_id="tm_detail_test_1",
            title="Detail Test Concert",
            category="Music",
            venue_name="Moody Theater",
            venue_lat=30.2672,
            venue_lon=-97.7431,
            state="Texas",
            start_date=date(2026, 6, 15),
            start_time="20:00",
            price_min=25.0,
            price_max=75.0,
            image_url="https://example.com/img.jpg",
            ticket_url="https://ticketmaster.com/tm_detail_test_1",
            source="ticketmaster",
        )
        db.add(row)
        db.commit()

        response = client.get("/api/v1/explore/events/tm_detail_test_1")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "tm_detail_test_1"
        assert data["title"] == "Detail Test Concert"
        assert data["venue"] == "Moody Theater"
        assert data["state"] == "Texas"
        assert data["start_date"] == "2026-06-15"
    finally:
        db.execute(delete(ExploreContent).where(ExploreContent.event_id == "tm_detail_test_1"))
        db.commit()
        db.close()


def test_get_similar_explore_events():
    """Similar events match category and city, exclude anchor, sort by rating."""
    from datetime import date, datetime, timezone
    from sqlalchemy import delete

    from app.models.explore_content import ExploreContent
    from app.utils.database import SessionLocal

    ids = [
        "tm_similar_anchor",
        "tm_similar_austin_1",
        "tm_similar_austin_2",
        "tm_similar_nyc",
        "tm_similar_other_cat",
    ]
    db = SessionLocal()
    try:
        db.execute(delete(ExploreContent).where(ExploreContent.event_id.in_(ids)))
        db.commit()

        base = dict(
            content_type="ticketmaster_event",
            data=[],
            fetched_at=datetime.now(timezone.utc),
            category="SimilarEventsTestCategory",
            venue_lat=30.2672,
            venue_lon=-97.7431,
            state="Texas",
            start_date=date(2026, 6, 20),
            start_time="20:00",
            source="ticketmaster",
        )
        test_city = "SimilarEventsTestCity"
        rows = [
            ExploreContent(
                **base,
                city=test_city,
                event_id="tm_similar_anchor",
                title="Anchor Show",
                venue_name="Moody Theater",
                price_max=120.0,
            ),
            ExploreContent(
                **base,
                city=test_city,
                event_id="tm_similar_austin_1",
                title="Austin Live A",
                venue_name="ACL Live",
                price_max=90.0,
            ),
            ExploreContent(
                **base,
                city=test_city,
                event_id="tm_similar_austin_2",
                title="Austin Live B",
                venue_name="Stubbs",
                price_max=60.0,
            ),
            ExploreContent(
                **{
                    **base,
                    "city": "New York",
                    "event_id": "tm_similar_nyc",
                    "title": "NYC Show",
                    "venue_name": "MSG",
                    "venue_lat": 40.7505,
                    "venue_lon": -73.9934,
                    "state": "New York",
                },
            ),
            ExploreContent(
                **{
                    **base,
                    "city": "Austin",
                    "event_id": "tm_similar_other_cat",
                    "title": "Sports Game",
                    "category": "SimilarEventsOtherCategory",
                    "venue_name": "Stadium",
                },
            ),
        ]
        db.add_all(rows)
        db.commit()

        response = client.get(
            "/api/v1/explore/events/similar/tm_similar_anchor?limit=4"
        )
        assert response.status_code == 200
        data = response.json()
        returned_ids = [ev["id"] for ev in data["events"]]
        assert "tm_similar_anchor" not in returned_ids
        assert "tm_similar_other_cat" not in returned_ids
        assert "tm_similar_nyc" not in returned_ids
        assert "tm_similar_austin_1" in returned_ids
        assert "tm_similar_austin_2" in returned_ids
        assert len(returned_ids) == 2
    finally:
        db.execute(delete(ExploreContent).where(ExploreContent.event_id.in_(ids)))
        db.commit()
        db.close()

