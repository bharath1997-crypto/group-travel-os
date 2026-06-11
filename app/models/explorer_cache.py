import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.utils.database import Base


class ExplorerCache(Base):
    __tablename__ = "explorer_cache"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    cache_key: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    bbox: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    result_ids: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<ExplorerCache id={self.id} key={self.cache_key}>"
