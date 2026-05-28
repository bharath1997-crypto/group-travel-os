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

