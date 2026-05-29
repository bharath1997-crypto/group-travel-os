"""
app/models/explore_content.py — Model for caching generic Explore media (News, Shorts).
"""
from __future__ import annotations

import uuid
from datetime import datetime, date, timezone

from sqlalchemy import DateTime, String, Text, Float, Date
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.utils.database import Base


class ExploreContent(Base):
    __tablename__ = "explore_contents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    city: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
        index=True,
    )
    content_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,  # e.g., "news", "shorts", "ticketmaster_event"
    )
    # Storing the raw JSON payload to make it super flexible
    data: Mapped[list[dict]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
    )
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # Bulk Event cache fields
    event_id: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
        index=True,
    )
    title: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    category: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    venue_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    venue_lat: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    venue_lon: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    state: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    start_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
        index=True,
    )
    start_time: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    price_min: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    price_max: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    image_url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    ticket_url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    source: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        default="ticketmaster",
    )

    def __repr__(self) -> str:
        return f"<ExploreContent id={self.id} city={self.city} type={self.content_type} event_id={self.event_id}>"

