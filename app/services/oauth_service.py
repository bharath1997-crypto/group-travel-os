"""
OAuth2 helpers for Google and Facebook sign-in / sign-up.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import time
from typing import Any
from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User
from app.utils.auth import create_access_token, hash_password
from app.utils.exceptions import AppException
from config import settings

logger = logging.getLogger(__name__)

GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v2/userinfo"

FACEBOOK_AUTH = "https://www.facebook.com/v21.0/dialog/oauth"
FACEBOOK_TOKEN = "https://graph.facebook.com/v21.0/oauth/access_token"
FACEBOOK_ME = "https://graph.facebook.com/v21.0/me"

# Login-only OAuth (intent=login): no account → frontend maps this code to a user-facing message.
OAUTH_EMAIL_NOT_REGISTERED = "oauth_email_not_registered"
# Network / Google unreachable / bad JSON — must be HTTPException detail (not bare Exception).
OAUTH_UPSTREAM_FAILED = "oauth_upstream_failed"


def oauth_redirect_uri(provider: str) -> str:
    p = provider.lower()
    return f"{settings.API_PUBLIC_URL.rstrip('/')}/api/v1/auth/oauth/{p}/callback"


def _oauth_diagnostics_enabled() -> bool:
    return os.getenv("OAUTH_DIAGNOSTICS", "").strip().lower() in ("1", "true", "yes")


def _google_secret_looks_like_json_blob(s: str) -> bool:
    """Secret Manager must store the GOCSPX-... string, not the downloaded JSON file."""
    t = s.strip()
    return len(t) > 0 and t[0] == "{"


def _upstream_oauth_error_message(response: httpx.Response, prefix: str) -> str:
    """Include provider error body when JSON (helps debug redirect_uri / invalid_client)."""
    try:
        err = response.json()
        if isinstance(err, dict):
            desc = err.get("error_description") or err.get("error")
            if isinstance(desc, str) and desc.strip():
                return f"{prefix}: {desc.strip()[:500]}"
    except (json.JSONDecodeError, ValueError, TypeError):
        pass
    return prefix


def _urlsafe_b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _urlsafe_b64decode(s: str) -> bytes:
    pad = 4 - len(s) % 4
    if pad != 4:
        s += "=" * pad
    return base64.urlsafe_b64decode(s)


def _decode_oauth_state_payload(raw: str) -> dict[str, Any]:
    """Parse signed OAuth state blob; raises HTTPException via AppException on failure."""
    try:
        obj = json.loads(_urlsafe_b64decode(raw).decode("utf-8"))
    except (json.JSONDecodeError, ValueError):
        AppException.bad_request("Invalid OAuth state payload")
        assert False  # AppException.bad_request always raises
    else:
        if not isinstance(obj, dict):
            AppException.bad_request("Invalid OAuth state payload")
        return obj


def sign_oauth_state(provider: str, oauth_intent: str = "login") -> str:
    if oauth_intent not in ("login", "signup"):
        oauth_intent = "login"
    payload = {
        "p": provider,
        "t": int(time.time()),
        "n": secrets.token_hex(8),
        "i": oauth_intent,
    }
    raw = _urlsafe_b64(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        raw.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:32]
    return f"{raw}.{sig}"


def verify_oauth_state(state: str, provider: str, max_age: int = 900) -> str:
    """Validate signed OAuth state; returns oauth intent: \"login\" or \"signup\"."""
    parts = state.rsplit(".", 1)
    if len(parts) != 2:
        AppException.bad_request("Invalid OAuth state")
    raw, sig = parts[0], parts[1]
    expect = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        raw.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:32]
    if not hmac.compare_digest(expect, sig):
        AppException.bad_request("Invalid OAuth state signature")
    payload = _decode_oauth_state_payload(raw)
    if payload.get("p") != provider:
        AppException.bad_request("OAuth provider mismatch")
    if int(time.time()) - int(payload.get("t", 0)) > max_age:
        AppException.bad_request("OAuth state expired — try again")
    intent = payload.get("i", "login")
    if intent not in ("login", "signup"):
        AppException.bad_request("Invalid OAuth state")
    return str(intent)


def google_authorize_url(oauth_intent: str = "login") -> str:
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        AppException.service_unavailable("Google sign-in is not configured")
    state = sign_oauth_state("google", oauth_intent)
    q = urlencode(
        {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": oauth_redirect_uri("google"),
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "online",
            "include_granted_scopes": "true",
            "prompt": "select_account",
        }
    )
    return f"{GOOGLE_AUTH}?{q}"


def facebook_authorize_url(oauth_intent: str = "login") -> str:
    if not settings.FACEBOOK_APP_ID or not settings.FACEBOOK_APP_SECRET:
        AppException.service_unavailable("Facebook sign-in is not configured")
    state = sign_oauth_state("facebook", oauth_intent)
    q = urlencode(
        {
            "client_id": settings.FACEBOOK_APP_ID,
            "redirect_uri": oauth_redirect_uri("facebook"),
            "response_type": "code",
            "state": state,
            "scope": "email,public_profile",
        }
    )
    return f"{FACEBOOK_AUTH}?{q}"


def _find_or_create_from_oauth(
    db: Session,
    *,
    email: str,
    full_name: str,
    avatar_url: str | None,
    google_sub: str | None,
    facebook_sub: str | None,
    allow_create: bool = True,
) -> tuple[User, bool]:
    email_l = email.lower().strip()

    if google_sub:
        u = db.execute(
            select(User).where(User.google_sub == google_sub)
        ).scalar_one_or_none()
        if u:
            if google_sub and avatar_url:
                u.profile_picture = avatar_url
            if avatar_url and not u.avatar_url:
                u.avatar_url = avatar_url
            u.is_verified = True
            db.commit()
            db.refresh(u)
            return u, False

    if facebook_sub:
        u = db.execute(
            select(User).where(User.facebook_sub == facebook_sub)
        ).scalar_one_or_none()
        if u:
            if avatar_url and not u.avatar_url:
                u.avatar_url = avatar_url
            u.is_verified = True
            db.commit()
            db.refresh(u)
            return u, False

    u = db.execute(select(User).where(User.email == email_l)).scalar_one_or_none()
    if u:
        if google_sub and u.google_sub and u.google_sub != google_sub:
            AppException.conflict("This email is linked to another Google account")
        if facebook_sub and u.facebook_sub and u.facebook_sub != facebook_sub:
            AppException.conflict("This email is linked to another Facebook account")
        if google_sub:
            u.google_sub = google_sub
            if avatar_url:
                u.profile_picture = avatar_url
        if facebook_sub:
            u.facebook_sub = facebook_sub
        u.is_verified = True
        if avatar_url and not u.avatar_url:
            u.avatar_url = avatar_url
        if full_name and (not u.full_name or u.full_name == "Traveler"):
            u.full_name = full_name[:120]
        db.commit()
        db.refresh(u)
        return u, False

    if not allow_create:
        AppException.bad_request(OAUTH_EMAIL_NOT_REGISTERED)

    u = User(
        email=email_l,
        hashed_password=hash_password(secrets.token_urlsafe(48)),
        full_name=full_name[:120] if full_name else email_l.split("@")[0][:120],
        google_sub=google_sub,
        facebook_sub=facebook_sub,
        is_verified=False,
        avatar_url=avatar_url,
        profile_picture=avatar_url if google_sub and avatar_url else None,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    logger.info("OAuth user created: %s", email_l)
    return u, True


def complete_google(
    db: Session, code: str, *, oauth_intent: str = "login"
) -> tuple[User, str, int, bool]:
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        AppException.service_unavailable("Google sign-in is not configured")
    redirect_uri = oauth_redirect_uri("google")
    sec = settings.GOOGLE_CLIENT_SECRET or ""
    if _google_secret_looks_like_json_blob(sec):
        logger.error(
            "GOOGLE_CLIENT_SECRET looks like JSON; use only the client_secret string (GOCSPX-...) from Google Credentials, not the whole JSON file."
        )
        AppException.bad_gateway(
            "Google OAuth misconfigured: client secret must be the plain GOCSPX-… value, not JSON"
        )
    if _oauth_diagnostics_enabled():
        cid = settings.GOOGLE_CLIENT_ID or ""
        logger.info(
            "Google OAuth diagnostics (complete_google): has_client_id=%s client_id_suffix=%s "
            "client_secret_len=%s redirect_uri=%s API_PUBLIC_URL=%s FRONTEND_URL=%s",
            bool(cid),
            cid[-12:] if len(cid) >= 12 else cid,
            len(sec),
            redirect_uri,
            settings.API_PUBLIC_URL,
            settings.FRONTEND_URL,
        )
    try:
        with httpx.Client(timeout=30.0) as client:
            tok = client.post(
                GOOGLE_TOKEN,
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            if tok.status_code != 200:
                logger.warning("Google token error: %s %s", tok.status_code, tok.text)
                AppException.bad_gateway(
                    _upstream_oauth_error_message(tok, "Google token exchange failed")
                )
            try:
                body: dict[str, Any] = tok.json()
            except ValueError:
                logger.warning("Google token response was not valid JSON")
                AppException.bad_gateway(OAUTH_UPSTREAM_FAILED)
            access = body.get("access_token")
            if not access:
                AppException.bad_gateway("Google did not return an access token")

            ui = client.get(
                GOOGLE_USERINFO,
                headers={"Authorization": f"Bearer {access}"},
            )
            if ui.status_code != 200:
                logger.warning("Google userinfo error: %s %s", ui.status_code, ui.text)
                AppException.bad_gateway("Google userinfo failed")
            try:
                info: dict[str, Any] = ui.json()
            except ValueError:
                logger.warning("Google userinfo response was not valid JSON")
                AppException.bad_gateway(OAUTH_UPSTREAM_FAILED)
    except httpx.HTTPError as e:
        logger.warning("Google OAuth HTTP error: %s", e)
        AppException.bad_gateway(OAUTH_UPSTREAM_FAILED)

    email_raw = info.get("email")
    if not email_raw:
        AppException.bad_request("Google did not return an email for this account")
    email = str(email_raw)
    sub = str(info.get("id", ""))
    if not sub:
        AppException.bad_request("Google did not return a user id")
    name = str(info.get("name") or info.get("given_name") or email.split("@")[0])
    picture = info.get("picture")
    pic_url = str(picture) if picture else None

    allow_create = oauth_intent == "signup"
    user, created = _find_or_create_from_oauth(
        db,
        email=email,
        full_name=name,
        avatar_url=pic_url,
        google_sub=sub,
        facebook_sub=None,
        allow_create=allow_create,
    )
    token, exp = create_access_token(user.id)
    return user, token, exp, created


def complete_facebook(
    db: Session, code: str, *, oauth_intent: str = "login"
) -> tuple[User, str, int, bool]:
    if not settings.FACEBOOK_APP_ID or not settings.FACEBOOK_APP_SECRET:
        AppException.service_unavailable("Facebook sign-in is not configured")
    redirect_uri = oauth_redirect_uri("facebook")
    try:
        with httpx.Client(timeout=30.0) as client:
            tok = client.get(
                FACEBOOK_TOKEN,
                params={
                    "client_id": settings.FACEBOOK_APP_ID,
                    "client_secret": settings.FACEBOOK_APP_SECRET,
                    "redirect_uri": redirect_uri,
                    "code": code,
                },
            )
            if tok.status_code != 200:
                logger.warning("Facebook token error: %s %s", tok.status_code, tok.text)
                AppException.bad_gateway(
                    _upstream_oauth_error_message(tok, "Facebook token exchange failed")
                )
            try:
                body: dict[str, Any] = tok.json()
            except ValueError:
                logger.warning("Facebook token response was not valid JSON")
                AppException.bad_gateway(OAUTH_UPSTREAM_FAILED)
            access = body.get("access_token")
            if not access:
                AppException.bad_gateway("Facebook did not return an access token")

            ui = client.get(
                FACEBOOK_ME,
                params={
                    "fields": "id,name,email,picture.type(large)",
                    "access_token": access,
                },
            )
            if ui.status_code != 200:
                logger.warning("Facebook me error: %s %s", ui.status_code, ui.text)
                AppException.bad_gateway("Facebook profile fetch failed")
            try:
                info: dict[str, Any] = ui.json()
            except ValueError:
                logger.warning("Facebook profile response was not valid JSON")
                AppException.bad_gateway(OAUTH_UPSTREAM_FAILED)
    except httpx.HTTPError as e:
        logger.warning("Facebook OAuth HTTP error: %s", e)
        AppException.bad_gateway(OAUTH_UPSTREAM_FAILED)

    sub = str(info.get("id", "")).strip()
    if not sub:
        AppException.bad_request("Facebook did not return a user id")
    email_raw = info.get("email")
    if not email_raw:
        AppException.bad_request(
            "Facebook did not return an email — add email to your Facebook account or use Google."
        )
    email = str(email_raw)
    name = str(info.get("name") or email.split("@")[0])
    pic_url: str | None = None
    pic = info.get("picture")
    if isinstance(pic, dict):
        data = pic.get("data")
        if isinstance(data, dict) and data.get("url"):
            pic_url = str(data["url"])

    allow_create = oauth_intent == "signup"
    user, created = _find_or_create_from_oauth(
        db,
        email=email,
        full_name=name,
        avatar_url=pic_url,
        google_sub=None,
        facebook_sub=sub,
        allow_create=allow_create,
    )
    token, exp = create_access_token(user.id)
    return user, token, exp, created
