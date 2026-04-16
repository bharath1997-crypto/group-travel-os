"""
Email verification: issue token, send link, confirm from link.
"""
from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.email_service import send_plain_email, smtp_configured
from app.utils.exceptions import AppException
from config import settings

logger = logging.getLogger(__name__)


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def confirm_url_for_token(raw_token: str) -> str:
    """Public URL the user opens from email (hits API, then redirects to frontend)."""
    base = settings.API_PUBLIC_URL.rstrip("/")
    q = quote(raw_token, safe="")
    return f"{base}/api/v1/auth/verify-email/confirm?token={q}"


def send_verification_email(user: User, *, raw_token: str) -> None:
    link = confirm_url_for_token(raw_token)
    subject = f"Verify your email — {settings.APP_NAME}"
    body = (
        f"Hi {user.full_name},\n\n"
        f"Confirm this email address for your {settings.APP_NAME} account by opening the link below:\n\n"
        f"{link}\n\n"
        f"This link expires in {settings.EMAIL_VERIFICATION_TOKEN_HOURS} hours.\n\n"
        f"If you did not create an account, you can ignore this message.\n"
    )
    send_plain_email(to_addr=user.email, subject=subject, body=body)


def issue_token_and_persist(db: Session, user: User) -> str:
    """Generate token, store hash + expiry, return raw token for email body only."""
    raw = secrets.token_urlsafe(32)
    user.email_verification_token_hash = _hash_token(raw)
    user.email_verification_expires_at = datetime.now(timezone.utc) + timedelta(
        hours=settings.EMAIL_VERIFICATION_TOKEN_HOURS
    )
    db.commit()
    db.refresh(user)
    return raw


def request_verification_email(db: Session, user: User) -> None:
    if user.is_verified:
        AppException.bad_request("Email is already verified")
    if not smtp_configured():
        AppException.service_unavailable(
            "Email sending is not configured. Set SMTP_HOST and SMTP_FROM_EMAIL in the API environment."
        )
    raw = issue_token_and_persist(db, user)
    try:
        send_verification_email(user, raw_token=raw)
    except Exception:
        logger.exception("Failed to send verification email to %s", user.email)
        raise


def try_send_verification_on_register(db: Session, user: User) -> None:
    """After password registration — best-effort; does not fail registration."""
    if user.is_verified or not smtp_configured():
        return
    try:
        raw = issue_token_and_persist(db, user)
        send_verification_email(user, raw_token=raw)
    except Exception as e:
        logger.warning("Verification email not sent on register: %s", e)


def confirm_verification_token(db: Session, raw_token: str) -> User:
    if not raw_token or not raw_token.strip():
        AppException.bad_request("Invalid verification link")
    h = _hash_token(raw_token.strip())
    user = db.execute(
        select(User).where(User.email_verification_token_hash == h)
    ).scalar_one_or_none()
    if not user:
        AppException.bad_request("Invalid or expired verification link")
    exp = user.email_verification_expires_at
    if exp is not None and exp < datetime.now(timezone.utc):
        AppException.bad_request("Invalid or expired verification link")
    user.is_verified = True
    user.email_verification_token_hash = None
    user.email_verification_expires_at = None
    db.commit()
    db.refresh(user)
    logger.info("Email verified for user %s", user.email)
    return user
