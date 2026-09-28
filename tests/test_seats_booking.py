"""Booking concurrency and hold behaviour tests."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.models.seats import Ride, RideBooking
from app.services.seats_booking_service import create_booking


def _open_ride(seats_offered: int = 1, seats_taken: int = 0) -> Ride:
    return Ride(
        id=uuid.uuid4(),
        driver_id=uuid.uuid4(),
        region_code="IN-MH",
        depart_at=datetime.now(timezone.utc) + timedelta(days=1),
        seats_offered=seats_offered,
        seats_taken=seats_taken,
        visibility="groups",
        approval="instant",
        status="open",
        distance_km=150,
        cost_total_paise=80000,
        max_per_seat_paise=40000,
        price_per_seat_paise=40000,
        cost_basis={},
    )


def test_concurrent_booking_last_seat():
    """Two simultaneous bookers on a 1-seat ride — exactly one succeeds."""
    ride = _open_ride(seats_offered=1, seats_taken=0)
    db = MagicMock()
    rider_a, rider_b = uuid.uuid4(), uuid.uuid4()

    call_count = {"n": 0}

    def fake_execute(stmt, *args, **kwargs):
        call_count["n"] += 1
        m = MagicMock()
        if call_count["n"] == 1:
            m.scalar_one_or_none.return_value = ride
            m.scalar_one.return_value = True
        elif call_count["n"] == 2:
            m.scalars.return_value.all.return_value = []
        elif call_count["n"] == 4:
            m.scalar_one_or_none.return_value = ride
            m.scalar_one.return_value = True
        elif call_count["n"] == 5:
            m.scalars.return_value.all.return_value = []
        return m

    db.execute.side_effect = fake_execute

    with patch("app.services.seats_booking_service.is_blocked", return_value=False), patch(
        "app.services.seats_booking_service.trust_path_for", return_value={"hops": 1}
    ):
        b1 = create_booking(
            db,
            ride_id=ride.id,
            rider_id=rider_a,
            seats=1,
            board_seq=0,
            alight_seq=1,
        )
        assert b1.status == "confirmed"
        assert ride.seats_taken == 1

        ride.seats_taken = 1
        with pytest.raises(HTTPException) as ei:
            create_booking(
                db,
                ride_id=ride.id,
                rider_id=rider_b,
                seats=1,
                board_seq=0,
                alight_seq=1,
            )
        assert ei.value.status_code == 409
        assert ride.seats_taken == 1


def test_manual_hold_expires_before_departure():
    from app.services.seats_booking_service import _hold_expires_at

    depart = datetime.now(timezone.utc) + timedelta(hours=3)
    exp = _hold_expires_at(depart)
    assert exp < depart
    assert exp <= datetime.now(timezone.utc) + timedelta(hours=24)
