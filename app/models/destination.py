"""
app/models/destination.py — Curated travel destinations (Phase 3)

category values: beach, city, adventure, culture, nature
"""
from __future__ import annotations

import uuid

from sqlalchemy import Float, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.utils.database import Base


class Destination(Base):
    __tablename__ = "destinations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    country: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    trending_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
        index=True,
    )
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    best_months: Mapped[list[int] | None] = mapped_column(
        ARRAY(Integer),
        nullable=True,
    )
    avg_cost_per_day: Mapped[float | None] = mapped_column(Float, nullable=True)
