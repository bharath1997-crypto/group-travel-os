"""Ride publish schema accepts drivable route metadata from SeatShare wizard."""
from datetime import datetime, timezone

from app.schemas.seats import RidePublishIn


def test_ride_publish_accepts_route_geometry_and_vehicle_body():
    body = RidePublishIn(
        stops=[
            {"label": "A", "lat": 19.1, "lon": 72.8},
            {"label": "B", "lat": 18.5, "lon": 73.7},
        ],
        depart_at=datetime.now(timezone.utc),
        seats_offered=2,
        visibility="public",
        approval="instant",
        price_per_seat_paise=40000,
        mileage_kmpl=15,
        route_geometry=[[72.8, 19.1], [73.7, 18.5]],
        route_distance_meters=150_000,
        route_distance_miles=93.2,
        vehicle_body_type="suv",
        route_option_id="primary",
        route_label="Primary route",
    )
    assert body.route_geometry is not None
    assert len(body.route_geometry) == 2
    assert body.vehicle_body_type == "suv"
    assert body.visibility == "public"


def test_ride_publish_defaults_visibility_to_public():
    body = RidePublishIn(
        stops=[
            {"label": "A", "lat": 19.1, "lon": 72.8},
            {"label": "B", "lat": 18.5, "lon": 73.7},
        ],
        depart_at=datetime.now(timezone.utc),
        seats_offered=1,
        approval="instant",
        price_per_seat_paise=10000,
        mileage_kmpl=15,
    )
    assert body.visibility == "public"
