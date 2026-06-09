from sqlalchemy import (
    Column, String, Float, Integer,
    DateTime, ForeignKey
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.utils.database import Base
import uuid
from datetime import datetime

class EventProvider(Base):
    __tablename__ = "event_providers"

    id = Column(UUID(as_uuid=True),
        primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True),
        ForeignKey("unified_events.id",
        ondelete="CASCADE"))
    provider = Column(String(50), nullable=False)
    provider_event_id = Column(String(500))
    provider_url = Column(String(1000))
    affiliate_url = Column(String(1000))
    min_price = Column(Float)
    max_price = Column(Float)
    currency = Column(String(10))
    price_label = Column(String(200))
    availability = Column(String(50),
        default='available')
    tickets_remaining = Column(Integer)
    raw_data = Column(JSONB)
    last_updated = Column(DateTime,
        default=datetime.utcnow)
