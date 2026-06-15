from sqlalchemy import (
    Column, String, Float, Boolean,
    DateTime, Text
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.utils.database import Base
import uuid
from datetime import datetime

class UnifiedExperience(Base):
    __tablename__ = "unified_experiences"

    id = Column(UUID(as_uuid=True),
        primary_key=True, default=uuid.uuid4)
    canonical_title = Column(String(500),
        nullable=False)
    normalized_title = Column(String(500),
        nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    category = Column(String(100))
    subcategory = Column(String(100))
    image_url = Column(String(1000))
    venue_name = Column(String(500))
    venue_address = Column(String(500))
    city = Column(String(200))
    state_province = Column(String(200))
    country = Column(String(100))
    country_code = Column(String(10))
    lat = Column(Float)
    lng = Column(Float)
    start_datetime = Column(DateTime)
    end_datetime = Column(DateTime)
    timezone = Column(String(100))
    status = Column(String(50), default='active')
    is_free = Column(Boolean, default=False)
    min_price = Column(Float)
    max_price = Column(Float)
    currency = Column(String(10), default='USD')
    created_at = Column(DateTime,
        default=datetime.utcnow)
    updated_at = Column(DateTime,
        default=datetime.utcnow)
    last_synced_at = Column(DateTime,
        default=datetime.utcnow)
    dedup_hash = Column(String(64), unique=True)
