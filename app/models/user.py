"""
app/models/user.py — User model

The core identity table. Every other model references this.
No relationships defined here yet — added incrementally as other models are built.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.utils.database import Base

if TYPE_CHECKING:
    from app.models.expense import ExpenseSplit
    from app.models.group import GroupMember
    from app.models.location import Location
    from app.models.poll import Vote
    from app.models.trip import Trip
    from app.models.trip_roster import TripRoster


class User(Base):
    __tablename__ = "users"

    # ── Primary key ───────────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # ── Identity ──────────────────────────────────────────────────────────────
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    full_name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )
    username: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        unique=True,
        index=True,
    )
    google_sub: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        unique=True,
        index=True,
    )
    facebook_sub: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        unique=True,
        index=True,
    )
    # May store http(s) URLs or inline data: URLs (upload preview); unbounded in DB.
    avatar_url: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    # URL from the identity provider (e.g. Google `picture`); may differ from avatar_url.
    profile_picture: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    phone: Mapped[str | None] = mapped_column(
        String(32),
        nullable=True,
    )
    country: Mapped[str | None] = mapped_column(
        String(80),
        nullable=True,
    )
    date_of_birth: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    recovery_email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    instagram_handle: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    fcm_token: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
        index=True,
    )

    # ── Flags ─────────────────────────────────────────────────────────────────
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    # False until email verification; linking an existing account via OAuth sets True.
    # Optional future: scheduled job may purge stale unverified rows after N days (never on logout).
    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    # When False, name/avatar are hidden on public trip previews (counts still shown).
    profile_public: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    email_verification_token_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        index=True,
    )
    email_verification_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    password_reset_token: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        index=True,
    )
    password_reset_expires: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    # Plaintext token for inbox links (POST /auth/verify-email); legacy hash in email_verification_token_hash
    verification_token: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )
    verification_token_expires: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    group_memberships: Mapped[list["GroupMember"]] = relationship(
        "GroupMember",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    created_trips: Mapped[list["Trip"]] = relationship(
        "Trip",
        foreign_keys="Trip.created_by",
        back_populates="creator",
    )
    saved_locations: Mapped[list["Location"]] = relationship(
        "Location",
        foreign_keys="Location.saved_by",
        back_populates="saved_by_user",
        cascade="all, delete-orphan",
    )
    votes: Mapped[list["Vote"]] = relationship(
        "Vote",
        foreign_keys="Vote.user_id",
        back_populates="user",
    )
    expense_splits: Mapped[list["ExpenseSplit"]] = relationship(
        "ExpenseSplit",
        foreign_keys="ExpenseSplit.user_id",
        back_populates="user",
    )
    trip_roster_entries: Mapped[list["TripRoster"]] = relationship(
        "TripRoster",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email}>"
