"""
app/models/user_integration.py — Third-party OAuth integrations per user
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.utils.database import Base


class UserIntegration(Base):
    __tablename__ = "user_integrations"
    __table_args__ = (
        UniqueConstraint("user_id", "provider", name="uq_user_integrations_user_provider"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # e.g. "google_calendar"
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    # Encrypted with Fernet — never store raw tokens
    access_token: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    refresh_token: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Stored as JSON array ["scope1", "scope2"]
    scopes: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # Google sub / external account ID
    external_user_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])  # type: ignore[name-defined]
