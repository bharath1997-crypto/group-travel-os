"""Standalone flight checkout bookings (Duffel-backed, trip-link optional)."""
from __future__ import annotations

import enum
import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.utils.database import Base


class FlightBookingStatus(str, enum.Enum):
    draft = "draft"
    searched = "searched"
    offer_selected = "offer_selected"
    price_confirmed = "price_confirmed"
    travelers_completed = "travelers_completed"
    payment_pending = "payment_pending"
    payment_authorized = "payment_authorized"
    booking_pending = "booking_pending"
    reserved = "reserved"
    ticketing = "ticketing"
    confirmed = "confirmed"
    payment_failed = "payment_failed"
    booking_failed = "booking_failed"
    ticketing_failed = "ticketing_failed"
    cancellation_pending = "cancellation_pending"
    cancelled = "cancelled"
    refund_pending = "refund_pending"
    refunded = "refunded"


def _rovvy_reference() -> str:
    token = secrets.token_urlsafe(6).upper().replace("-", "").replace("_", "")[:6]
    return f"RVY-{token}"


class FlightBooking(Base):
    __tablename__ = "flight_bookings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    trip_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("trips.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    rovvy_reference: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        unique=True,
        default=_rovvy_reference,
    )
    provider: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="duffel",
        server_default=text("'duffel'"),
    )
    provider_offer_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    provider_order_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    airline_pnr: Mapped[str | None] = mapped_column(String(32), nullable=True)
    eticket_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[FlightBookingStatus] = mapped_column(
        Enum(
            FlightBookingStatus,
            name="flight_booking_status",
            native_enum=True,
            create_constraint=True,
        ),
        nullable=False,
        default=FlightBookingStatus.draft,
        server_default=text("'draft'"),
    )
    search_params: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    offer_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    priced_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    search_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="USD",
        server_default=text("'USD'"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    trip: Mapped["Trip | None"] = relationship("Trip", foreign_keys=[trip_id])
