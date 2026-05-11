from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.explorer import ExplorerResultItem, ExplorerSearchResponse
from app.utils.auth import get_current_user

client = TestClient(app)


def _mock_user() -> MagicMock:
    user = MagicMock()
    user.id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    user.email = "test@example.com"
    user.full_name = "Test User"
    user.is_active = True
    return user


def test_explorer_feed_returns_200(monkeypatch):
    """Feed reads DB cache via ``get_cached_events`` — not SerpAPI on the router."""
    ev = MagicMock()
    ev.id = uuid.uuid4()
    ev.external_id = "ext-jazz"
    ev.title = "Jazz Night"
    ev.description = ""
    ev.category = "Music"
    ev.source_name = "demo"
    ev.booking_url = ""
    ev.image_url = ""
    ev.venue_name = "Library"
    ev.city = "Chicago"
    ev.start_time = datetime.now(timezone.utc)
    ev.price_from = None
    ev.is_free = True

    monkeypatch.setattr(
        "app.services.explore_service.get_cached_events",
        lambda db, bt, city, cat: [ev],
    )

    response = client.get("/api/v1/explorer/feed?city=Chicago")

    assert response.status_code == 200
    assert response.json()["total"] == 1


def test_explorer_search_returns_200(monkeypatch):
    app.dependency_overrides[get_current_user] = _mock_user

    try:
        def fake_tier(db, location, query):  # matches _run_tiered_explorer_search
            return ExplorerSearchResponse(
                location=location,
                query=query,
                city=location,
                results=[
                    ExplorerResultItem(
                        source="google_places",
                        source_type="google_places",
                        type="place",
                        title="Cafe",
                        id="c1",
                        venue="Main",
                        city=location,
                    ),
                ],
                total=1,
                source="google_places",
            )

        monkeypatch.setattr(
            "app.routers.explorer._run_tiered_explorer_search",
            fake_tier,
        )

        response = client.get("/api/v1/explorer/search?q=coffee&city=Chicago&type=all")
        assert response.status_code == 200
        payload = response.json()
        assert payload["total"] == 1
        assert payload["source"] == "google_places"
        assert payload["location"] == "Chicago"
        assert payload["city"] == "Chicago"
        assert payload["results"][0]["title"] == "Cafe"
        alias = client.get("/api/v1/explorer/search?query=coffee&location=Chicago")
        assert alias.status_code == 200
        assert alias.json()["query"] == "coffee"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_explorer_feed_empty_when_no_key(monkeypatch):
    monkeypatch.setattr(
        "app.services.explore_service.get_cached_events",
        lambda db, bt, city, cat: [],
    )

    response = client.get("/api/v1/explorer/feed?city=Chicago")

    assert response.status_code == 200
    assert response.json()["events"] == []


def test_explorer_save_requires_auth():
    response = client.post(
        "/api/v1/explorer/items/google_event_0/save",
        json={"trip_id": "trip_1"},
    )

    assert response.status_code == 401


def test_wayra_chat_returns_response():
    app.dependency_overrides[get_current_user] = _mock_user
    try:
        response = client.post(
            "/api/v1/wayra/chat",
            json={"message": "free food ideas", "city": "Chicago", "trip_context": ""},
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    assert "response" in response.json()
