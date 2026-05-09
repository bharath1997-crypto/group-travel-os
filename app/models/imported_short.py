"""
app/models/imported_short.py — Model for storing imported reels/shorts links and metadata.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.utils.database import Base


class ImportedShort(Base):
    __tablename__ = "imported_shorts"

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
    source: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="youtube",
        index=True,  # e.g., "youtube", "tiktok"
    )
    external_id: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=True,
    )
    url: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    thumbnail_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    hashtags: Mapped[list[str] | None] = mapped_column(
        ARRAY(String(100)),
        nullable=True,
    )
    likes_count: Mapped[int] = mapped_column(
        nullable=False,
        default=0,
    )
    reaction_counts: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        default=lambda: {"love": 0, "helpful": 0, "list": 0},
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f"<ImportedShort id={self.id} city={self.city} source={self.source}>"
