import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, JSON
from sqlalchemy.dialects.postgresql import UUID

from app.utils.database import Base


class TripTrack(Base):
    __tablename__ = "trip_tracks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    session_id = Column(UUID(as_uuid=True), ForeignKey("live_sessions.id"), nullable=False)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=True)
    track_points = Column(JSON, nullable=False, default=list)
    total_distance_m = Column(Float, nullable=True)
    total_duration_s = Column(Integer, nullable=True)
    max_speed_mph = Column(Float, nullable=True)
    avg_speed_mph = Column(Float, nullable=True)
    reports_encountered = Column(Integer, default=0)
    cameras_passed = Column(Integer, default=0)
    started_at = Column(DateTime, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    created_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
