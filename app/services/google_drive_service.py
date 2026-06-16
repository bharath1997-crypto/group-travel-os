"""
app/services/google_drive_service.py — Google Drive OAuth + export backup

OAuth flow (push-only — only creates files that Rovvy generated):
  Scope: https://www.googleapis.com/auth/drive.file
  (create/read/update/delete only files this app created — NOT full Drive access)

  1. build_connect_url(user_id) → redirect URL for Google consent screen
  2. handle_callback(db, code, state) → stores encrypted tokens in user_integrations
  3. disconnect(db, user_id) → sets is_active=False, clears tokens
  4. backup_export(db, user_id, export_request_id) → uploads export ZIP to Drive

Export file lookup strategy:
  1. Check /tmp/rovvy_exports/{request_id}.zip (local)
  2. If absent but GCS signed URL exists, download from GCS
  3. If neither, raise descriptive error
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from uuid import UUID

import requests as http
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.data_export import DataExportRequest
from app.models.user_integration import UserIntegration
from app.utils.encryption import decrypt_state, decrypt_token, encrypt_state, encrypt_token
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)

# ── Google endpoints ──────────────────────────────────────────────────────────

_AUTH_URL      = "https://accounts.google.com/o/oauth2/v2/auth"
_TOKEN_URL     = "https://oauth2.googleapis.com/token"
_REVOKE_URL    = "https://oauth2.googleapis.com/revoke"
_DRIVE_UPLOAD  = "https://www.googleapis.com/upload/drive/v3/files"
_DRIVE_SCOPE   = "https://www.googleapis.com/auth/drive.file"
_PROVIDER      = "google_drive"
_TMP_DIR       = Path("/tmp/rovvy_exports")


# ── Config helpers ────────────────────────────────────────────────────────────

def _client_id() -> str:
    from config import settings
    if not settings.GOOGLE_CLIENT_ID:
        raise AppException.bad_request("Google Drive integration is not configured")
    return settings.GOOGLE_CLIENT_ID


def _client_secret() -> str:
    from config import settings
    if not settings.GOOGLE_CLIENT_SECRET:
        raise AppException.bad_request("Google Drive integration is not configured")
    return settings.GOOGLE_CLIENT_SECRET


def _redirect_uri() -> str:
    from config import settings
    return settings.GOOGLE_DRIVE_REDIRECT_URI


# ── OAuth helpers ─────────────────────────────────────────────────────────────

def build_connect_url(user_id: UUID) -> str:
    """Generate the Google OAuth consent URL for Drive."""
    state = encrypt_state(str(user_id))
    params = {
        "client_id":     _client_id(),
        "redirect_uri":  _redirect_uri(),
        "response_type": "code",
        "scope":         _DRIVE_SCOPE,
        "access_type":   "offline",
        "prompt":        "consent",
        "state":         state,
    }
    return _AUTH_URL + "?" + urlencode(params)


def handle_callback(db: Session, code: str, state: str) -> UUID:
    """Exchange authorization code for tokens, store encrypted in user_integrations."""
    try:
        user_id = UUID(decrypt_state(state))
    except Exception as exc:
        raise AppException.bad_request("Invalid OAuth state parameter") from exc

    resp = http.post(
        _TOKEN_URL,
        data={
            "code":          code,
            "client_id":     _client_id(),
            "client_secret": _client_secret(),
            "redirect_uri":  _redirect_uri(),
            "grant_type":    "authorization_code",
        },
        timeout=10,
    )
    if not resp.ok:
        logger.error("Google Drive token exchange failed: %s", resp.text)
        raise AppException.bad_request("Google token exchange failed")

    _store_tokens(db, user_id, resp.json())
    return user_id


def _store_tokens(db: Session, user_id: UUID, token_data: dict[str, Any]) -> None:
    access_token  = token_data.get("access_token", "")
    refresh_token = token_data.get("refresh_token")
    expires_in    = int(token_data.get("expires_in", 3600))
    scope_str     = token_data.get("scope", _DRIVE_SCOPE)
    scopes        = scope_str.split() if scope_str else [_DRIVE_SCOPE]
    expires_at    = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    existing = db.execute(
        select(UserIntegration).where(
            UserIntegration.user_id == user_id,
            UserIntegration.provider == _PROVIDER,
        )
    ).scalar_one_or_none()

    if existing:
        existing.access_token    = encrypt_token(access_token)
        if refresh_token:
            existing.refresh_token = encrypt_token(refresh_token)
        existing.token_expires_at = expires_at
        existing.scopes           = scopes
        existing.is_active        = True
    else:
        db.add(UserIntegration(
            user_id=user_id,
            provider=_PROVIDER,
            access_token=encrypt_token(access_token),
            refresh_token=encrypt_token(refresh_token) if refresh_token else None,
            token_expires_at=expires_at,
            scopes=scopes,
            is_active=True,
        ))

    db.commit()


def _refresh_access_token(db: Session, integration: UserIntegration) -> str:
    if not integration.refresh_token:
        raise AppException.bad_request(
            "Google Drive token expired and no refresh token is stored. "
            "Please reconnect your account."
        )
    refresh_token = decrypt_token(integration.refresh_token)
    resp = http.post(
        _TOKEN_URL,
        data={
            "client_id":     _client_id(),
            "client_secret": _client_secret(),
            "refresh_token": refresh_token,
            "grant_type":    "refresh_token",
        },
        timeout=10,
    )
    if not resp.ok:
        raise AppException.bad_request("Failed to refresh Google Drive token")

    data = resp.json()
    new_token  = data["access_token"]
    expires_in = int(data.get("expires_in", 3600))

    integration.access_token     = encrypt_token(new_token)
    integration.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    db.commit()
    return new_token


def _get_valid_access_token(db: Session, integration: UserIntegration) -> str:
    if not integration.access_token:
        raise AppException.bad_request("No access token stored. Please reconnect Google Drive.")

    expires_at = integration.token_expires_at
    if expires_at and datetime.now(timezone.utc) >= expires_at - timedelta(minutes=5):
        return _refresh_access_token(db, integration)

    return decrypt_token(integration.access_token)


# ── Disconnect ────────────────────────────────────────────────────────────────

def disconnect(db: Session, user_id: UUID) -> None:
    integration = db.execute(
        select(UserIntegration).where(
            UserIntegration.user_id == user_id,
            UserIntegration.provider == _PROVIDER,
        )
    ).scalar_one_or_none()

    if not integration:
        return

    if integration.access_token:
        try:
            raw = decrypt_token(integration.access_token)
            http.post(_REVOKE_URL, params={"token": raw}, timeout=5)
        except Exception:
            pass

    integration.is_active     = False
    integration.access_token  = None
    integration.refresh_token = None
    db.commit()


# ── File retrieval ────────────────────────────────────────────────────────────

def _load_export_bytes(export_req: DataExportRequest) -> bytes:
    """
    Load the export file bytes.
    Priority: local /tmp file → GCS signed URL download.
    """
    local_path = _TMP_DIR / f"{export_req.id}.zip"
    if local_path.exists():
        return local_path.read_bytes()

    # Try GCS signed URL (file_url starts with https://storage.googleapis.com...)
    file_url = export_req.file_url or ""
    if file_url.startswith("https://"):
        try:
            resp = http.get(file_url, timeout=30)
            if resp.ok:
                return resp.content
        except Exception as exc:
            logger.warning("Failed to download export from GCS: %s", exc)

    raise AppException.not_found(
        "Export file is no longer available. Please generate a new export and try again."
    )


# ── Drive upload ──────────────────────────────────────────────────────────────

def _drive_filename(export_req: DataExportRequest) -> str:
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    export_type = export_req.export_type or "full"
    return f"rovvy-export-{export_type}-{date_str}.zip"


def backup_export(db: Session, user_id: UUID, export_request_id: UUID) -> dict[str, Any]:
    """
    Upload a ready export to the user's Google Drive.
    Returns {"google_drive_file_id": ..., "google_drive_web_view_link": ...}.
    """
    # 1. Fetch + authorise export
    export_req = db.execute(
        select(DataExportRequest).where(DataExportRequest.id == export_request_id)
    ).scalar_one_or_none()

    if export_req is None:
        raise AppException.not_found("Export request not found")
    if export_req.user_id != user_id:
        raise AppException.forbidden("You do not own this export")
    if export_req.status != "ready":
        raise AppException.bad_request(
            f"Export is not ready (status: {export_req.status}). "
            "Wait for the export to complete before backing up."
        )

    # 2. Verify active Drive integration
    integration = db.execute(
        select(UserIntegration).where(
            UserIntegration.user_id == user_id,
            UserIntegration.provider == _PROVIDER,
            UserIntegration.is_active == True,   # noqa: E712
        )
    ).scalar_one_or_none()

    if integration is None:
        raise AppException.bad_request(
            "Google Drive is not connected. Please connect your account first."
        )

    access_token = _get_valid_access_token(db, integration)

    # 3. Load file bytes
    file_bytes = _load_export_bytes(export_req)
    filename   = _drive_filename(export_req)

    # 4. Multipart upload to Google Drive
    file_metadata = json.dumps({
        "name":     filename,
        "mimeType": "application/zip",
        "description": f"Rovvy data export ({export_req.export_type})",
    })

    resp = http.post(
        _DRIVE_UPLOAD,
        params={"uploadType": "multipart", "fields": "id,webViewLink"},
        headers={"Authorization": f"Bearer {access_token}"},
        files={
            "metadata": ("metadata", file_metadata, "application/json; charset=UTF-8"),
            "file":     (filename, file_bytes, "application/zip"),
        },
        timeout=60,
    )

    if not resp.ok:
        raise AppException.bad_request(
            f"Google Drive upload failed ({resp.status_code}): {resp.text[:200]}"
        )

    drive_data = resp.json()
    file_id    = drive_data.get("id", "")
    view_link  = drive_data.get("webViewLink", "")

    # 5. Update export metadata
    meta = dict(export_req.metadata_ or {})
    meta.update({
        "google_drive_file_id":       file_id,
        "google_drive_web_view_link": view_link,
        "backed_up_at":               datetime.now(timezone.utc).isoformat(),
    })
    export_req.metadata_ = meta

    integration.last_synced_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "google_drive_file_id":       file_id,
        "google_drive_web_view_link": view_link,
    }
