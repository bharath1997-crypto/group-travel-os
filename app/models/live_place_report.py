import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Enum as SAEnum, Float, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID

from app.utils.database import Base


class LivePlaceReportType(str, enum.Enum):
    long_line = "long_line"
    packed = "packed"
    quiet = "quiet"
    price_changed = "price_changed"
    closed_early = "closed_early"
    no_parking = "no_parking"


PLACE_REPORT_TTL_MINUTES = 120
PLACE_REPORT_CONFIRM_THRESHOLD = 3


class LivePlaceReport(Base):
    __tablename__ = "live_place_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporter_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    report_type = Column(SAEnum(LivePlaceReportType, name="liveplacereporttype"), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    place_name = Column(String(200), nullable=True)
    place_key = Column(String(200), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_live_place_reports_lat_lng", "lat", "lng"),
        Index("ix_live_place_reports_expires_at", "expires_at"),
        Index("ix_live_place_reports_place_key", "place_key"),
    )
