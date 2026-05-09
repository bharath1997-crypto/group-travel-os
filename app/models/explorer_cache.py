import uuid
from datetime import datetime, timezone
from typing import Any, List

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.utils.database import Base


class ExplorerCache(Base):
    """Structured cache table for the Explorer system to prevent fragmentation

    and allow granular invalidation.
    """
    __tablename__ = "explorer_cache"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Scoping (Allows separate invalidation for e.g., Chicago nightlife vs Chicago food)
    cache_scope: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True, default="explorer"
    )
    country_code: Mapped[str] = mapped_column(
        String(10), nullable=False, index=True
    )
    city_slug: Mapped[str] = mapped_column(
        String(120), nullable=False, index=True
    )
    module: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True  # e.g., "events", "places"
    )

    # Bucketing (Prevents fragmentation from exact lat/lon and exact radius)
    radius_bucket: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True
    )
    geo_bucket: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True  # e.g., "41.88,-87.63"
    )

    # Data
    data: Mapped[List[dict]] = mapped_column(
        JSONB, nullable=False, default=list
    )
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f"<ExplorerCache id={self.id} city={self.city_slug} module={self.module} bucket={self.radius_bucket}>"


# --- Bucketing Helpers ---

def get_radius_bucket(radius_meters: int) -> str:
    """Map exact radius to a bucket to prevent cache fragmentation."""
    # Common buckets in meters
    buckets = [1000, 5000, 10000, 25000, 50000]
    for b in buckets:
        if radius_meters <= b:
            return f"{b}m"
    return f"{buckets[-1]}m"  # Fallback to max bucket


def get_geo_bucket(lat: float, lon: float, precision: int = 2) -> str:
    """Map exact lat/lon to a grid bucket.
    
    Precision 2 is approx 1.1km resolution.
    Precision 1 is approx 11km.
    Using precision 2 for fine-grained local discovery without extreme fragmentation.
    """
    return f"{round(lat, precision)},{round(lon, precision)}"
