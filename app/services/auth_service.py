"""
app/services/auth_service.py — Authentication business logic

Rules:
- Session is always injected — never created here
- All errors raised via AppException
- Never return raw SQLAlchemy errors to the caller
"""
import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from config import settings

from app.models.user import User
from app.schemas.auth import UserCreate, UserUpdate, ChangePasswordRequest
from app.services.email_verification_service import try_send_verification_on_register
from app.utils.auth import hash_password, verify_password, create_access_token
from app.utils.email import send_email, smtp_configured
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)


def _hash_password_reset_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class AuthService:

    @staticmethod
    def register(db: Session, data: UserCreate) -> tuple[User, str, int]:
        """
        Creates a new user account.
        Raises 409 if email already registered.
        Returns (user, access_token, expires_in).
        """
        existing = db.execute(
            select(User).where(User.email == data.email.lower())
        ).scalar_one_or_none()

        if existing:
            AppException.conflict("An account with this email already exists")

        username_to_store: str | None = None
        if data.username is not None:
            stripped = data.username.strip()
            if stripped:
                username_to_store = stripped
                taken = db.execute(
                    select(User).where(User.username == username_to_store)
                ).scalar_one_or_none()
                if taken:
                    AppException.conflict("Username already taken")

        phone_to_store: str | None = None
        if data.phone is not None:
            p = data.phone.strip()
            if p:
                phone_to_store = p

        country_to_store: str | None = None
        if data.country is not None:
            c = data.country.strip()
            if c:
                country_to_store = c[:80]

        user = User(
            email=data.email.lower(),
            hashed_password=hash_password(data.password),
            full_name=data.full_name,
            username=username_to_store,
            phone=phone_to_store,
            country=country_to_store,
            date_of_birth=data.date_of_birth,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        try_send_verification_on_register(db, user)

        token, expires_in = create_access_token(user.id)
        logger.info("New user registered: %s", user.email)
        return user, token, expires_in

    @staticmethod
    def _user_by_email_or_username(db: Session, identifier: str) -> User | None:
        raw = identifier.strip()
        if not raw:
            return None
        lowered = raw.lower()
        return db.execute(
            select(User).where(
                or_(User.email == lowered, func.lower(User.username) == lowered)
            )
        ).scalar_one_or_none()

    @staticmethod
    def login(db: Session, email: str, password: str) -> tuple[User, str, int]:
        """
        Authenticates a user with email/username and password.
        Raises 401 for any failure — never reveal which field is wrong.
        Returns (user, access_token, expires_in).
        """
        user = AuthService._user_by_email_or_username(db, email)

        # Same error for wrong email OR wrong password — prevents user enumeration
        if not user or not verify_password(password, user.hashed_password):
            AppException.unauthorized("Invalid email or password")

        if not user.is_active:
            AppException.forbidden("Your account has been deactivated")

        token, expires_in = create_access_token(user.id)
        logger.info("User logged in: %s", user.email)
        return user, token, expires_in

    @staticmethod
    def get_profile(user: User) -> User:
        """Returns the current user. No DB query needed — user already loaded."""
        return user

    @staticmethod
    def update_profile(db: Session, user: User, data: UserUpdate) -> User:
        """Updates profile fields on the current user."""
        payload = data.model_dump(exclude_unset=True)
        if "username" in payload:
            raw = payload["username"]
            if raw is not None:
                stripped = raw.strip()
                if stripped:
                    taken = db.execute(
                        select(User).where(
                            User.username == stripped,
                            User.id != user.id,
                        )
                    ).scalar_one_or_none()
                    if taken:
                        AppException.conflict("Username already taken")
                    user.username = stripped
                else:
                    user.username = None
            else:
                user.username = None
            del payload["username"]
        if "phone" in payload:
            p = payload["phone"]
            user.phone = (p.strip() if isinstance(p, str) and p.strip() else None)
            del payload["phone"]
        if "country" in payload:
            c = payload["country"]
            user.country = c.strip() if isinstance(c, str) and c.strip() else None
            del payload["country"]
        if "recovery_email" in payload:
            r = payload["recovery_email"]
            if r is None or (isinstance(r, str) and not r.strip()):
                user.recovery_email = None
            else:
                user.recovery_email = str(r).strip().lower()
            del payload["recovery_email"]
        for field, value in payload.items():
            setattr(user, field, value)

        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def change_password(
        db: Session, user: User, data: ChangePasswordRequest
    ) -> None:
        """
        Changes the user's password.
        Raises 401 if old_password is wrong.
        """
        if not verify_password(data.old_password, user.hashed_password):
            AppException.unauthorized("Current password is incorrect")

        user.hashed_password = hash_password(data.new_password)
        db.commit()
        logger.info("Password changed for user: %s", user.email)

    @staticmethod
    def request_password_reset(db: Session, email: str) -> None:
        """
        If a user exists and SMTP is configured, issue a reset token and send email.
        No-op when email is unknown (caller still returns generic success).
        """
        normalized = (email or "").strip().lower()
        if not normalized:
            return
        user = db.execute(
            select(User).where(User.email == normalized)
        ).scalar_one_or_none()
        if not user:
            return
        if not smtp_configured():
            logger.warning("Password reset requested but SMTP is not configured")
            return
        raw = secrets.token_urlsafe(32)
        user.password_reset_token = _hash_password_reset_token(raw)
        user.password_reset_expires = datetime.now(timezone.utc) + timedelta(hours=1)
        db.commit()
        db.refresh(user)
        fe = settings.FRONTEND_URL.rstrip("/")
        link = f"{fe}/reset-password?token={quote(raw, safe='')}"
        subject = f"Reset your password — {settings.APP_NAME}"
        body = (
            f"Hi {user.full_name},\n\n"
            f"Use the link below to set a new password for your Travello account. "
            f"This link expires in 1 hour.\n\n"
            f"{link}\n\n"
            f"If you did not request this, you can ignore this email.\n"
        )
        try:
            send_email(to=user.email, subject=subject, body=body)
        except Exception:
            logger.exception("Failed to send password reset email to %s", user.email)

    @staticmethod
    def reset_password_with_token(db: Session, raw_token: str, new_password: str) -> None:
        """Set password from a valid reset token; clears token fields on success."""
        raw = (raw_token or "").strip()
        if not raw:
            AppException.bad_request("Invalid or expired reset link")
        if len(new_password) < 8:
            AppException.bad_request("Password must be at least 8 characters")
        h = _hash_password_reset_token(raw)
        user = db.execute(
            select(User).where(User.password_reset_token == h)
        ).scalar_one_or_none()
        if not user:
            AppException.bad_request("Invalid or expired reset link")
        exp = user.password_reset_expires
        if exp is None or exp < datetime.now(timezone.utc):
            AppException.bad_request("Invalid or expired reset link")
        user.hashed_password = hash_password(new_password)
        user.password_reset_token = None
        user.password_reset_expires = None
        db.commit()
        logger.info("Password reset via token for user: %s", user.email)
