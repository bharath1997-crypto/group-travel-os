"""
app/routes/integrations.py — Third-party integration endpoints

GET  /api/v1/integrations                                — List user's integrations
GET  /api/v1/integrations/google-calendar/connect        — Redirect to Google OAuth
GET  /api/v1/integrations/google-calendar/callback       — Handle OAuth callback
POST /api/v1/integrations/google-calendar/disconnect     — Disconnect integration
POST /api/v1/integrations/google-calendar/sync-trip/{trip_id} — Sync trip to calendar
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.services import google_calendar_service as gcal
from app.services import google_drive_service as gdrive
from app.utils.auth import get_current_user
from app.utils.database import get_db
from config import settings

router = APIRouter(prefix="/integrations", tags=["Integrations"])


# ── Integration list ──────────────────────────────────────────────────────────

@router.get(
    "",
    summary="List connected integrations for the current user",
)
def list_integrations(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> list[dict[str, Any]]:
    rows = gcal.list_integrations(db, current_user.id)
    return [
        {
            "id":              str(r.id),
            "provider":        r.provider,
            "is_active":       r.is_active,
            "scopes":          r.scopes or [],
            "last_synced_at":  r.last_synced_at.isoformat() if r.last_synced_at else None,
            "created_at":      r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


# ── Google Calendar connect ───────────────────────────────────────────────────

@router.get(
    "/google-calendar/connect",
    summary="Start Google Calendar OAuth — redirects to Google consent screen",
)
def google_calendar_connect(
    current_user=Depends(get_current_user),
) -> RedirectResponse:
    url = gcal.build_connect_url(current_user.id)
    return RedirectResponse(url, status_code=302)


# ── Google Calendar callback ──────────────────────────────────────────────────

@router.get(
    "/google-calendar/callback",
    summary="Google OAuth callback — exchanges code for tokens",
    include_in_schema=False,
)
def google_calendar_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
) -> RedirectResponse:
    gcal.handle_callback(db, code, state)
    frontend_url = settings.FRONTEND_URL
    return RedirectResponse(
        f"{frontend_url}/settings/data-integrations/google-calendar?connected=1",
        status_code=302,
    )


# ── Disconnect ────────────────────────────────────────────────────────────────

@router.post(
    "/google-calendar/disconnect",
    summary="Disconnect Google Calendar integration",
)
def google_calendar_disconnect(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> dict[str, str]:
    gcal.disconnect(db, current_user.id)
    return {"status": "disconnected"}


# ── Sync trip ─────────────────────────────────────────────────────────────────

@router.post(
    "/google-calendar/sync-trip/{trip_id}",
    summary="Create or update a Google Calendar event for a trip",
)
def sync_trip_to_calendar(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> dict[str, Any]:
    return gcal.sync_trip(db, current_user.id, trip_id)


# ── Google Drive — connect ────────────────────────────────────────────────────

@router.get(
    "/google-drive/connect",
    summary="Start Google Drive OAuth — redirects to Google consent screen",
)
def google_drive_connect(
    current_user=Depends(get_current_user),
) -> RedirectResponse:
    url = gdrive.build_connect_url(current_user.id)
    return RedirectResponse(url, status_code=302)


@router.get(
    "/google-drive/callback",
    summary="Google Drive OAuth callback",
    include_in_schema=False,
)
def google_drive_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
) -> RedirectResponse:
    gdrive.handle_callback(db, code, state)
    frontend_url = settings.FRONTEND_URL
    return RedirectResponse(
        f"{frontend_url}/settings/data-integrations/google-drive?connected=1",
        status_code=302,
    )


@router.post(
    "/google-drive/disconnect",
    summary="Disconnect Google Drive integration",
)
def google_drive_disconnect(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> dict[str, str]:
    gdrive.disconnect(db, current_user.id)
    return {"status": "disconnected"}


# ── Google Drive — backup export ──────────────────────────────────────────────

@router.post(
    "/google-drive/backup-export/{export_request_id}",
    summary="Upload a ready export file to Google Drive",
)
def backup_export_to_drive(
    export_request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> dict[str, Any]:
    return gdrive.backup_export(db, current_user.id, export_request_id)
