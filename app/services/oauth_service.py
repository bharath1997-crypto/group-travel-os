"""
OAuth2 helpers for Google and Facebook sign-in / sign-up.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
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


def oauth_redirect_uri(provider: str) -> str:
    p = provider.lower()
    return f"{settings.API_PUBLIC_URL.rstrip('/')}/api/v1/auth/oauth/{p}/callback"


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


def sign_oauth_state(provider: str) -> str:
    payload = {
        "p": provider,
        "t": int(time.time()),
        "n": secrets.token_hex(8),
    }
    raw = _urlsafe_b64(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        raw.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:32]
    return f"{raw}.{sig}"


def verify_oauth_state(state: str, provider: str, max_age: int = 900) -> None:
    try:
        raw, sig = state.rsplit(".", 1)
    except ValueError:
        AppException.bad_request("Invalid OAuth state")
    expect = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        raw.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:32]
    if not hmac.compare_digest(expect, sig):
        AppException.bad_request("Invalid OAuth state signature")
    try:
        payload = json.loads(_urlsafe_b64decode(raw).decode("utf-8"))
    except (json.JSONDecodeError, ValueError):
        AppException.bad_request("Invalid OAuth state payload")
    if payload.get("p") != provider:
        AppException.bad_request("OAuth provider mismatch")
    if int(time.time()) - int(payload.get("t", 0)) > max_age:
        AppException.bad_request("OAuth state expired — try again")


def google_authorize_url() -> str:
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        AppException.service_unavailable("Google sign-in is not configured")
    state = sign_oauth_state("google")
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


def facebook_authorize_url() -> str:
    if not settings.FACEBOOK_APP_ID or not settings.FACEBOOK_APP_SECRET:
        AppException.service_unavailable("Facebook sign-in is not configured")
    state = sign_oauth_state("facebook")
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
) -> User:
    email_l = email.lower().strip()

    if google_sub:
        u = db.execute(
            select(User).where(User.google_sub == google_sub)
        ).scalar_one_or_none()
        if u:
            if avatar_url and not u.avatar_url:
                u.avatar_url = avatar_url
            u.is_verified = True
            db.commit()
            db.refresh(u)
            return u

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
            return u

    u = db.execute(select(User).where(User.email == email_l)).scalar_one_or_none()
    if u:
        if google_sub and u.google_sub and u.google_sub != google_sub:
            AppException.conflict("This email is linked to another Google account")
        if facebook_sub and u.facebook_sub and u.facebook_sub != facebook_sub:
            AppException.conflict("This email is linked to another Facebook account")
        if google_sub:
            u.google_sub = google_sub
        if facebook_sub:
            u.facebook_sub = facebook_sub
        u.is_verified = True
        if avatar_url and not u.avatar_url:
            u.avatar_url = avatar_url
        if full_name and (not u.full_name or u.full_name == "Traveler"):
            u.full_name = full_name[:120]
        db.commit()
        db.refresh(u)
        return u

    u = User(
        email=email_l,
        hashed_password=hash_password(secrets.token_urlsafe(48)),
        full_name=full_name[:120] if full_name else email_l.split("@")[0][:120],
        google_sub=google_sub,
        facebook_sub=facebook_sub,
        is_verified=True,
        avatar_url=avatar_url,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    logger.info("OAuth user created: %s", email_l)
    return u


def complete_google(db: Session, code: str) -> tuple[User, str, int]:
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        AppException.service_unavailable("Google sign-in is not configured")
    redirect_uri = oauth_redirect_uri("google")
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
            AppException.bad_gateway(_upstream_oauth_error_message(tok, "Google token exchange failed"))
        body: dict[str, Any] = tok.json()
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
        info: dict[str, Any] = ui.json()

    email = info.get("email")
    if not email:
        AppException.bad_request("Google did not return an email for this account")
    sub = str(info.get("id", ""))
    if not sub:
        AppException.bad_request("Google did not return a user id")
    name = str(info.get("name") or info.get("given_name") or email.split("@")[0])
    picture = info.get("picture")
    pic_url = str(picture) if picture else None

    user = _find_or_create_from_oauth(
        db,
        email=email,
        full_name=name,
        avatar_url=pic_url,
        google_sub=sub,
        facebook_sub=None,
    )
    token, exp = create_access_token(user.id)
    return user, token, exp


def complete_facebook(db: Session, code: str) -> tuple[User, str, int]:
    if not settings.FACEBOOK_APP_ID or not settings.FACEBOOK_APP_SECRET:
        AppException.service_unavailable("Facebook sign-in is not configured")
    redirect_uri = oauth_redirect_uri("facebook")
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
            AppException.bad_gateway(_upstream_oauth_error_message(tok, "Facebook token exchange failed"))
        body: dict[str, Any] = tok.json()
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
        info: dict[str, Any] = ui.json()

    sub = str(info.get("id", "")).strip()
    if not sub:
        AppException.bad_request("Facebook did not return a user id")
    email = info.get("email")
    if not email:
        AppException.bad_request(
            "Facebook did not return an email — add email to your Facebook account or use Google."
        )
    name = str(info.get("name") or email.split("@")[0])
    pic_url: str | None = None
    pic = info.get("picture")
    if isinstance(pic, dict):
        data = pic.get("data")
        if isinstance(data, dict) and data.get("url"):
            pic_url = str(data["url"])

    user = _find_or_create_from_oauth(
        db,
        email=str(email),
        full_name=name,
        avatar_url=pic_url,
        google_sub=None,
        facebook_sub=sub,
    )
    token, exp = create_access_token(user.id)
    return user, token, exp
