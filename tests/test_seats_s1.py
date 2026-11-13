"""Seats Sprint S1 regression tests (SQLite-safe unit + route auth)."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.seats import Ride, RideBooking
from app.services.seats_booking_service import create_booking, withdraw_booking
from app.services.seats_service import SeatsService
from app.utils.auth import get_current_user
client = TestClient(app)


def _open_ride(seats_offered: int = 2, seats_taken: int = 0) -> Ride:
    driver_id = uuid.uuid4()
    return Ride(
        id=uuid.uuid4(),
        driver_id=driver_id,
        region_code="IN-MH",
        depart_at=datetime.now(timezone.utc) + timedelta(days=1),
        seats_offered=seats_offered,
        seats_taken=seats_taken,
        visibility="public",
        approval="instant",
        status="open",
        distance_km=150,
        cost_total_paise=80000,
        max_per_seat_paise=40000,
        price_per_seat_paise=40000,
        cost_basis={},
    )


@pytest.fixture(autouse=True)
def _clear_auth_override():
    yield
    app.dependency_overrides.pop(get_current_user, None)


def test_search_rides_requires_auth():
    r = client.get(
        "/api/v1/seats/rides",
        params={
            "from_lat": 19.1,
            "from_lon": 72.8,
            "to_lat": 18.5,
            "to_lon": 73.7,
            "date": "2030-01-15",
            "seats": 1,
        },
    )
    assert r.status_code == 401


def test_seats_me_requires_auth():
    r = client.get("/api/v1/seats/me")
    assert r.status_code == 401


def test_create_booking_rejects_driver_self_book():
    ride = _open_ride()
    db = MagicMock()

    def fake_execute(stmt, *args, **kwargs):
        m = MagicMock()
        m.scalar_one_or_none.return_value = ride
        m.scalar_one.return_value = True
        m.scalars.return_value.all.return_value = []
        return m

    db.execute.side_effect = fake_execute

    with patch("app.services.seats_booking_service.is_blocked", return_value=False):
        with pytest.raises(Exception) as ei:
            create_booking(
                db,
                ride_id=ride.id,
                rider_id=ride.driver_id,
                seats=1,
                board_seq=0,
                alight_seq=1,
            )
    assert "own ride" in str(ei.value).lower()


def test_withdraw_confirmed_booking():
    ride_id = uuid.uuid4()
    rider_id = uuid.uuid4()
    booking = RideBooking(
        id=uuid.uuid4(),
        ride_id=ride_id,
        rider_id=rider_id,
        seats=1,
        board_seq=0,
        alight_seq=1,
        status="confirmed",
        price_paise=40000,
    )
    ride = Ride(
        id=ride_id,
        driver_id=uuid.uuid4(),
        region_code="IN-MH",
        depart_at=datetime.now(timezone.utc) + timedelta(days=1),
        seats_offered=2,
        seats_taken=1,
        visibility="public",
        approval="instant",
        status="open",
        distance_km=100,
        cost_total_paise=40000,
        max_per_seat_paise=40000,
        price_per_seat_paise=40000,
        cost_basis={},
    )

    db = MagicMock()
    call = {"n": 0}

    def fake_execute(stmt, *args, **kwargs):
        call["n"] += 1
        m = MagicMock()
        if call["n"] == 1:
            m.scalar_one_or_none.return_value = booking
        elif call["n"] == 2:
            m.scalar_one.return_value = ride
        return m

    db.execute.side_effect = fake_execute
    with patch("app.services.seats_booking_service.adjust_seats_taken") as adj:
        out = withdraw_booking(db, booking_id=booking.id, rider_id=rider_id)
    assert out.status == "cancelled_rider"
    adj.assert_called_once_with(db, ride_id, -1)


def test_cancel_ride_marks_bookings_cancelled_driver_and_notifies():
    driver = MagicMock()
    driver.id = uuid.uuid4()
    rider_id = uuid.uuid4()
    ride = Ride(
        id=uuid.uuid4(),
        driver_id=driver.id,
        region_code="IN-MH",
        depart_at=datetime.now(timezone.utc) + timedelta(days=1),
        seats_offered=2,
        seats_taken=1,
        visibility="public",
        approval="instant",
        status="open",
        distance_km=100,
        cost_total_paise=80000,
        max_per_seat_paise=40000,
        price_per_seat_paise=40000,
        cost_basis={},
        driver_cancel_count=0,
    )
    booking = RideBooking(
        id=uuid.uuid4(),
        ride_id=ride.id,
        rider_id=rider_id,
        seats=1,
        board_seq=0,
        alight_seq=1,
        status="confirmed",
        price_paise=40000,
    )
    ride.bookings = [booking]

    db = MagicMock()
    m = MagicMock()
    m.scalar_one_or_none.return_value = ride
    db.execute.return_value = m

    with patch("app.services.seats_service.NotificationService.append_in_app") as notify:
        out = SeatsService.cancel_ride(db, driver, ride.id)

    assert out.status == "cancelled"
    assert booking.status == "cancelled_driver"
    assert booking.decided_at is not None
    notify.assert_called_once()
    args = notify.call_args[0]
    assert args[1] == rider_id
    assert args[2] == "seats_cancelled"
    db.commit.assert_called()
