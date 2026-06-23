import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Float, Integer, ForeignKey, Enum as SAEnum, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.utils.database import Base
import enum

class ReportType(str, enum.Enum):
    accident = "accident"
    traffic = "traffic"
    closure = "closure"
    police = "police"
    pothole = "pothole"
    flood = "flood"
    construction = "construction"
    hazard = "hazard"
    stopped_vehicle = "stopped_vehicle"
    weather = "weather"

EXPIRY_MINUTES = {
    "police": 20,
    "traffic": 45,
    "accident": 60,
    "flood": 180,
    "closure": 180,
    "hazard": 60,
    "stopped_vehicle": 60,
    "pothole": 1440,
    "construction": 1440,
    "weather": 60,
}

class RoadReport(Base):
    __tablename__ = "road_reports"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporter_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    report_type = Column(SAEnum(ReportType), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    city = Column(String(120), nullable=True)
    description = Column(String(200), nullable=True)
    confirmed_count = Column(Integer, default=0, nullable=False)
    dismissed_count = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_road_reports_lat_lng", "lat", "lng"),
        Index("ix_road_reports_is_active", "is_active"),
        Index("ix_road_reports_expires_at", "expires_at"),
    )

class ReportConfirmation(Base):
    __tablename__ = "report_confirmations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id = Column(UUID(as_uuid=True), ForeignKey("road_reports.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    action = Column(String(10), nullable=False)  # "confirm" or "dismiss"
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("report_id", "user_id", name="uq_report_confirmation"),
    )
