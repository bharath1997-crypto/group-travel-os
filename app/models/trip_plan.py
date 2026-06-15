"""
app/models/trip_plan.py — Trip Plan model (Phase 4)
"""
from __future__ import annotations

import uuid
from sqlalchemy import ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.utils.database import Base


class TripPlan(Base):
    __tablename__ = "trip_plans"

    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("trips.id", ondelete="CASCADE"),
        primary_key=True,
    )
    plan_json: Mapped[dict] = mapped_column(JSON, nullable=False)

    trip = relationship("Trip")
