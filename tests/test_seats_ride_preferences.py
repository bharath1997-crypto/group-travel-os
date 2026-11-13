"""Ride preferences + series id accepted by the publish schema (migration 022)."""
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.schemas.seats import RidePublishIn


def _base(**extra):
    return dict(
        stops=[
            {"label": "A", "lat": 41.9, "lon": -87.7},
            {"label": "B", "lat": 41.6, "lon": -86.2},
        ],
        depart_at=datetime.now(timezone.utc),
        seats_offered=2,
        approval="instant",
        price_per_seat_paise=1000,
        mileage_kmpl=12,
        **extra,
    )


def test_preferences_and_series_accepted():
    sid = uuid.uuid4()
    body = RidePublishIn(
        **_base(
            preferences={
                "depart_window_minutes": 15,
                "luggage": "small",
                "pets_allowed": False,
                "vehicle_make": "Toyota",
                "vehicle_color": "Blue",
            },
            series_id=str(sid),
        )
    )
    assert body.preferences.depart_window_minutes == 15
    assert body.preferences.luggage == "small"
    assert body.series_id == sid


def test_preferences_optional_and_default_window_zero():
    body = RidePublishIn(**_base(preferences={}))
    assert body.preferences.depart_window_minutes == 0
    assert RidePublishIn(**_base()).preferences is None


@pytest.mark.parametrize(
    "bad",
    [
        {"depart_window_minutes": 61},
        {"depart_window_minutes": -1},
        {"luggage": "huge"},
        {"vehicle_make": "x" * 41},
        {"license_plate": "ABC"},  # unknown fields are rejected
    ],
)
def test_preferences_validation_422(bad):
    with pytest.raises(ValidationError):
        RidePublishIn(**_base(preferences=bad))


def test_migration_022_is_additive():
    sql = (Path(__file__).resolve().parents[1] / "migrations" / "022_seats_ride_preferences.sql").read_text()
    upper = sql.upper()
    assert "ADD COLUMN IF NOT EXISTS PREFERENCES" in upper
    assert "DROP " not in upper and "DELETE " not in upper
