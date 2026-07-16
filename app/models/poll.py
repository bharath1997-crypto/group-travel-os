"""
app/models/poll.py — Polls, options, and votes
"""
from __future__ import annotations

import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import CheckConstraint, Date, DateTime, Enum, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.utils.database import Base


class PollType(str, enum.Enum):
    destination = "destination"
    date = "date"
    activity = "activity"
    custom = "custom"


class PollStatus(str, enum.Enum):
    open = "open"
    closed = "closed"
    resolved = "resolved"


class Poll(Base):
    __tablename__ = "polls"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("trips.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question: Mapped[str] = mapped_column(String(500), nullable=False)
    poll_type: Mapped[PollType] = mapped_column(
        Enum(PollType, name="poll_type", native_enum=True, create_constraint=True),
        nullable=False,
    )
    status: Mapped[PollStatus] = mapped_column(
        Enum(PollStatus, name="poll_status", native_enum=True, create_constraint=True),
        default=PollStatus.open,
        nullable=False,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    closes_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    resolved_option_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("poll_options.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    trip: Mapped["Trip"] = relationship("Trip", back_populates="polls")
    options: Mapped[list["PollOption"]] = relationship(
        "PollOption",
        back_populates="poll",
        foreign_keys="PollOption.poll_id",
        primaryjoin="Poll.id == PollOption.poll_id",
        cascade="all, delete-orphan",
    )
    creator: Mapped["User"] = relationship(
        "User",
        foreign_keys=[created_by],
    )
    resolved_option: Mapped["PollOption | None"] = relationship(
        "PollOption",
        foreign_keys=[resolved_option_id],
        primaryjoin="Poll.resolved_option_id == PollOption.id",
        uselist=False,
        viewonly=True,
    )


class PollOption(Base):
    __tablename__ = "poll_options"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    poll_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("polls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("locations.id", ondelete="SET NULL"),
        nullable=True,
    )
    label: Mapped[str] = mapped_column(String(300), nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    poll: Mapped["Poll"] = relationship(
        "Poll",
        back_populates="options",
        foreign_keys=[poll_id],
    )
    location: Mapped["Location | None"] = relationship(
        "Location",
        foreign_keys=[location_id],
    )
    votes: Mapped[list["Vote"]] = relationship(
        "Vote",
        back_populates="option",
        cascade="all, delete-orphan",
    )


class Vote(Base):
    __tablename__ = "votes"

    __table_args__ = (
        CheckConstraint(
            "(user_id IS NOT NULL AND guest_identifier IS NULL) "
            "OR (user_id IS NULL AND guest_identifier IS NOT NULL)",
            name="ck_votes_user_or_guest",
        ),
        Index(
            "uq_votes_poll_user",
            "poll_id",
            "user_id",
            unique=True,
            postgresql_where=text("user_id IS NOT NULL"),
        ),
        Index(
            "uq_votes_poll_guest",
            "poll_id",
            "guest_identifier",
            unique=True,
            postgresql_where=text("guest_identifier IS NOT NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    poll_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("polls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    option_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("poll_options.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    guest_identifier: Mapped[str | None] = mapped_column(String(64), nullable=True)
    voted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    option: Mapped["PollOption"] = relationship(
        "PollOption",
        back_populates="votes",
        foreign_keys=[option_id],
    )
    user: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[user_id],
        back_populates="votes",
    )
