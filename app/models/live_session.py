import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from app.utils.database import Base
import enum

class LiveMode(str, enum.Enum):
    solo = "solo"
    group = "group"

class LiveSession(Base):
    __tablename__ = "live_sessions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=True)
    started_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    mode = Column(SAEnum(LiveMode), nullable=False, default=LiveMode.solo)
    is_active = Column(Boolean, default=True, nullable=False)
    started_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    ended_at = Column(DateTime, nullable=True)
