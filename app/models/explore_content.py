"""
app/models/explore_content.py — Model for caching generic Explore media (News, Shorts).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text
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
        index=True,  # e.g., "news", "shorts"
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

    def __repr__(self) -> str:
        return f"<ExploreContent id={self.id} city={self.city} type={self.content_type}>"
