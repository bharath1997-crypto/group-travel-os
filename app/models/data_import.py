"""
app/models/data_import.py — User data import requests
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.utils.database import Base


class DataImportRequest(Base):
    __tablename__ = "data_import_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # "places" | "trips"
    import_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # "geojson" | "gpx" | "csv"
    format: Mapped[str] = mapped_column(String(20), nullable=False)
    # "preview" | "imported" | "failed"
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="preview")
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    total_items: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    valid_items: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duplicate_items: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_items: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Stores {"valid": [...], "duplicates": [...], "errors": [...]}
    preview_data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    imported_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    metadata_: Mapped[dict] = mapped_column(
        "metadata", JSON, nullable=False, default=dict
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])  # type: ignore[name-defined]
