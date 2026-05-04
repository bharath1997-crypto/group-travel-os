from __future__ import annotations

import uuid
from collections.abc import Iterator
from types import SimpleNamespace
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.main import app
from app.routers.explorer import _search_internal_db
from app.utils.auth import get_current_user
from app.utils.database import get_db

client = TestClient(app)


def _mock_user() -> MagicMock:
    user = MagicMock()
    user.id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    user.email = "test@example.com"
    user.full_name = "Test User"
    user.is_active = True
    return user


def _mock_db() -> Iterator[MagicMock]:
    yield MagicMock()


def _install_auth_and_db_overrides() -> None:
    app.dependency_overrides[get_current_user] = _mock_user
    app.dependency_overrides[get_db] = _mock_db


def _clear_overrides() -> None:
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_db, None)


def test_search_returns_db_results_first(monkeypatch):
    _install_auth_and_db_overrides()
    monkeypatch.setattr(
        "app.routers.explorer._search_internal_db",
        lambda db, q, city: [
            {
                "id": "internal-1",
                "title": "Local Jazz",
                "description": "Saved event",
                "source_type": "internal",
                "source_url": "",
                "booking_type": "internal",
                "image_url": "",
                "venue": "Library",
                "city": city,
                "price_from": None,
                "is_free": True,
            },
        ],
    )
    google_events = MagicMock(return_value=[{"id": "google_event_0"}])
    monkeypatch.setattr("app.routers.explorer.search_google_events", google_events)
    try:
        response = client.get("/api/v1/explorer/search?q=jazz&city=Chicago")
    finally:
        _clear_overrides()

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "internal_db"
    assert body["total"] == 1
    google_events.assert_not_called()


def test_search_falls_back_to_google_events(monkeypatch):
    _install_auth_and_db_overrides()
    monkeypatch.setattr("app.routers.explorer._search_internal_db", lambda db, q, city: [])
    monkeypatch.setattr(
        "app.routers.explorer.search_google_events",
        lambda query, city: [{"id": "google_event_0", "title": "Jazz Night"}],
    )
    monkeypatch.setattr("app.routers.explorer.search_google_places", lambda query, city: [])
    try:
        response = client.get("/api/v1/explorer/search?q=jazz&city=Chicago")
    finally:
        _clear_overrides()

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "google_events"
    assert body["results"][0]["id"] == "google_event_0"


def test_search_falls_back_to_google_web(monkeypatch):
    _install_auth_and_db_overrides()
    monkeypatch.setattr("app.routers.explorer._search_internal_db", lambda db, q, city: [])
    monkeypatch.setattr("app.routers.explorer.search_google_events", lambda query, city: [])
    monkeypatch.setattr("app.routers.explorer.search_google_places", lambda query, city: [])
    monkeypatch.setattr(
        "app.services.serpapi_service.search_google_web",
        lambda query, city: [{"id": "google_web_0", "title": "Best jazz Chicago"}],
    )
    try:
        response = client.get("/api/v1/explorer/search?q=jazz&city=Chicago")
    finally:
        _clear_overrides()

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "google_web"
    assert body["results"][0]["id"] == "google_web_0"


def test_search_returns_wayra_suggestion_when_empty(monkeypatch):
    _install_auth_and_db_overrides()
    monkeypatch.setattr("app.routers.explorer._search_internal_db", lambda db, q, city: [])
    monkeypatch.setattr("app.routers.explorer.search_google_events", lambda query, city: [])
    monkeypatch.setattr("app.routers.explorer.search_google_places", lambda query, city: [])
    monkeypatch.setattr("app.services.serpapi_service.search_google_web", lambda query, city: [])
    try:
        response = client.get("/api/v1/explorer/search?q=zzzz&city=Chicago")
    finally:
        _clear_overrides()

    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "none"
    assert body["total"] == 0
    assert "wayra_suggestion" in body


def test_search_short_query_returns_400():
    _install_auth_and_db_overrides()
    try:
        response = client.get("/api/v1/explorer/search?q=a&city=Chicago")
    finally:
        _clear_overrides()

    assert response.status_code == 400
    assert response.json()["detail"] == "Search query too short"


def test_search_tier1_skipped_gracefully_if_table_missing(monkeypatch):
    _install_auth_and_db_overrides()
    monkeypatch.setattr(
        "app.routers.explorer.search_google_events",
        lambda query, city: [{"id": "google_event_0", "title": "Fallback event"}],
    )
    monkeypatch.setattr("app.routers.explorer.search_google_places", lambda query, city: [])
    try:
        response = client.get("/api/v1/explorer/search?q=event&city=Chicago")
    finally:
        _clear_overrides()

    assert response.status_code == 200
    assert response.json()["source"] == "google_events"
    assert _search_internal_db(SimpleNamespace(), "event", "Chicago") == []
