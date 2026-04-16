"""
Trip roster — optional note per member per trip (shown on public preview when profile is public).
"""
from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.utils.database import Base

if TYPE_CHECKING:
    from app.models.trip import Trip
    from app.models.user import User


class TripRoster(Base):
    __tablename__ = "trip_roster"

    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("trips.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)

    trip: Mapped["Trip"] = relationship("Trip", back_populates="roster_entries")
    user: Mapped["User"] = relationship("User", back_populates="trip_roster_entries")

