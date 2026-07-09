"""
tests/test_google_calendar.py — Google Calendar integration endpoints

Tests:
  - connect URL generation
  - callback stores encrypted tokens
  - disconnect disables integration
  - sync-trip rejects unauthenticated user
  - sync-trip rejects user without trip membership
  - sync-trip rejects if integration missing
  - sync-trip success stores google_event_id
  - integrations list returns only current user's integrations
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import exec_result


@pytest.fixture
def google_calendar_oauth_env(monkeypatch):
    """CI has no GOOGLE_CLIENT_ID — callback tests need fake OAuth credentials."""
    monkeypatch.setattr("config.settings.GOOGLE_CLIENT_ID", "test-google-calendar-client-id")
    monkeypatch.setattr(
        "config.settings.GOOGLE_CLIENT_SECRET",
        "test-google-calendar-client-secret",
    )


# ── App client helpers ────────────────────────────────────────────────────────

def _get_client(mock_user):
    from app.main import app
    from app.utils.auth import get_current_user

    app.dependency_overrides[get_current_user] = lambda: mock_user
    return TestClient(app, raise_server_exceptions=True)


def _unauthed_client():
    from app.main import app
    from app.utils.auth import get_current_user
    from app.utils.exceptions import AppException

    def _raise():
        raise AppException.unauthorized("Not authenticated")

    app.dependency_overrides[get_current_user] = _raise
    return TestClient(app, raise_server_exceptions=False)


# ── connect URL generation ────────────────────────────────────────────────────

class TestGoogleCalendarConnect:
    def test_connect_returns_redirect_to_google(self, mock_user):
        """GET /integrations/google-calendar/connect → 302 to accounts.google.com"""
        with patch("app.services.google_calendar_service.encrypt_state", return_value="mocked_state"):
            with patch("app.services.google_calendar_service._client_id", return_value="test-client-id"):
                with patch("app.services.google_calendar_service._redirect_uri", return_value="http://localhost/cb"):
                    client = _get_client(mock_user)
                    resp = client.get(
                        "/api/v1/integrations/google-calendar/connect",
                        follow_redirects=False,
                    )

        assert resp.status_code == 302
        location = resp.headers["location"]
        assert "accounts.google.com" in location
        assert "calendar.events" in location
        assert "mocked_state" in location

    def test_build_connect_url_includes_scope(self, mock_user):
        """build_connect_url encodes the Google calendar.events scope."""
        from app.services.google_calendar_service import build_connect_url

        with patch("app.services.google_calendar_service._client_id", return_value="cid"):
            with patch("app.services.google_calendar_service._redirect_uri", return_value="http://localhost/cb"):
                url = build_connect_url(mock_user.id)

        assert "calendar.events" in url
        assert "offline" in url
        assert "consent" in url


# ── callback stores encrypted tokens ─────────────────────────────────────────

class TestGoogleCalendarCallback:
    def _make_callback_request(self, db, code, state):
        from fastapi.testclient import TestClient
        from app.main import app
        from app.utils.database import get_db

        app.dependency_overrides[get_db] = lambda: db
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get(
            f"/api/v1/integrations/google-calendar/callback?code={code}&state={state}",
            follow_redirects=False,
        )
        app.dependency_overrides.pop(get_db, None)
        return resp

    def test_callback_stores_encrypted_tokens(self, google_calendar_oauth_env):
        """Callback: exchanges code for tokens, stores encrypted tokens in DB."""
        user_id = uuid.UUID("00000000-0000-0000-0000-000000000099")
        state = "test_state"
        code = "auth_code"
        mock_db = MagicMock(spec=Session)
        mock_db.execute.return_value = exec_result(scalar_one_or_none=None)

        token_response = {
            "access_token": "raw_access_token",
            "refresh_token": "raw_refresh_token",
            "expires_in": 3600,
            "scope": "https://www.googleapis.com/auth/calendar.events",
        }

        with patch("app.services.google_calendar_service.decrypt_state", return_value=str(user_id)):
            with patch("app.services.google_calendar_service.http") as mock_http:
                mock_resp = MagicMock()
                mock_resp.ok = True
                mock_resp.json.return_value = token_response
                mock_http.post.return_value = mock_resp

                with patch("app.services.google_calendar_service.encrypt_token") as mock_enc:
                    mock_enc.side_effect = lambda t: f"ENC:{t}"

                    from app.services.google_calendar_service import handle_callback
                    result_user_id = handle_callback(mock_db, code, state)

        assert result_user_id == user_id
        # DB should have been committed with encrypted tokens
        mock_db.commit.assert_called_once()
        # A new UserIntegration was added
        mock_db.add.assert_called_once()
        added = mock_db.add.call_args[0][0]
        assert added.provider == "google_calendar"
        assert added.access_token == "ENC:raw_access_token"
        assert added.refresh_token == "ENC:raw_refresh_token"
        assert added.is_active is True

    def test_callback_invalid_state_raises(self):
        """Bad state parameter → 400."""
        mock_db = MagicMock(spec=Session)

        with patch("app.services.google_calendar_service.decrypt_state", side_effect=ValueError("bad")):
            resp = self._make_callback_request(mock_db, "code", "bad_state")

        assert resp.status_code == 400


# ── disconnect ────────────────────────────────────────────────────────────────

class TestDisconnect:
    def test_disconnect_sets_inactive(self, mock_user):
        """POST /integrations/google-calendar/disconnect → sets is_active=False, clears tokens."""
        existing = MagicMock()
        existing.access_token = "ENC:some_token"
        existing.refresh_token = "ENC:some_refresh"

        from app.main import app
        from app.utils.database import get_db

        mock_db = MagicMock(spec=Session)
        mock_db.execute.return_value = exec_result(scalar_one_or_none=existing)

        app.dependency_overrides[get_db] = lambda: mock_db

        with patch("app.services.google_calendar_service.decrypt_token", return_value="raw_token"):
            with patch("app.services.google_calendar_service.http") as mock_http:
                mock_http.post.return_value = MagicMock(ok=True)
                client = _get_client(mock_user)
                resp = client.post("/api/v1/integrations/google-calendar/disconnect")

        app.dependency_overrides.pop(get_db, None)

        assert resp.status_code == 200
        assert resp.json()["status"] == "disconnected"
        assert existing.is_active is False
        assert existing.access_token is None
        assert existing.refresh_token is None
        mock_db.commit.assert_called_once()

    def test_disconnect_no_integration_is_noop(self, mock_user):
        """Disconnect when no integration exists → 200, no error."""
        from app.main import app
        from app.utils.database import get_db

        mock_db = MagicMock(spec=Session)
        mock_db.execute.return_value = exec_result(scalar_one_or_none=None)
        app.dependency_overrides[get_db] = lambda: mock_db

        client = _get_client(mock_user)
        resp = client.post("/api/v1/integrations/google-calendar/disconnect")
        app.dependency_overrides.pop(get_db, None)

        assert resp.status_code == 200


# ── sync-trip auth guard ──────────────────────────────────────────────────────

class TestSyncTripAuth:
    def test_sync_trip_requires_auth(self):
        """POST sync-trip without JWT → 401."""
        client = _unauthed_client()
        trip_id = uuid.uuid4()
        resp = client.post(f"/api/v1/integrations/google-calendar/sync-trip/{trip_id}")
        assert resp.status_code == 401

    def test_sync_trip_non_member_rejected(self, mock_user):
        """User not on trip roster → 403."""
        trip_id = uuid.uuid4()

        trip = MagicMock()
        trip.id = trip_id
        trip.title = "Paris Trip"
        trip.start_date = None
        trip.end_date = None
        trip.google_calendar_event_id = None

        from app.main import app
        from app.utils.database import get_db

        mock_db = MagicMock(spec=Session)
        mock_db.execute.side_effect = [
            exec_result(scalar_one_or_none=trip),   # trip lookup
            exec_result(scalar_one_or_none=None),   # roster lookup → not a member
        ]
        app.dependency_overrides[get_db] = lambda: mock_db

        client = _get_client(mock_user)
        resp = client.post(f"/api/v1/integrations/google-calendar/sync-trip/{trip_id}")
        app.dependency_overrides.pop(get_db, None)

        assert resp.status_code == 403

    def test_sync_trip_missing_integration_rejected(self, mock_user):
        """User is on trip but has no Google Calendar integration → 400."""
        trip_id = uuid.uuid4()
        trip = MagicMock()
        trip.id = trip_id
        trip.title = "London Bound"
        trip.google_calendar_event_id = None

        roster_entry = MagicMock()

        from app.main import app
        from app.utils.database import get_db

        mock_db = MagicMock(spec=Session)
        mock_db.execute.side_effect = [
            exec_result(scalar_one_or_none=trip),          # trip
            exec_result(scalar_one_or_none=roster_entry),  # roster → member
            exec_result(scalar_one_or_none=None),           # integration → missing
        ]
        app.dependency_overrides[get_db] = lambda: mock_db

        client = _get_client(mock_user)
        resp = client.post(f"/api/v1/integrations/google-calendar/sync-trip/{trip_id}")
        app.dependency_overrides.pop(get_db, None)

        assert resp.status_code == 400


# ── sync-trip success ─────────────────────────────────────────────────────────

class TestSyncTripSuccess:
    def test_sync_trip_creates_event_and_stores_id(self, mock_user):
        """Happy path: sync creates a new Google Calendar event and stores event ID."""
        trip_id = uuid.uuid4()

        trip = MagicMock()
        trip.id = trip_id
        trip.title = "Bali Getaway"
        trip.description = "Sun and surf"
        trip.status = MagicMock(value="planning")
        from datetime import date
        trip.start_date = date(2026, 8, 1)
        trip.end_date   = date(2026, 8, 10)
        trip.google_calendar_event_id = None  # no existing event

        roster_entry = MagicMock()

        integration = MagicMock()
        integration.access_token = "ENC:raw_access"
        integration.refresh_token = None
        integration.token_expires_at = None  # treat as valid (no expiry stored)

        from app.main import app
        from app.utils.database import get_db

        mock_db = MagicMock(spec=Session)
        mock_db.execute.side_effect = [
            exec_result(scalar_one_or_none=trip),
            exec_result(scalar_one_or_none=roster_entry),
            exec_result(scalar_one_or_none=integration),
        ]
        app.dependency_overrides[get_db] = lambda: mock_db

        with patch("app.services.google_calendar_service.decrypt_token", return_value="raw_access"):
            with patch("app.services.google_calendar_service.http") as mock_http:
                event_resp = MagicMock(ok=True)
                event_resp.json.return_value = {"id": "google_event_abc123"}
                mock_http.post.return_value = event_resp

                client = _get_client(mock_user)
                resp = client.post(
                    f"/api/v1/integrations/google-calendar/sync-trip/{trip_id}"
                )
                app.dependency_overrides.pop(get_db, None)

        assert resp.status_code == 200
        data = resp.json()
        assert data["google_event_id"] == "google_event_abc123"
        assert data["action"] == "created"
        # trip.google_calendar_event_id updated
        assert trip.google_calendar_event_id == "google_event_abc123"
        mock_db.commit.assert_called_once()

    def test_sync_trip_updates_existing_event(self, mock_user):
        """If trip already has google_calendar_event_id, a PUT (update) is issued."""
        trip_id = uuid.uuid4()

        trip = MagicMock()
        trip.id = trip_id
        trip.title = "Tokyo Adventure"
        trip.description = "Cherry blossoms"
        trip.status = MagicMock(value="confirmed")
        from datetime import date
        trip.start_date = date(2026, 4, 1)
        trip.end_date   = date(2026, 4, 14)
        trip.google_calendar_event_id = "existing_event_id"

        roster_entry = MagicMock()

        integration = MagicMock()
        integration.access_token = "ENC:access"
        integration.refresh_token = None
        integration.token_expires_at = None

        from app.main import app
        from app.utils.database import get_db

        mock_db = MagicMock(spec=Session)
        mock_db.execute.side_effect = [
            exec_result(scalar_one_or_none=trip),
            exec_result(scalar_one_or_none=roster_entry),
            exec_result(scalar_one_or_none=integration),
        ]
        app.dependency_overrides[get_db] = lambda: mock_db

        with patch("app.services.google_calendar_service.decrypt_token", return_value="access"):
            with patch("app.services.google_calendar_service.http") as mock_http:
                update_resp = MagicMock(ok=True, status_code=200)
                update_resp.json.return_value = {"id": "existing_event_id"}
                mock_http.put.return_value = update_resp

                client = _get_client(mock_user)
                resp = client.post(
                    f"/api/v1/integrations/google-calendar/sync-trip/{trip_id}"
                )
                app.dependency_overrides.pop(get_db, None)

        assert resp.status_code == 200
        data = resp.json()
        assert data["action"] == "updated"
        assert data["google_event_id"] == "existing_event_id"


# ── integrations list isolation ───────────────────────────────────────────────

class TestIntegrationsList:
    def test_list_returns_only_current_users_integrations(self, mock_user):
        """GET /integrations returns rows for current user only."""
        user_intg = MagicMock()
        user_intg.id = uuid.uuid4()
        user_intg.provider = "google_calendar"
        user_intg.is_active = True
        user_intg.scopes = ["https://www.googleapis.com/auth/calendar.events"]
        user_intg.last_synced_at = None
        user_intg.created_at = datetime.now(timezone.utc)

        from app.main import app
        from app.utils.database import get_db

        mock_db = MagicMock(spec=Session)
        mock_db.execute.return_value = exec_result(scalars_all=[user_intg])
        app.dependency_overrides[get_db] = lambda: mock_db

        client = _get_client(mock_user)
        resp = client.get("/api/v1/integrations")
        app.dependency_overrides.pop(get_db, None)

        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["provider"] == "google_calendar"
        assert data[0]["is_active"] is True

    def test_list_requires_auth(self):
        """GET /integrations without JWT → 401."""
        client = _unauthed_client()
        resp = client.get("/api/v1/integrations")
        assert resp.status_code == 401
