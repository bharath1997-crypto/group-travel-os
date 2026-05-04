from __future__ import annotations

import uuid
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
    monkeypatch.setattr(
        "app.routers.explorer.search_google_events",
        lambda query, city, date_filter="today": [
            {"id": "google_event_0", "title": "Jazz Night"},
        ],
    )

    response = client.get("/api/v1/explorer/feed?city=Chicago")

    assert response.status_code == 200
    assert response.json()["total"] == 1


def test_explorer_search_returns_200(monkeypatch):
    app.dependency_overrides[get_current_user] = _mock_user

    def fake_run(session, location, query, *, max_results=48):
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

    monkeypatch.setattr("app.routers.explorer.run_explorer_aggregate_search", fake_run)

    try:
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
    monkeypatch.setattr("app.services.serpapi_service.settings.serpapi_key", None)

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
