import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.utils.database import Base

class LoungeChat(Base):
    __tablename__ = "lounge_chats"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    trip_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("trips.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )
    last_message_preview: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    wayra_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    wayra_off_since: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    members = relationship("LoungeMember", back_populates="chat", cascade="all, delete-orphan")


class LoungeMember(Base):
    __tablename__ = "lounge_members"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    chat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("lounge_chats.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    drive_backup_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    drive_backup_interval: Mapped[str] = mapped_column(String(20), default="24h", nullable=False)

    __table_args__ = (
        UniqueConstraint("chat_id", "user_id", name="uq_lounge_members_chat_user"),
    )

    chat = relationship("LoungeChat", back_populates="members")
    user = relationship("User", foreign_keys=[user_id])


class LoungeDriveSync(Base):
    __tablename__ = "lounge_drive_sync"

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
    chat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("lounge_chats.id", ondelete="CASCADE"),
        nullable=False,
    )
    drive_file_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "chat_id", name="uq_lounge_drive_sync_user_chat"),
    )

    user = relationship("User")
    chat = relationship("LoungeChat")
