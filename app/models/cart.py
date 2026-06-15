import uuid
from datetime import datetime
from sqlalchemy import DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.utils.database import Base

class TravelCart(Base):
    __tablename__ = "travel_cart"

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
    item_type: Mapped[str] = mapped_column(String(50), nullable=False)
    item_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    item_name: Mapped[str] = mapped_column(String(500), nullable=False)
    item_image: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    item_category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    place_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    full_address: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    lat: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    lng: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    price_range: Mapped[str | None] = mapped_column(String(50), nullable=True)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    source: Mapped[str] = mapped_column(String(50), default="explore", nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    caption_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_by: Mapped[str | None] = mapped_column(String(50), nullable=True)
    added_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )
    notified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "item_type", "item_id", name="uq_user_item_type_id"),
    )

    user = relationship("User")
