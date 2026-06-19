"""
tests/test_google_drive.py — Google Drive integration endpoints

Tests:
  - connect URL uses drive.file scope
  - callback stores encrypted tokens
  - backup rejects unauthenticated user
  - backup rejects another user's export
  - backup rejects export not ready
  - backup rejects missing Google Drive integration
  - successful backup updates metadata
  - disconnect disables integration
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import exec_result


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


def _with_db(mock_db):
    from app.main import app
    from app.utils.database import get_db

    app.dependency_overrides[get_db] = lambda: mock_db
    return app


# ── connect URL ────────────────────────────────────────────────────────────────

class TestGoogleDriveConnect:
    def test_connect_url_uses_drive_file_scope(self, mock_user):
        """GET /integrations/google-drive/connect → 302 with drive.file scope."""
        with patch("app.services.google_drive_service.encrypt_state", return_value="s"):
            with patch("app.services.google_drive_service._client_id", return_value="cid"):
                with patch("app.services.google_drive_service._redirect_uri", return_value="http://localhost/cb"):
                    client = _get_client(mock_user)
                    resp = client.get(
                        "/api/v1/integrations/google-drive/connect",
                        follow_redirects=False,
                    )

        assert resp.status_code == 302
        location = resp.headers["location"]
        assert "accounts.google.com" in location
        assert "drive.file" in location

    def test_connect_url_does_not_include_gmail_scope(self, mock_user):
        """Connect URL must not include Gmail or full Drive scope."""
        from app.services.google_drive_service import build_connect_url

        with patch("app.services.google_drive_service._client_id", return_value="cid"):
            with patch("app.services.google_drive_service._redirect_uri", return_value="http://localhost/cb"):
                url = build_connect_url(mock_user.id)

        assert "gmail" not in url.lower()
        assert "drive.readonly" not in url
        assert "drive.file" in url


# ── callback stores encrypted tokens ──────────────────────────────────────────

class TestGoogleDriveCallback:
    def test_callback_stores_encrypted_tokens(self):
        """Callback exchanges code → stores encrypted access + refresh tokens."""
        user_id = uuid.UUID("00000000-0000-0000-0000-000000000099")
        mock_db = MagicMock(spec=Session)
        mock_db.execute.return_value = exec_result(scalar_one_or_none=None)

        token_response = {
            "access_token":  "raw_drive_access",
            "refresh_token": "raw_drive_refresh",
            "expires_in":    3600,
            "scope": "https://www.googleapis.com/auth/drive.file",
        }

        with patch("app.services.google_drive_service.decrypt_state", return_value=str(user_id)):
            with patch("app.services.google_drive_service.http") as mock_http:
                mock_resp = MagicMock()
                mock_resp.ok = True
                mock_resp.json.return_value = token_response
                mock_http.post.return_value = mock_resp

                with patch("app.services.google_drive_service.encrypt_token") as mock_enc:
                    mock_enc.side_effect = lambda t: f"ENC:{t}"

                    from app.services.google_drive_service import handle_callback
                    result_user_id = handle_callback(mock_db, "auth_code", "state_tok")

        assert result_user_id == user_id
        mock_db.commit.assert_called_once()
        mock_db.add.assert_called_once()
        added = mock_db.add.call_args[0][0]
        assert added.provider == "google_drive"
        assert added.access_token == "ENC:raw_drive_access"
        assert added.refresh_token == "ENC:raw_drive_refresh"
        assert added.is_active is True


# ── disconnect ────────────────────────────────────────────────────────────────

class TestGoogleDriveDisconnect:
    def test_disconnect_sets_inactive(self, mock_user):
        """POST disconnect → is_active=False, tokens cleared."""
        existing = MagicMock()
        existing.access_token = "ENC:tok"
        existing.refresh_token = "ENC:ref"

        from app.main import app
        from app.utils.database import get_db

        mock_db = MagicMock(spec=Session)
        mock_db.execute.return_value = exec_result(scalar_one_or_none=existing)
        app.dependency_overrides[get_db] = lambda: mock_db

        with patch("app.services.google_drive_service.decrypt_token", return_value="raw"):
            with patch("app.services.google_drive_service.http") as mock_http:
                mock_http.post.return_value = MagicMock(ok=True)
                client = _get_client(mock_user)
                resp = client.post("/api/v1/integrations/google-drive/disconnect")

        app.dependency_overrides.pop(get_db, None)

        assert resp.status_code == 200
        assert resp.json()["status"] == "disconnected"
        assert existing.is_active is False
        assert existing.access_token is None
        assert existing.refresh_token is None


# ── backup endpoint guards ─────────────────────────────────────────────────────

class TestBackupExportGuards:
    def test_backup_requires_auth(self):
        """POST backup without JWT → 401."""
        client = _unauthed_client()
        resp = client.post(f"/api/v1/integrations/google-drive/backup-export/{uuid.uuid4()}")
        assert resp.status_code == 401

    def test_backup_rejects_other_users_export(self, mock_user):
        """User cannot backup another user's export → 403."""
        other_user_id = uuid.uuid4()
        export_req = MagicMock()
        export_req.id = uuid.uuid4()
        export_req.user_id = other_user_id   # different user
        export_req.status = "ready"

        from app.main import app
        from app.utils.database import get_db

        mock_db = MagicMock(spec=Session)
        mock_db.execute.return_value = exec_result(scalar_one_or_none=export_req)
        app.dependency_overrides[get_db] = lambda: mock_db

        client = _get_client(mock_user)
        resp = client.post(
            f"/api/v1/integrations/google-drive/backup-export/{export_req.id}"
        )
        app.dependency_overrides.pop(get_db, None)

        assert resp.status_code == 403

    def test_backup_rejects_export_not_ready(self, mock_user):
        """Export with status != ready → 400."""
        export_req = MagicMock()
        export_req.id = uuid.uuid4()
        export_req.user_id = mock_user.id
        export_req.status = "processing"

        from app.main import app
        from app.utils.database import get_db

        mock_db = MagicMock(spec=Session)
        mock_db.execute.return_value = exec_result(scalar_one_or_none=export_req)
        app.dependency_overrides[get_db] = lambda: mock_db

        client = _get_client(mock_user)
        resp = client.post(
            f"/api/v1/integrations/google-drive/backup-export/{export_req.id}"
        )
        app.dependency_overrides.pop(get_db, None)

        assert resp.status_code == 400

    def test_backup_rejects_missing_integration(self, mock_user):
        """Export is ready but no Drive integration → 400."""
        export_req = MagicMock()
        export_req.id = uuid.uuid4()
        export_req.user_id = mock_user.id
        export_req.status = "ready"

        from app.main import app
        from app.utils.database import get_db

        mock_db = MagicMock(spec=Session)
        mock_db.execute.side_effect = [
            exec_result(scalar_one_or_none=export_req),   # export lookup
            exec_result(scalar_one_or_none=None),          # integration → missing
        ]
        app.dependency_overrides[get_db] = lambda: mock_db

        client = _get_client(mock_user)
        resp = client.post(
            f"/api/v1/integrations/google-drive/backup-export/{export_req.id}"
        )
        app.dependency_overrides.pop(get_db, None)

        assert resp.status_code == 400
        assert "not connected" in resp.json()["detail"].lower()


# ── successful backup ─────────────────────────────────────────────────────────

class TestBackupExportSuccess:
    def test_backup_uploads_and_updates_metadata(self, mock_user, tmp_path):
        """Happy path: file found locally, uploaded to Drive, metadata updated."""
        export_id = uuid.uuid4()

        # Write a fake export file to a tmp path
        fake_zip = tmp_path / f"{export_id}.zip"
        fake_zip.write_bytes(b"PK fake zip content")

        export_req = MagicMock()
        export_req.id = export_id
        export_req.user_id = mock_user.id
        export_req.status = "ready"
        export_req.export_type = "full"
        export_req.metadata_ = {}
        export_req.file_url = None

        integration = MagicMock()
        integration.access_token = "ENC:acc"
        integration.refresh_token = None
        integration.token_expires_at = None

        from app.main import app
        from app.utils.database import get_db

        mock_db = MagicMock(spec=Session)
        mock_db.execute.side_effect = [
            exec_result(scalar_one_or_none=export_req),
            exec_result(scalar_one_or_none=integration),
        ]
        app.dependency_overrides[get_db] = lambda: mock_db

        drive_response = {"id": "drive_file_abc", "webViewLink": "https://drive.google.com/file/abc"}

        with patch("app.services.google_drive_service._TMP_DIR", tmp_path):
            with patch("app.services.google_drive_service.decrypt_token", return_value="raw_acc"):
                with patch("app.services.google_drive_service.http") as mock_http:
                    upload_resp = MagicMock(ok=True)
                    upload_resp.json.return_value = drive_response
                    mock_http.post.return_value = upload_resp

                    client = _get_client(mock_user)
                    resp = client.post(
                        f"/api/v1/integrations/google-drive/backup-export/{export_id}"
                    )
                    app.dependency_overrides.pop(get_db, None)

        assert resp.status_code == 200
        data = resp.json()
        assert data["google_drive_file_id"] == "drive_file_abc"
        assert data["google_drive_web_view_link"] == "https://drive.google.com/file/abc"

        # metadata updated on the export_req object
        assert export_req.metadata_["google_drive_file_id"] == "drive_file_abc"
        assert "backed_up_at" in export_req.metadata_
        mock_db.commit.assert_called_once()
