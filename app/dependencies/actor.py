"""Actor context for authenticated users and guest voters."""
from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.utils.auth import decode_token_optional
from app.utils.database import get_db
from app.utils.exceptions import AppException
from app.utils.guest_token import GUEST_TOKEN_SCOPE, decode_guest_token

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class ActorContext:
    user_id: UUID | None = None
    guest_identifier: str | None = None
    trip_id: UUID | None = None

    @property
    def is_guest(self) -> bool:
        return self.guest_identifier is not None


def get_current_actor(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> ActorContext:
    if credentials is None or not credentials.credentials:
        AppException.unauthorized("Invalid or missing credentials")

    token = credentials.credentials
    payload = decode_token_optional(token)
    if payload is None:
        AppException.unauthorized("Invalid or missing credentials")

    if payload.get("scope") == GUEST_TOKEN_SCOPE:
        guest_payload = decode_guest_token(token)
        return ActorContext(
            user_id=None,
            guest_identifier=str(guest_payload["guest_identifier"]),
            trip_id=UUID(str(guest_payload["trip_id"])),
        )

    user_id = payload.get("sub")
    if user_id:
        from app.models.user import User

        user = db.execute(
            select(User).where(
                User.id == UUID(user_id),
                User.is_active.is_(True),
            )
        ).scalar_one_or_none()
        if not user:
            AppException.unauthorized("Invalid or missing credentials")
        return ActorContext(user_id=user.id)

    AppException.unauthorized("Invalid or missing credentials")
