"""Tests for trip bookings (Gap 2)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.dependencies.authz import require_trip_admin
from app.models.booking import Booking, BookingProvider, BookingStatus
from app.models.group import GroupMember, MemberRole
from app.models.trip import Trip, TripStatus
from app.models.user import User
from app.schemas.booking import BookingCreate
from app.services.booking_service import BookingService
from tests.conftest import exec_result


def _member(gid: uuid.UUID, uid: uuid.UUID) -> GroupMember:
    return GroupMember(group_id=gid, user_id=uid, role=MemberRole.member)


def _locked_trip(*, creator_id: uuid.UUID | None = None) -> Trip:
    gid = uuid.uuid4()
    creator = creator_id or uuid.uuid4()
    return Trip(
        id=uuid.uuid4(),
        group_id=gid,
        title="Trip",
        status=TripStatus.locked,
        created_by=creator,
    )


@patch("app.services.booking_service._resolve_duffel_offer", return_value="https://duffel.example/offer")
def test_create_booking_success(mock_resolve, db, mock_user):
    mock_user.id = uuid.uuid4()
    trip = _locked_trip()
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),
        exec_result(scalar_one_or_none=_member(trip.group_id, mock_user.id)),
    ]

    data = BookingCreate(
        provider_reference="off_123",
        amount=450.0,
        currency="USD",
    )
    out = BookingService.create_booking(db, trip.id, mock_user, data)

    assert out.status == BookingStatus.pending
    assert out.provider == BookingProvider.duffel
    assert out.provider_reference == "off_123"
    assert out.booking_url == "https://duffel.example/offer"
    assert out.created_by == mock_user.id
    mock_resolve.assert_called_once_with("off_123")
    db.commit.assert_called_once()


def test_create_booking_requires_locked_trip(db, mock_user):
    mock_user.id = uuid.uuid4()
    trip = _locked_trip()
    trip.status = TripStatus.planning
    db.execute.return_value = exec_result(scalar_one_or_none=trip)

    with pytest.raises(HTTPException) as ei:
        BookingService.create_booking(
            db,
            trip.id,
            mock_user,
            BookingCreate(provider_reference="off_1", amount=100.0),
        )
    assert ei.value.status_code == 409


def test_create_booking_requires_membership(db, mock_user):
    mock_user.id = uuid.uuid4()
    trip = _locked_trip()
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),
        exec_result(scalar_one_or_none=None),
    ]

    with pytest.raises(HTTPException) as ei:
        BookingService.create_booking(
            db,
            trip.id,
            mock_user,
            BookingCreate(provider_reference="off_1", amount=100.0),
        )
    assert ei.value.status_code == 403


@pytest.mark.asyncio
async def test_confirm_booking_forbidden_non_admin(db, mock_user):
    creator_id = uuid.uuid4()
    mock_user.id = uuid.uuid4()
    trip_id = uuid.uuid4()
    booking_id = uuid.uuid4()
    trip = Trip(
        id=trip_id,
        group_id=uuid.uuid4(),
        title="T",
        status=TripStatus.locked,
        created_by=creator_id,
    )
    db.execute.side_effect = [
        exec_result(
            scalar_one_or_none=Booking(
                id=booking_id,
                trip_id=trip_id,
                created_by=creator_id,
                provider=BookingProvider.duffel,
                provider_reference="off_1",
                amount=100.0,
                currency="USD",
            )
        ),
        exec_result(scalar_one_or_none=trip),
        exec_result(scalar_one_or_none=None),
    ]

    with pytest.raises(HTTPException) as ei:
        await require_trip_admin(
            booking_id=booking_id,
            current_user=mock_user,
            db=db,
        )
    assert ei.value.status_code == 403


@patch("app.services.booking_service.ExpenseService.add_expense")
def test_confirm_booking_success_creates_expense(mock_add_expense, db, mock_user):
    initiator_id = uuid.uuid4()
    mock_user.id = uuid.uuid4()
    trip_id = uuid.uuid4()
    booking = Booking(
        id=uuid.uuid4(),
        trip_id=trip_id,
        created_by=initiator_id,
        provider=BookingProvider.duffel,
        provider_reference="off_99",
        status=BookingStatus.pending,
        booking_url="https://duffel.example/offer",
        amount=320.0,
        currency="USD",
    )
    initiator = User(
        id=initiator_id,
        email="booker@example.com",
        full_name="Booker",
        hashed_password="x",
        is_active=True,
    )
    object.__setattr__(initiator, "created_at", datetime.now(timezone.utc))

    db.execute.side_effect = [
        exec_result(scalar_one_or_none=booking),
        exec_result(scalar_one_or_none=initiator),
    ]

    out = BookingService.confirm_booking(db, booking.id, mock_user)

    assert out.status == BookingStatus.confirmed
    mock_add_expense.assert_called_once()
    call = mock_add_expense.call_args
    assert call.args[1] == trip_id
    assert call.args[6] is initiator
    assert call.kwargs.get("category") == "transport"


def test_confirm_booking_conflict_not_pending(db, mock_user):
    booking = Booking(
        id=uuid.uuid4(),
        trip_id=uuid.uuid4(),
        created_by=uuid.uuid4(),
        provider=BookingProvider.duffel,
        provider_reference="off_1",
        status=BookingStatus.confirmed,
        booking_url="https://duffel.example/offer",
        amount=100.0,
        currency="USD",
    )
    db.execute.return_value = exec_result(scalar_one_or_none=booking)

    with pytest.raises(HTTPException) as ei:
        BookingService.confirm_booking(db, booking.id, mock_user)
    assert ei.value.status_code == 409


def test_list_bookings_for_trip(db, mock_user):
    mock_user.id = uuid.uuid4()
    trip = _locked_trip()
    booking = Booking(
        id=uuid.uuid4(),
        trip_id=trip.id,
        created_by=mock_user.id,
        provider=BookingProvider.duffel,
        provider_reference="off_1",
        status=BookingStatus.pending,
        booking_url="https://duffel.example/offer",
        amount=200.0,
        currency="USD",
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),
        exec_result(scalar_one_or_none=_member(trip.group_id, mock_user.id)),
        exec_result(scalars_all=[booking]),
    ]

    rows = BookingService.list_trip_bookings(db, trip.id, mock_user)
    assert rows == [booking]
