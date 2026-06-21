import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID

from app.utils.database import Base


class SpectatorInvite(Base):
    __tablename__ = "spectator_invites"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("live_sessions.id"), nullable=False)
    host_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    invite_token = Column(String(64), unique=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    expires_at = Column(DateTime, nullable=False)
