"""SQLAlchemy model for public.places_directory (Explore state/city pages)."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.utils.database import Base


class PlacesDirectoryRow(Base):
    __tablename__ = "places_directory"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    state_code: Mapped[str | None] = mapped_column(String(2), nullable=True)
    state_slug: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    lat: Mapped[float | None] = mapped_column(nullable=True)
    lng: Mapped[float | None] = mapped_column(nullable=True)
    population: Mapped[int | None] = mapped_column(Integer, nullable=True)
    wikidata_qid: Mapped[str | None] = mapped_column(Text, nullable=True)
    wikipedia_title: Mapped[str | None] = mapped_column(Text, nullable=True)
    wikipedia_extract: Mapped[str | None] = mapped_column(Text, nullable=True)
    wikipedia_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    wikipedia_fetched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[str] = mapped_column(Text, nullable=False, server_default="us_census_wikidata")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
