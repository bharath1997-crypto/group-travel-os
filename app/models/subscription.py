"""
app/models/subscription.py — User subscription / billing plan (Phase 3)

plan values: free, pro, group
status values: active, cancelled, past_due
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.utils.database import Base

if TYPE_CHECKING:
    from app.models.user import User


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
        unique=True,
        index=True,
    )
    # free | pro | group
    plan: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="free",
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

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
