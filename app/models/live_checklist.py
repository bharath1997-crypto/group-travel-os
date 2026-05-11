"""
Per-member checklist acceptance for a live session.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.utils.database import Base


class LiveChecklist(Base):
    __tablename__ = "live_checklists"
    __table_args__ = (
        UniqueConstraint("session_id", "user_id", name="uq_live_checklists_session_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("live_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_accepted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    session: Mapped["LiveSession"] = relationship(
        "LiveSession",
        back_populates="checklists",
    )
    user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[user_id],
    )
