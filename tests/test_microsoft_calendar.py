"""
tests/test_microsoft_calendar.py — Microsoft Outlook Calendar integration tests

Tests:
  - OAuth URL generation (uses Microsoft identity platform)
  - Callback stores encrypted tokens
  - Disconnect disables integration
  - Sync-trip success (creates event, stores microsoft_event_id)
  - User cannot sync unauthorized trip (not a member → 403)
  - Missing integration rejected (no active integration → 400)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import exec_result


# ── Helpers ───────────────────────────────────────────────────────────────────

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


# ── OAuth URL generation ──────────────────────────────────────────────────────

class TestMicrosoftCalendarConnect:
    def test_connect_url_uses_microsoft_identity_platform(self, mock_user):
        """GET /integrations/microsoft-calendar/connect → 302 to login.microsoftonline.com."""
        with patch("app.services.microsoft_calendar_service.encrypt_state", return_value="ms_state"):
            with patch("app.services.microsoft_calendar_service._client_id", return_value="ms-client-id"):
                with patch("app.services.microsoft_calendar_service._redirect_uri", return_value="http://localhost/cb"):
                    client = _get_client(mock_user)
                    resp = client.get(
                        "/api/v1/integrations/microsoft-calendar/connect",
                        follow_redirects=False,
                    )

        assert resp.status_code == 302
        location = resp.headers["location"]
        assert "login.microsoftonline.com" in location
        assert "ms_state" in location

    def test_connect_url_includes_calendar_scope(self, mock_user):
        """OAuth URL must include Calendars.ReadWrite scope."""
        from app.services.microsoft_calendar_service import build_connect_url

        with patch("app.services.microsoft_calendar_service._client_id", return_value="cid"):
            with patch("app.services.microsoft_calendar_service._redirect_uri", return_value="http://localhost/cb"):
                url = build_connect_url(mock_user.id)

        assert "Calendars.ReadWrite" in url

    def test_connect_url_does_not_include_mail_scope(self, mock_user):
        """OAuth URL must not include Mail or OneDrive scopes."""
        from app.services.microsoft_calendar_service import build_connect_url

        with patch("app.services.microsoft_calendar_service._client_id", return_value="cid"):
            with patch("app.services.microsoft_calendar_service._redirect_uri", return_value="http://localhost/cb"):
                url = build_connect_url(mock_user.id)

        assert "Mail.Read" not in url
        assert "Files.ReadWrite" not in url
        assert "User.Read.All" not in url


# ── Callback stores encrypted tokens ─────────────────────────────────────────

class TestMicrosoftCalendarCallback:
    def test_callback_stores_encrypted_tokens(self):
        """handle_callback stores encrypted access + refresh tokens."""
        user_id = uuid.UUID("00000000-0000-0000-0000-000000000099")
        mock_db = MagicMock(spec=Session)
        mock_db.execute.return_value = exec_result(scalar_one_or_none=None)

        token_response = {
            "access_token":  "ms_raw_access",
            "refresh_token": "ms_raw_refresh",
            "expires_in":    3600,
            "scope":         "Calendars.ReadWrite offline_access",
        }

        with patch("app.services.microsoft_calendar_service.decrypt_state", return_value=str(user_id)):
            with patch("app.services.microsoft_calendar_service._client_id", return_value="cid"):
                with patch("app.services.microsoft_calendar_service._client_secret", return_value="secret"):
                    with patch("app.services.microsoft_calendar_service._redirect_uri", return_value="http://localhost/cb"):
                        with patch("app.services.microsoft_calendar_service.http") as mock_http:
                            mock_resp = MagicMock(ok=True)
                            mock_resp.json.return_value = token_response
                            mock_http.post.return_value = mock_resp

                            with patch("app.services.microsoft_calendar_service.encrypt_token") as mock_enc:
                                mock_enc.side_effect = lambda t: f"ENC:{t}"

                                from app.services.microsoft_calendar_service import handle_callback
                                result_uid = handle_callback(mock_db, "ms_code", "ms_state")

        assert result_uid == user_id
        mock_db.commit.assert_called_once()
        mock_db.add.assert_called_once()
        added = mock_db.add.call_args[0][0]
        assert added.provider == "microsoft_calendar"
        assert added.access_token == "ENC:ms_raw_access"
        assert added.refresh_token == "ENC:ms_raw_refresh"
        assert added.is_active is True


# ── Disconnect ────────────────────────────────────────────────────────────────

class TestMicrosoftCalendarDisconnect:
    def test_disconnect_sets_inactive_and_clears_tokens(self, mock_user):
        """POST disconnect → is_active=False, tokens cleared (no revocation for MS)."""
        existing = MagicMock()
        existing.access_token  = "ENC:tok"
        existing.refresh_token = "ENC:ref"

        from app.main import app
        from app.utils.database import get_db

        mock_db = MagicMock(spec=Session)
        mock_db.execute.return_value = exec_result(scalar_one_or_none=existing)
        app.dependency_overrides[get_db] = lambda: mock_db

        client = _get_client(mock_user)
        resp = client.post("/api/v1/integrations/microsoft-calendar/disconnect")
        app.dependency_overrides.pop(get_db, None)

        assert resp.status_code == 200
        assert resp.json()["status"] == "disconnected"
        assert existing.is_active is False
        assert existing.access_token is None
        assert existing.refresh_token is None
        mock_db.commit.assert_called_once()


# ── Sync trip guards ──────────────────────────────────────────────────────────

class TestSyncTripGuards:
    def test_sync_trip_requires_auth(self):
        """POST sync-trip without JWT → 401."""
        client = _unauthed_client()
        resp = client.post(f"/api/v1/integrations/microsoft-calendar/sync-trip/{uuid.uuid4()}")
        assert resp.status_code == 401

    def test_sync_trip_rejects_non_member(self, mock_user):
        """User not on trip roster → 403."""
        trip_id = uuid.uuid4()
        trip    = MagicMock()
        trip.id = trip_id

        from app.main import app
        from app.utils.database import get_db

        mock_db = MagicMock(spec=Session)
        mock_db.execute.side_effect = [
            exec_result(scalar_one_or_none=trip),   # trip lookup
            exec_result(scalar_one_or_none=None),   # roster → not a member
        ]
        app.dependency_overrides[get_db] = lambda: mock_db

        client = _get_client(mock_user)
        resp = client.post(f"/api/v1/integrations/microsoft-calendar/sync-trip/{trip_id}")
        app.dependency_overrides.pop(get_db, None)

        assert resp.status_code == 403

    def test_sync_trip_rejects_missing_integration(self, mock_user):
        """User is a member but has no Microsoft Calendar integration → 400."""
        trip_id       = uuid.uuid4()
        trip          = MagicMock()
        trip.id       = trip_id
        roster_entry  = MagicMock()

        from app.main import app
        from app.utils.database import get_db

        mock_db = MagicMock(spec=Session)
        mock_db.execute.side_effect = [
            exec_result(scalar_one_or_none=trip),
            exec_result(scalar_one_or_none=roster_entry),
            exec_result(scalar_one_or_none=None),    # no integration
        ]
        app.dependency_overrides[get_db] = lambda: mock_db

        client = _get_client(mock_user)
        resp = client.post(f"/api/v1/integrations/microsoft-calendar/sync-trip/{trip_id}")
        app.dependency_overrides.pop(get_db, None)

        assert resp.status_code == 400
        assert "not connected" in resp.json()["detail"].lower()


# ── Sync trip success ─────────────────────────────────────────────────────────

class TestSyncTripSuccess:
    def test_sync_creates_event_and_stores_id(self, mock_user):
        """Happy path: creates Outlook Calendar event, stores microsoft_calendar_event_id."""
        trip_id = uuid.uuid4()
        from datetime import date

        trip          = MagicMock()
        trip.id       = trip_id
        trip.title    = "Iceland Road Trip"
        trip.description = "Northern lights"
        trip.status   = MagicMock(value="planning")
        trip.start_date = date(2026, 9, 1)
        trip.end_date   = date(2026, 9, 14)
        trip.microsoft_calendar_event_id = None

        roster_entry  = MagicMock()
        integration   = MagicMock()
        integration.access_token    = "ENC:acc"
        integration.refresh_token   = None
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

        with patch("app.services.microsoft_calendar_service.decrypt_token", return_value="raw_acc"):
            with patch("app.services.microsoft_calendar_service.http") as mock_http:
                event_resp = MagicMock(ok=True)
                event_resp.json.return_value = {"id": "ms_event_abc123"}
                mock_http.post.return_value = event_resp

                client = _get_client(mock_user)
                resp   = client.post(
                    f"/api/v1/integrations/microsoft-calendar/sync-trip/{trip_id}"
                )
                app.dependency_overrides.pop(get_db, None)

        assert resp.status_code == 200
        data = resp.json()
        assert data["microsoft_event_id"] == "ms_event_abc123"
        assert data["action"] == "created"
        assert trip.microsoft_calendar_event_id == "ms_event_abc123"
        mock_db.commit.assert_called_once()


# ── Event body structure ──────────────────────────────────────────────────────

class TestEventBodyStructure:
    def test_event_uses_subject_not_summary(self):
        """Microsoft Graph uses 'subject', not Google's 'summary'."""
        from datetime import date
        from app.services.microsoft_calendar_service import _build_event_body

        trip = MagicMock()
        trip.title       = "Venice Weekend"
        trip.description = "Canal boats"
        trip.status      = MagicMock(value="confirmed")
        trip.start_date  = date(2026, 6, 20)
        trip.end_date    = date(2026, 6, 22)
        trip.id          = uuid.uuid4()

        body = _build_event_body(trip)

        assert "subject" in body
        assert body["subject"] == "Venice Weekend"
        assert "summary" not in body

    def test_end_date_plus_one_for_all_day(self):
        """End date is incremented by 1 day for exclusive all-day event end."""
        from datetime import date
        from app.services.microsoft_calendar_service import _build_event_body

        trip = MagicMock()
        trip.title       = "Trip"
        trip.description = None
        trip.status      = MagicMock(value="planning")
        trip.start_date  = date(2026, 7, 1)
        trip.end_date    = date(2026, 7, 5)
        trip.id          = uuid.uuid4()

        body = _build_event_body(trip)

        # End should be July 6 (exclusive)
        assert "2026-07-06" in body["end"]["dateTime"]
        assert body["isAllDay"] is True
