"""Web presence — last seen on group memberships."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models.group import GroupMember


class PresenceService:
    @staticmethod
    def touch_web_presence(db: Session, user_id: uuid.UUID) -> None:
        now = datetime.now(timezone.utc)
        db.execute(
            update(GroupMember)
            .where(GroupMember.user_id == user_id)
            .values(last_seen_at=now)
        )
        db.commit()
