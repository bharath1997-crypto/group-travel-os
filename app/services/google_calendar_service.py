"""
app/services/google_calendar_service.py — Google Calendar OAuth + event sync

OAuth flow (push-only, no bidirectional sync for MVP):
  1. build_connect_url(user_id) → redirect URL for Google consent screen
  2. handle_callback(db, code, state) → stores encrypted tokens in user_integrations
  3. disconnect(db, user_id) → sets is_active=False, clears tokens
  4. sync_trip(db, user_id, trip_id) → creates/updates a Google Calendar event

Google scope requested: https://www.googleapis.com/auth/calendar.events
(create/edit/delete only events created by this app — not full calendar read)
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode
from uuid import UUID

import requests as http
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.trip import Trip
from app.models.trip_roster import TripRoster
from app.models.user_integration import UserIntegration
from app.utils.encryption import decrypt_state, decrypt_token, encrypt_state, encrypt_token
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)

# ── Google endpoints ──────────────────────────────────────────────────────────

_AUTH_URL   = "https://accounts.google.com/o/oauth2/v2/auth"
_TOKEN_URL  = "https://oauth2.googleapis.com/token"
_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
_SCOPE      = "https://www.googleapis.com/auth/calendar.events"


# ── OAuth helpers ─────────────────────────────────────────────────────────────

def _client_id() -> str:
    from config import settings
    if not settings.GOOGLE_CLIENT_ID:
        raise AppException.bad_request("Google Calendar integration is not configured")
    return settings.GOOGLE_CLIENT_ID


def _client_secret() -> str:
    from config import settings
    if not settings.GOOGLE_CLIENT_SECRET:
        raise AppException.bad_request("Google Calendar integration is not configured")
    return settings.GOOGLE_CLIENT_SECRET


def _redirect_uri() -> str:
    from config import settings
    return settings.GOOGLE_CALENDAR_REDIRECT_URI


def build_connect_url(user_id: UUID) -> str:
    """Generate the Google OAuth consent URL. state encodes user_id for CSRF protection."""
    state = encrypt_state(str(user_id))
    params = {
        "client_id":     _client_id(),
        "redirect_uri":  _redirect_uri(),
        "response_type": "code",
        "scope":         _SCOPE,
        "access_type":   "offline",
        "prompt":        "consent",
        "state":         state,
    }
    return _AUTH_URL + "?" + urlencode(params)


def handle_callback(db: Session, code: str, state: str) -> UUID:
    """
    Exchange authorization code for tokens, store encrypted in user_integrations.
    Returns the authenticated user_id decoded from state.
    """
    try:
        user_id = UUID(decrypt_state(state))
    except Exception as exc:
        raise AppException.bad_request("Invalid OAuth state parameter") from exc

    # Exchange code for tokens
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
        logger.error("Google token exchange failed: %s", resp.text)
        raise AppException.bad_request("Google token exchange failed")

    token_data: dict[str, Any] = resp.json()
    _store_tokens(db, user_id, token_data)
    return user_id


def _store_tokens(db: Session, user_id: UUID, token_data: dict[str, Any]) -> None:
    access_token  = token_data.get("access_token", "")
    refresh_token = token_data.get("refresh_token")
    expires_in    = int(token_data.get("expires_in", 3600))
    scope_str     = token_data.get("scope", _SCOPE)
    scopes        = scope_str.split() if scope_str else [_SCOPE]

    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    existing = db.execute(
        select(UserIntegration).where(
            UserIntegration.user_id == user_id,
            UserIntegration.provider == "google_calendar",
        )
    ).scalar_one_or_none()

    if existing:
        existing.access_token = encrypt_token(access_token)
        if refresh_token:
            existing.refresh_token = encrypt_token(refresh_token)
        existing.token_expires_at = expires_at
        existing.scopes = scopes
        existing.is_active = True
    else:
        row = UserIntegration(
            user_id=user_id,
            provider="google_calendar",
            access_token=encrypt_token(access_token),
            refresh_token=encrypt_token(refresh_token) if refresh_token else None,
            token_expires_at=expires_at,
            scopes=scopes,
            is_active=True,
        )
        db.add(row)

    db.commit()


def _refresh_access_token(db: Session, integration: UserIntegration) -> str:
    """Refresh the access token and update the DB row. Returns new raw access token."""
    if not integration.refresh_token:
        raise AppException.bad_request(
            "Google Calendar token expired and no refresh token is stored. "
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
        raise AppException.bad_request("Failed to refresh Google Calendar token")

    data = resp.json()
    new_token = data["access_token"]
    expires_in = int(data.get("expires_in", 3600))

    integration.access_token = encrypt_token(new_token)
    integration.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    db.commit()
    return new_token


def _get_valid_access_token(db: Session, integration: UserIntegration) -> str:
    """Return a valid (possibly refreshed) access token."""
    if not integration.access_token:
        raise AppException.bad_request("No access token stored. Please reconnect Google Calendar.")

    expires_at = integration.token_expires_at
    if expires_at and datetime.now(timezone.utc) >= expires_at - timedelta(minutes=5):
        return _refresh_access_token(db, integration)

    return decrypt_token(integration.access_token)


# ── Disconnect ────────────────────────────────────────────────────────────────

def disconnect(db: Session, user_id: UUID) -> None:
    integration = db.execute(
        select(UserIntegration).where(
            UserIntegration.user_id == user_id,
            UserIntegration.provider == "google_calendar",
        )
    ).scalar_one_or_none()

    if not integration:
        return

    # Attempt to revoke token with Google (best-effort)
    if integration.access_token:
        try:
            raw = decrypt_token(integration.access_token)
            http.post(_REVOKE_URL, params={"token": raw}, timeout=5)
        except Exception:
            pass

    integration.is_active = False
    integration.access_token = None
    integration.refresh_token = None
    db.commit()


# ── List integrations ─────────────────────────────────────────────────────────

def list_integrations(db: Session, user_id: UUID) -> list[UserIntegration]:
    return list(
        db.execute(
            select(UserIntegration).where(UserIntegration.user_id == user_id)
        ).scalars().all()
    )


# ── Trip sync ─────────────────────────────────────────────────────────────────

def _build_event_body(trip: Trip) -> dict[str, Any]:
    from config import settings

    start: date = trip.start_date or date.today()
    end_date = trip.end_date or start
    end_plus_one = end_date + timedelta(days=1)   # Google Calendar all-day events are exclusive

    description_parts = []
    if trip.description:
        description_parts.append(trip.description)
    status_str = trip.status.value if trip.status else "planning"
    description_parts.append(f"Status: {status_str}")
    trip_url = f"{settings.FRONTEND_URL}/trips/{trip.id}"
    description_parts.append(f"View on Rovvy: {trip_url}")

    return {
        "summary":     trip.title,
        "description": "\n".join(description_parts),
        "start":       {"date": start.strftime("%Y-%m-%d")},
        "end":         {"date": end_plus_one.strftime("%Y-%m-%d")},
        "source": {
            "title": "Rovvy",
            "url":   trip_url,
        },
    }


def sync_trip(db: Session, user_id: UUID, trip_id: UUID) -> dict[str, Any]:
    """
    Create or update a Google Calendar event for the given trip.
    Requires the user to be on the trip roster and have an active Google Calendar integration.
    Returns {"google_event_id": ..., "action": "created" | "updated"}.
    """
    # Verify trip membership
    trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
    if trip is None:
        raise AppException.not_found("Trip not found")

    member = db.execute(
        select(TripRoster).where(
            TripRoster.trip_id == trip_id,
            TripRoster.user_id == user_id,
        )
    ).scalar_one_or_none()
    if member is None:
        raise AppException.forbidden("You are not a member of this trip")

    # Verify active integration
    integration = db.execute(
        select(UserIntegration).where(
            UserIntegration.user_id == user_id,
            UserIntegration.provider == "google_calendar",
            UserIntegration.is_active == True,   # noqa: E712
        )
    ).scalar_one_or_none()
    if integration is None:
        raise AppException.bad_request(
            "Google Calendar is not connected. Please connect your account first."
        )

    access_token = _get_valid_access_token(db, integration)
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    event_body = _build_event_body(trip)
    action = "created"

    if trip.google_calendar_event_id:
        # Update existing event
        resp = http.put(
            f"{_EVENTS_URL}/{trip.google_calendar_event_id}",
            headers=headers,
            json=event_body,
            timeout=15,
        )
        if resp.status_code == 404:
            # Event was deleted from Google — recreate
            trip.google_calendar_event_id = None
        elif not resp.ok:
            raise AppException.bad_request(
                f"Google Calendar API error ({resp.status_code})"
            )
        else:
            event_id = resp.json()["id"]
            action = "updated"

    if not trip.google_calendar_event_id:
        resp = http.post(
            _EVENTS_URL,
            headers=headers,
            json=event_body,
            timeout=15,
        )
        if not resp.ok:
            raise AppException.bad_request(
                f"Google Calendar API error ({resp.status_code}): {resp.text[:200]}"
            )
        event_id = resp.json()["id"]
        action = "created"

    trip.google_calendar_event_id = event_id
    integration.last_synced_at = datetime.now(timezone.utc)
    db.commit()

    return {"google_event_id": event_id, "action": action, "trip_id": str(trip_id)}
