"""
app/models/subscription.py — User subscription / billing plan (Phase 3 & Phase 4)

plan values: free, pro, group, pass_3day, pass_7day
status values: active, cancelled, past_due
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.utils.database import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.trip import Trip


class Subscription(Base):
    __tablename__ = "subscriptions"

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
    trip_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("trips.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    # free | pro | group | pass_3day | pass_7day
    plan: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="free",
    )
    plan_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    # active | cancelled | past_due
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="active",
    )
    stripe_customer_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )
    stripe_subscription_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    current_period_end: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    trip: Mapped["Trip"] = relationship("Trip", foreign_keys=[trip_id])
