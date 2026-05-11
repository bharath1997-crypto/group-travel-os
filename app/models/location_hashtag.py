"""
app/models/location_hashtag.py
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.utils.database import Base


class LocationHashtag(Base):
    __tablename__ = "location_hashtags"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    country: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    state: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    city: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    landmark: Mapped[str | None] = mapped_column(String(200), nullable=True)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    hashtags: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    youtube_channel_ids: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="city", nullable=False)
    population: Mapped[int | None] = mapped_column(Integer, nullable=True)
    geonames_id: Mapped[str | None] = mapped_column(String(50), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
