"""Trip booking checkout links and expense confirmation."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from duffel_api import Duffel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.booking import Booking, BookingProvider, BookingStatus
from app.models.trip import Trip, TripStatus
from app.models.user import User
from app.schemas.booking import BookingCreate
from app.services.expense_service import ExpenseService
from app.services.trip_service import TripService
from app.utils.exceptions import AppException
from config import settings

logger = logging.getLogger(__name__)


def _duffel_booking_url(provider_reference: str) -> str:
    return f"https://app.duffel.com/search/offers/{provider_reference}"


def _resolve_duffel_offer(provider_reference: str) -> str:
    api_key = (settings.duffel_api_key or "").strip()
    if not api_key:
        AppException.service_unavailable("Flight booking is not configured")

    client = Duffel(access_token=api_key)
    try:
        client.offers.get(provider_reference)
    except Exception as exc:
        logger.warning("Duffel offer lookup failed for %s: %s", provider_reference, exc)
        AppException.bad_request("Invalid or expired flight offer")

    return _duffel_booking_url(provider_reference)


class BookingService:

    @staticmethod
    def create_booking(
        db: Session,
        trip_id: uuid.UUID,
        actor: User,
        data: BookingCreate,
    ) -> Booking:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        if trip.status != TripStatus.locked:
            AppException.conflict("Trip must be locked before booking")

        TripService._verify_membership(db, trip.group_id, actor.id)

        ref = data.provider_reference.strip()
        if not ref:
            AppException.bad_request("provider_reference is required")

        booking_url = _resolve_duffel_offer(ref)
        currency = (data.currency or "USD").strip().upper()

        booking = Booking(
            trip_id=trip_id,
            created_by=actor.id,
            provider=BookingProvider.duffel,
            provider_reference=ref,
            status=BookingStatus.pending,
            booking_url=booking_url,
            amount=float(data.amount),
            currency=currency,
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)
        logger.info("Booking created: %s trip %s", booking.id, trip_id)
        return booking

    @staticmethod
    def confirm_booking(
        db: Session,
        booking_id: uuid.UUID,
        actor: User,
        *,
        note: str | None = None,
    ) -> Booking:
        booking = db.execute(
            select(Booking).where(Booking.id == booking_id)
        ).scalar_one_or_none()
        if not booking:
            AppException.not_found("Booking not found")

        if booking.status != BookingStatus.pending:
            AppException.conflict("Booking is not pending")

        initiator = db.execute(
            select(User).where(User.id == booking.created_by)
        ).scalar_one_or_none()
        if not initiator:
            AppException.not_found("Booking initiator not found")

        booking.status = BookingStatus.confirmed
        booking.updated_at = datetime.now(timezone.utc)
        db.flush()

        description = f"Booking - {booking.provider.value}"
        if note and note.strip():
            description = f"{description}: {note.strip()[:480]}"

        ExpenseService.add_expense(
            db,
            booking.trip_id,
            description,
            booking.amount,
            booking.currency,
            [],
            initiator,
            category="transport",
        )

        db.refresh(booking)
        logger.info("Booking confirmed: %s expense triggered", booking.id)
        return booking

    @staticmethod
    def list_trip_bookings(
        db: Session,
        trip_id: uuid.UUID,
        actor: User,
    ) -> list[Booking]:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        TripService._verify_membership(db, trip.group_id, actor.id)

        rows = db.execute(
            select(Booking)
            .where(Booking.trip_id == trip_id)
            .order_by(Booking.created_at.desc())
        ).scalars().all()
        return list(rows)
