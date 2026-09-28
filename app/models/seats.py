"""Seats — intercity ride sharing models."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.utils.database import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    make: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(Text, nullable=False)
    plate: Mapped[str] = mapped_column(Text, nullable=False)
    mileage_kmpl: Mapped[float] = mapped_column(Numeric(4, 1), nullable=False)
    seats: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )


class FuelPrice(Base):
    __tablename__ = "fuel_prices"

    region_code: Mapped[str] = mapped_column(Text, primary_key=True)
    effective_from: Mapped[date] = mapped_column(Date, primary_key=True)
    fuel_rate_paise_per_l: Mapped[int] = mapped_column(Integer, nullable=False)
    toll_fallback_paise_per_km: Mapped[int] = mapped_column(Integer, nullable=False, default=150)


class ConnectionPath(Base):
    __tablename__ = "connection_paths"

    viewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    target_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    via_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    hops: Mapped[int] = mapped_column(SmallInteger, nullable=False)


class Ride(Base):
    __tablename__ = "rides"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    driver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vehicle_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("vehicles.id", ondelete="SET NULL"), nullable=True
    )
    region_code: Mapped[str] = mapped_column(Text, nullable=False, default="IN-MH")
    depart_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    arrive_est_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    seats_offered: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    seats_taken: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    visibility: Mapped[str] = mapped_column(String(10), nullable=False)
    approval: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="open")
    distance_km: Mapped[float] = mapped_column(Numeric(7, 2), nullable=False)
    cost_total_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    max_per_seat_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    price_per_seat_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    cost_basis: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    driver_cancel_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    stops: Mapped[list["RideStop"]] = relationship(
        "RideStop", back_populates="ride", cascade="all, delete-orphan", order_by="RideStop.seq"
    )
    bookings: Mapped[list["RideBooking"]] = relationship(
        "RideBooking", back_populates="ride", cascade="all, delete-orphan"
    )


class RideStop(Base):
    __tablename__ = "ride_stops"

    ride_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rides.id", ondelete="CASCADE"), primary_key=True
    )
    seq: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    eta: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    ride: Mapped["Ride"] = relationship("Ride", back_populates="stops")


class RideBooking(Base):
    __tablename__ = "ride_bookings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    ride_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rides.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rider_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    seats: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    board_seq: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    alight_seq: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    trust_path: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    ride: Mapped["Ride"] = relationship("Ride", back_populates="bookings")


class RideWatch(Base):
    __tablename__ = "ride_watches"
    __table_args__ = (UniqueConstraint("user_id", "geohash_key", "date_from"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    from_lat: Mapped[float] = mapped_column(Float, nullable=False)
    from_lon: Mapped[float] = mapped_column(Float, nullable=False)
    to_lat: Mapped[float] = mapped_column(Float, nullable=False)
    to_lon: Mapped[float] = mapped_column(Float, nullable=False)
    from_label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    to_label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    geohash_key: Mapped[str] = mapped_column(String(32), nullable=False)
    radius_m: Mapped[int] = mapped_column(Integer, nullable=False, default=25000)
    date_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    date_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    seats: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_alert_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )


class SplitEntry(Base):
    __tablename__ = "split_entries"
    __table_args__ = (UniqueConstraint("source_type", "source_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("groups.id", ondelete="SET NULL"), nullable=True
    )
    from_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    to_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[str] = mapped_column(String(40), nullable=False)
    source_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
