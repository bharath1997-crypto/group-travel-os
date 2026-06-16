"""
app/services/microsoft_calendar_service.py — Microsoft Outlook Calendar OAuth + sync

OAuth flow (push-only, manual sync only):
  Scope: Calendars.ReadWrite offline_access
  (create/edit/delete only events created by this app — no mail, no OneDrive)

  1. build_connect_url(user_id) → redirect URL for Microsoft consent screen
  2. handle_callback(db, code, state) → stores encrypted tokens in user_integrations
  3. disconnect(db, user_id) → sets is_active=False, clears tokens
  4. sync_trip(db, user_id, trip_id) → creates/updates Outlook Calendar event

Microsoft Graph API endpoints:
  Auth:   https://login.microsoftonline.com/common/oauth2/v2.0/authorize
  Token:  https://login.microsoftonline.com/common/oauth2/v2.0/token
  Events: https://graph.microsoft.com/v1.0/me/events
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

# ── Microsoft endpoints ───────────────────────────────────────────────────────

_TENANT     = "common"
_AUTH_URL   = f"https://login.microsoftonline.com/{_TENANT}/oauth2/v2.0/authorize"
_TOKEN_URL  = f"https://login.microsoftonline.com/{_TENANT}/oauth2/v2.0/token"
_EVENTS_URL = "https://graph.microsoft.com/v1.0/me/events"
_SCOPE      = "Calendars.ReadWrite offline_access"
_PROVIDER   = "microsoft_calendar"


# ── Config helpers ────────────────────────────────────────────────────────────

def _client_id() -> str:
    from config import settings
    if not settings.MICROSOFT_CLIENT_ID:
        raise AppException.bad_request("Microsoft Calendar integration is not configured")
    return settings.MICROSOFT_CLIENT_ID


def _client_secret() -> str:
    from config import settings
    if not settings.MICROSOFT_CLIENT_SECRET:
        raise AppException.bad_request("Microsoft Calendar integration is not configured")
    return settings.MICROSOFT_CLIENT_SECRET


def _redirect_uri() -> str:
    from config import settings
    return settings.MICROSOFT_REDIRECT_URI


# ── OAuth helpers ─────────────────────────────────────────────────────────────

def build_connect_url(user_id: UUID) -> str:
    """Generate the Microsoft OAuth consent URL."""
    state = encrypt_state(str(user_id))
    params = {
        "client_id":     _client_id(),
        "redirect_uri":  _redirect_uri(),
        "response_type": "code",
        "scope":         _SCOPE,
        "response_mode": "query",
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
        logger.error("Microsoft token exchange failed: %s", resp.text)
        raise AppException.bad_request("Microsoft token exchange failed")

    _store_tokens(db, user_id, resp.json())
    return user_id


def _store_tokens(db: Session, user_id: UUID, token_data: dict[str, Any]) -> None:
    access_token  = token_data.get("access_token", "")
    refresh_token = token_data.get("refresh_token")
    expires_in    = int(token_data.get("expires_in", 3600))
    scope_str     = token_data.get("scope", _SCOPE)
    scopes        = scope_str.split() if scope_str else _SCOPE.split()
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
            "Microsoft Calendar token expired and no refresh token is stored. "
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
            "scope":         _SCOPE,
        },
        timeout=10,
    )
    if not resp.ok:
        raise AppException.bad_request("Failed to refresh Microsoft Calendar token")

    data      = resp.json()
    new_token = data["access_token"]
    expires_in = int(data.get("expires_in", 3600))

    integration.access_token     = encrypt_token(new_token)
    integration.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    db.commit()
    return new_token


def _get_valid_access_token(db: Session, integration: UserIntegration) -> str:
    if not integration.access_token:
        raise AppException.bad_request(
            "No access token stored. Please reconnect Microsoft Calendar."
        )
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

    # Microsoft doesn't have a simple token revocation endpoint (unlike Google).
    # We just clear the tokens and mark inactive.
    integration.is_active     = False
    integration.access_token  = None
    integration.refresh_token = None
    db.commit()


# ── Trip sync ─────────────────────────────────────────────────────────────────

def _build_event_body(trip: Trip) -> dict[str, Any]:
    from config import settings

    start: date = trip.start_date or date.today()
    end: date   = trip.end_date   or start
    # Microsoft Graph all-day events: end is exclusive, add 1 day
    end_plus_one = end + timedelta(days=1)

    description_parts = []
    if trip.description:
        description_parts.append(trip.description)
    status_str = trip.status.value if trip.status else "planning"
    description_parts.append(f"Status: {status_str}")
    trip_url = f"{settings.FRONTEND_URL}/trips/{trip.id}"
    description_parts.append(f"View on Rovvy: {trip_url}")

    return {
        "subject":  trip.title,
        "body": {
            "contentType": "text",
            "content":     "\n".join(description_parts),
        },
        "start": {
            "dateTime": f"{start.strftime('%Y-%m-%d')}T00:00:00",
            "timeZone": "UTC",
        },
        "end": {
            "dateTime": f"{end_plus_one.strftime('%Y-%m-%d')}T00:00:00",
            "timeZone": "UTC",
        },
        "isAllDay": True,
    }


def sync_trip(db: Session, user_id: UUID, trip_id: UUID) -> dict[str, Any]:
    """
    Create or update a Microsoft Outlook Calendar event for the given trip.
    Returns {"microsoft_event_id": ..., "action": "created" | "updated"}.
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
            UserIntegration.provider == _PROVIDER,
            UserIntegration.is_active == True,   # noqa: E712
        )
    ).scalar_one_or_none()
    if integration is None:
        raise AppException.bad_request(
            "Microsoft Calendar is not connected. Please connect your account first."
        )

    access_token = _get_valid_access_token(db, integration)
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type":  "application/json",
    }
    event_body = _build_event_body(trip)
    action     = "created"

    if trip.microsoft_calendar_event_id:
        # Update existing event
        resp = http.patch(
            f"{_EVENTS_URL}/{trip.microsoft_calendar_event_id}",
            headers=headers,
            json=event_body,
            timeout=15,
        )
        if resp.status_code == 404:
            trip.microsoft_calendar_event_id = None   # recreate below
        elif not resp.ok:
            raise AppException.bad_request(
                f"Microsoft Graph API error ({resp.status_code})"
            )
        else:
            event_id = resp.json()["id"]
            action   = "updated"

    if not trip.microsoft_calendar_event_id:
        resp = http.post(
            _EVENTS_URL,
            headers=headers,
            json=event_body,
            timeout=15,
        )
        if not resp.ok:
            raise AppException.bad_request(
                f"Microsoft Graph API error ({resp.status_code}): {resp.text[:200]}"
            )
        event_id = resp.json()["id"]
        action   = "created"

    trip.microsoft_calendar_event_id = event_id
    integration.last_synced_at       = datetime.now(timezone.utc)
    db.commit()

    return {
        "microsoft_event_id": event_id,
        "action":             action,
        "trip_id":            str(trip_id),
    }
