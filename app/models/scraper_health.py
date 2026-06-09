from sqlalchemy import (
    Column, String, Integer,
    DateTime, Boolean, Text
)
from sqlalchemy.dialects.postgresql import UUID
from app.utils.database import Base
import uuid
from datetime import datetime

class ScraperHealth(Base):
    __tablename__ = "scraper_health"

    id = Column(UUID(as_uuid=True),
        primary_key=True, default=uuid.uuid4)
    provider = Column(String(50), nullable=False)
    status = Column(String(20), default='healthy')
    # Values: healthy, degraded, blocked, disabled
    last_success_at = Column(DateTime)
    last_failure_at = Column(DateTime)
    consecutive_failures = Column(Integer, default=0)
    last_error = Column(Text)
    events_fetched_today = Column(Integer, default=0)
    is_enabled = Column(Boolean, default=True)
    blocked_until = Column(DateTime)
    created_at = Column(DateTime,
        default=datetime.utcnow)
    updated_at = Column(DateTime,
        default=datetime.utcnow)
