"""
Email verification — thin wrappers around AuthService for route compatibility.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.auth_service import AuthService


def confirm_verification_token(db: Session, raw_token: str) -> User:
    """Legacy GET /auth/verify-email/confirm — same rules as POST /auth/verify-email."""
    return AuthService.verify_email(db, raw_token)


def request_verification_email(db: Session, user: User) -> None:
    """Authenticated resend — raises if already verified or send fails critically."""
    AuthService.resend_verification_for_logged_in_user(db, user)
