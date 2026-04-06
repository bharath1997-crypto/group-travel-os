"""
app/utils/auth.py — JWT helpers and FastAPI auth dependency

Contains:
- Password hashing and verification
- JWT token creation and decoding
- get_current_user FastAPI dependency
"""
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.utils.database import get_db
from app.utils.exceptions import AppException
from config import settings

logger = logging.getLogger(__name__)

# ── Password hashing ──────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Returns a bcrypt hash of the password. Never store plaintext."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Returns True if plain matches the bcrypt hash."""
    try:
        return pwd_context.verify(plain, hashed)
    except Exception as exc:
        # Corrupt hash, bcrypt/passlib mismatch, or backend bugs — never 500 on login
        logger.warning("Password verification failed safely: %s", exc)
        return False


# ── JWT ───────────────────────────────────────────────────────────────────────
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def create_access_token(user_id: UUID) -> tuple[str, int]:
    """
    Creates a signed JWT access token.
    Returns (token_string, expires_in_seconds).
    """
    expires_in = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(user_id),
        "exp": int(expire.timestamp()),
        "type": "access",
    }
    token = jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return token, expires_in


def decode_token(token: str) -> dict:
    """
    Decodes and validates a JWT token.
    Raises 401 if invalid or expired.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError:
        AppException.unauthorized("Invalid or expired token")


# ── FastAPI dependency ────────────────────────────────────────────────────────
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """
    FastAPI dependency — validates JWT and returns the current User.

    Usage in any protected route:
        current_user = Depends(get_current_user)

    Raises 401 if token is missing, invalid, or expired.
    Raises 401 if user no longer exists or is inactive.
    """
    from app.models.user import User

    payload = decode_token(token)
    user_id = payload.get("sub")

    if not user_id:
        AppException.unauthorized("Token missing user ID")

    user = db.execute(
        select(User).where(
            User.id == UUID(user_id),
            User.is_active.is_(True),
        )
    ).scalar_one_or_none()

    if not user:
        AppException.unauthorized("User not found or inactive")

    return user
