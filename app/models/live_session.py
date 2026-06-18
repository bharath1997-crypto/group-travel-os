"""
Live coordination session tied to a trip (DB + Firebase RTDB sync).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.utils.database import Base

if TYPE_CHECKING:
    from app.models.trip import Trip
    from app.models.user import User
    from app.models.live_checklist import LiveChecklist


class LiveSession(Base):
    __tablename__ = "live_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("trips.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    started_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    session_code: Mapped[str] = mapped_column(String(8), unique=True, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pre_live")
    meet_radius_meters: Mapped[int] = mapped_column(Integer, nullable=False, default=200)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    mode: Mapped[str] = mapped_column(String(10), nullable=False, default="GROUP")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    trip: Mapped["Trip"] = relationship(
        "Trip",
        foreign_keys=[trip_id],
    )
    started_by_user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[started_by],
    )
    checklists: Mapped[list["LiveChecklist"]] = relationship(
        "LiveChecklist",
        back_populates="session",
        cascade="all, delete-orphan",
    )
