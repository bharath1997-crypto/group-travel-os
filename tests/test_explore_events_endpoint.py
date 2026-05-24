from __future__ import annotations

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_explore_events_endpoint(monkeypatch):
    """
    Verify /api/v1/explore/events successfully queries and returns events.
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
