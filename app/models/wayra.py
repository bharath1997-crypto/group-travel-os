import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.utils.database import Base


class WayraPersonalMemory(Base):
    __tablename__ = "wayra_personal_memory"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    memory_type: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    wayra_visible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    user = relationship("User", foreign_keys=[user_id])


class WayraGroupSettings(Base):
    __tablename__ = "wayra_group_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("groups.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    wayra_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    turned_off_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    turned_off_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    turned_on_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    turned_on_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    group = relationship("Group", foreign_keys=[group_id])
    off_by = relationship("User", foreign_keys=[turned_off_by])
    on_by = relationship("User", foreign_keys=[turned_on_by])


class WayraGroupMemory(Base):
    __tablename__ = "wayra_group_memory"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("groups.id", ondelete="CASCADE"),
        nullable=False,
    )
    memory_type: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    wayra_visible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    group = relationship("Group", foreign_keys=[group_id])


class WayraKnowledgeIntent(Base):
    """Canonical Wayra knowledge intent with an approved answer strategy."""

    __tablename__ = "wayra_knowledge_intents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    intent_key: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    canonical_question: Mapped[str] = mapped_column(Text, nullable=False)
    # static | template | handler
    answer_strategy: Mapped[str] = mapped_column(String(20), nullable=False)
    answer_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    # where_am_i | what_can_i_do_here | page_help | None
    handler_key: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # none | page | gps | pin | page_or_gps
    required_context: Mapped[str] = mapped_column(
        String(30), nullable=False, default="none"
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    utterances = relationship(
        "WayraKnowledgeUtterance",
        back_populates="intent",
        cascade="all, delete-orphan",
    )


class WayraKnowledgeUtterance(Base):
    """Realistic wording variant that maps to a canonical intent."""

    __tablename__ = "wayra_knowledge_utterances"
    __table_args__ = (
        UniqueConstraint(
            "intent_id",
            "normalized_text",
            name="uq_wayra_knowledge_utterance_intent_norm",
        ),
        Index("ix_wayra_knowledge_utterances_normalized_text", "normalized_text"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    intent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("wayra_knowledge_intents.id", ondelete="CASCADE"),
        nullable=False,
    )
    utterance_text: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_text: Mapped[str] = mapped_column(String(500), nullable=False)
    style_tag: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    intent = relationship("WayraKnowledgeIntent", back_populates="utterances")


class WayraUnmatchedQuestion(Base):
    """Sanitized unmatched wording for review — never stores GPS or full context."""

    __tablename__ = "wayra_unmatched_questions"
    __table_args__ = (
        UniqueConstraint("text_hash", name="uq_wayra_unmatched_text_hash"),
        Index("ix_wayra_unmatched_occurrence_count", "occurrence_count"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    sanitized_text: Mapped[str] = mapped_column(Text, nullable=False)
    text_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    page_category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    proposed_intent_key: Mapped[str | None] = mapped_column(String(80), nullable=True)
    proposed_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    occurrence_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
