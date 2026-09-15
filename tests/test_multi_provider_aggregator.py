"""
tests/test_multi_provider_aggregator.py — Tests for Travelpayouts Multi-Provider N-Solution aggregation.
"""

from datetime import date
from app.schemas.flight import FlightResult, ProviderOffer
from app.schemas.hotel import HotelResult, HotelProviderOffer
from app.schemas.bus import BusResult, BusProviderOffer
from app.services.flight_meta_providers import (
    _parse_travelpayouts_row,
    _parse_kiwi_offer,
    merge_flight_results,
)
from app.services.hotel_service import HotelService
from app.services.bus_service import BusService


def test_travelpayouts_row_parsing_with_provider_offers():
    row = {
        "origin": "CHI",
        "destination": "HYD",
        "price": 850.0,
        "airline": "EK",
        "departure_at": "2026-09-01T10:00:00Z",
        "return_at": "2026-09-15T10:00:00Z",
        "duration": 1080,
        "transfers": 1,
        "link": "/search/CHI0109HYD1",
        "gate": "Expedia",
    }
    result = _parse_travelpayouts_row(row, "USD")
    assert result is not None
    assert result.price == 850.0
    assert result.provider == "Aviasales"
    assert len(result.provider_offers) == 1
    assert "Expedia" in result.provider_offers[0].provider_name
    assert "tp.media" in result.provider_offers[0].booking_url


def test_merge_flight_results_combines_seller_solutions():
    offer_a = FlightResult(
        id="tp-1",
        price=500.0,
        currency="USD",
        airlines=["UA"],
        departure_at="2026-09-01T08:00:00Z",
        arrival_at="2026-09-01T16:00:00Z",
        origin="ORD",
        destination="LHR",
        duration_minutes=480,
        deep_link="https://tp.media/r?marker=727732&p=4114&u=aviasales",
        stops=0,
        provider="Aviasales",
        provider_offers=[
            ProviderOffer(provider_name="Aviasales (Trip.com)", price=500.0, currency="USD", booking_url="https://tp.media/1")
        ],
    )

    offer_b = FlightResult(
        id="kiwi-1",
        price=510.0,
        currency="USD",
        airlines=["UA"],
        departure_at="2026-09-01T08:00:00Z",
        arrival_at="2026-09-01T16:00:00Z",
        origin="ORD",
        destination="LHR",
        duration_minutes=480,
        deep_link="https://kiwi.com/book",
        stops=0,
        provider="Kiwi.com",
        provider_offers=[
            ProviderOffer(provider_name="Kiwi.com", price=510.0, currency="USD", booking_url="https://kiwi.com/book")
        ],
    )

    merged = merge_flight_results([offer_a], [offer_b])
    assert len(merged) == 1
    best = merged[0]
    assert best.price == 500.0
    assert len(best.provider_offers) == 2
    provider_names = [o.provider_name for o in best.provider_offers]
    assert "Aviasales (Trip.com)" in provider_names
    assert "Kiwi.com" in provider_names


def test_hotel_multi_provider_offers():
    hotels = HotelService.search_hotels("nyc", date(2026, 9, 1), date(2026, 9, 5), adults=2)
    assert len(hotels) > 0
    first = hotels[0]
    assert len(first.provider_offers) >= 3
    names = [o.provider_name for o in first.provider_offers]
    assert "Agoda" in names
    assert "Booking.com" in names
    assert "Hotellook Meta" in names


def test_bus_multi_provider_offers():
    buses = BusService.search_buses("nyc", "boston", "2026-09-01", adults=1)
    assert len(buses) > 0
    first = buses[0]
    assert len(first.provider_offers) >= 2
    names = [o.provider_name for o in first.provider_offers]
    assert "Busbud" in names
    assert "Omio" in names
