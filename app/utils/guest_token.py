"""Short-lived JWT tokens for guest poll voting."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from jose import JWTError, jwt

from app.utils.exceptions import AppException
from config import settings

GUEST_TOKEN_SCOPE = "vote_only"
GUEST_TOKEN_TYPE = "guest"
GUEST_TOKEN_EXPIRE_DAYS = 7


def create_guest_token(trip_id: UUID, guest_identifier: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=GUEST_TOKEN_EXPIRE_DAYS)
    payload = {
        "trip_id": str(trip_id),
        "guest_identifier": guest_identifier,
        "scope": GUEST_TOKEN_SCOPE,
        "type": GUEST_TOKEN_TYPE,
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_guest_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError:
        AppException.unauthorized("Invalid or expired token")

    if payload.get("scope") != GUEST_TOKEN_SCOPE:
        AppException.unauthorized("Invalid or expired token")
    if payload.get("type") != GUEST_TOKEN_TYPE:
        AppException.unauthorized("Invalid or expired token")

    trip_id = payload.get("trip_id")
    guest_identifier = payload.get("guest_identifier")
    if not trip_id or not guest_identifier:
        AppException.unauthorized("Invalid or expired token")

    return payload
