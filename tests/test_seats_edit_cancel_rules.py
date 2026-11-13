"""SeatShare edit/cancel rules and ride-card details (SQLite-safe, mocked DB)."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.models.seats import Ride, RideBooking
from app.services.seats_service import SeatsService, _vehicle_for_card


def _ride(driver_id, hours_ahead: float = 48, status: str = "open") -> Ride:
    return Ride(
        id=uuid.uuid4(),
        driver_id=driver_id,
        region_code="IN-MH",
        depart_at=datetime.now(timezone.utc) + timedelta(hours=hours_ahead),
        seats_offered=2,
        seats_taken=1,
        visibility="public",
        approval="instant",
        status=status,
        distance_km=100,
        cost_total_paise=80000,
        max_per_seat_paise=40000,
        price_per_seat_paise=40000,
        cost_basis={},
        driver_cancel_count=0,
        note="old",
    )


def _booking(ride: Ride, status: str = "confirmed") -> RideBooking:
    b = RideBooking(
        id=uuid.uuid4(),
        ride_id=ride.id,
        rider_id=uuid.uuid4(),
        seats=1,
        board_seq=0,
        alight_seq=1,
        status=status,
        price_paise=40000,
    )
    ride.bookings = [b]
    return b


def _db_returning(ride):
    db = MagicMock()
    m = MagicMock()
    m.scalar_one_or_none.return_value = ride
    db.execute.return_value = m
    return db


def _driver():
    d = MagicMock()
    d.id = uuid.uuid4()
    return d


def test_edit_changes_note_and_details_and_notifies_riders():
    driver = _driver()
    ride = _ride(driver.id)
    booking = _booking(ride)
    with patch("app.services.seats_service.NotificationService.append_in_app") as notify:
        out = SeatsService.edit_ride(
            _db_returning(ride),
            driver,
            ride.id,
            note="new note",
            preferences={"luggage": "small", "pets_allowed": None, "depart_window_minutes": 15},
        )
    assert out.note == "new note"
    assert out.preferences == {"luggage": "small", "depart_window_minutes": 15}
    notify.assert_called_once()
    assert notify.call_args[0][1] == booking.rider_id
    assert notify.call_args[0][2] == "seats_ride_updated"


def test_edit_with_no_real_change_does_not_notify():
    driver = _driver()
    ride = _ride(driver.id)
    ride.preferences = {"luggage": "small"}
    _booking(ride)
    with patch("app.services.seats_service.NotificationService.append_in_app") as notify:
        SeatsService.edit_ride(
            _db_returning(ride), driver, ride.id, note="old", preferences={"luggage": "small"}
        )
    notify.assert_not_called()


def test_edit_rejected_after_departure_or_when_cancelled():
    driver = _driver()
    left = _ride(driver.id, hours_ahead=-1)
    with pytest.raises(Exception) as ei:
        SeatsService.edit_ride(_db_returning(left), driver, left.id, note="x", preferences=None)
    assert "already left" in str(ei.value).lower()

    cancelled = _ride(driver.id, status="cancelled")
    with pytest.raises(Exception) as ei:
        SeatsService.edit_ride(_db_returning(cancelled), driver, cancelled.id, note="x", preferences=None)
    assert "no longer" in str(ei.value).lower()


def test_edit_rejected_for_other_driver():
    ride = _ride(uuid.uuid4())
    with pytest.raises(Exception) as ei:
        SeatsService.edit_ride(_db_returning(ride), _driver(), ride.id, note="x", preferences=None)
    assert "not found" in str(ei.value).lower()


def test_cancel_rejected_after_departure():
    driver = _driver()
    ride = _ride(driver.id, hours_ahead=-2)
    with pytest.raises(Exception) as ei:
        SeatsService.cancel_ride(_db_returning(ride), driver, ride.id)
    assert "already left" in str(ei.value).lower()


def test_late_cancel_message_names_the_24_hour_rule():
    driver = _driver()
    ride = _ride(driver.id, hours_ahead=5)
    _booking(ride)
    with patch("app.services.seats_service.NotificationService.append_in_app") as notify:
        SeatsService.cancel_ride(_db_returning(ride), driver, ride.id)
    assert "less than 24 hours" in notify.call_args[0][4]


def test_early_cancel_message_is_plain():
    driver = _driver()
    ride = _ride(driver.id, hours_ahead=72)
    _booking(ride)
    with patch("app.services.seats_service.NotificationService.append_in_app") as notify:
        SeatsService.cancel_ride(_db_returning(ride), driver, ride.id)
    assert "less than 24 hours" not in notify.call_args[0][4]


def test_card_uses_driver_described_car_without_plate():
    row = {
        "vehicle_id": None,
        "cost_basis": {"vehicle_body_type": "sedan"},
        "preferences": {"vehicle_color": "Blue", "vehicle_make": "Toyota", "vehicle_model": "Camry"},
    }
    v = _vehicle_for_card(MagicMock(), row)
    assert v["display"] == "Blue Toyota Camry"
    assert "plate" not in v


def test_card_falls_back_to_body_type_when_no_description():
    v = _vehicle_for_card(MagicMock(), {"vehicle_id": None, "cost_basis": {"vehicle_body_type": "suv"}})
    assert v["display"] != ""


# --- PATCH /seats/rides/{id}: 401 and 422 -----------------------------------
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.utils.auth import get_current_user  # noqa: E402

_client = TestClient(app)


def test_patch_ride_requires_auth():
    r = _client.patch(f"/api/v1/seats/rides/{uuid.uuid4()}", json={"note": "x"})
    assert r.status_code == 401


def test_patch_ride_rejects_bad_details_with_422():
    app.dependency_overrides[get_current_user] = lambda: _driver()
    try:
        r = _client.patch(
            f"/api/v1/seats/rides/{uuid.uuid4()}",
            json={"preferences": {"depart_window_minutes": 999}},
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    assert r.status_code == 422
