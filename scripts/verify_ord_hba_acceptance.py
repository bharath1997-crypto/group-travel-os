"""Manual Acceptance Verification Script for ORD -> HBA Multi-Segment Itineraries."""

from __future__ import annotations

from datetime import date, timedelta
from app.services.flight_journey_parser import parse_duffel_journey
from app.services.flight_journey_service import _rank_journeys
from app.services.flight_providers.normalizer import journey_to_offer, group_offers_into_itineraries

def test_acceptance_ord_hba():
    raw_offer = {
        "id": "off_ord_hba_live_test",
        "total_amount": "2400.00",
        "total_currency": "USD",
        "expires_at": "2099-01-01T00:00:00Z",
        "live_mode": False,
        "slices": [
            {
                "duration": None, # Unusable slice duration from provider
                "origin": {"iata_code": "ORD"},
                "destination": {"iata_code": "HBA"},
                "segments": [
                    {
                        "departing_at": "2026-10-10T08:00:00-05:00",
                        "arriving_at": "2026-10-10T21:30:00+09:00", # ORD -> HND: 13h 30m (810m)
                        "duration": "PT13H30M",
                        "marketing_carrier": {"iata_code": "NH", "name": "ANA"},
                        "operating_carrier": {"iata_code": "NH", "name": "ANA"},
                        "marketing_carrier_flight_number": "111",
                        "origin": {"iata_code": "ORD", "name": "Chicago O'Hare", "terminal": "1"},
                        "destination": {"iata_code": "HND", "name": "Tokyo Haneda", "terminal": "3"},
                    },
                    {
                        "departing_at": "2026-10-10T23:00:00+09:00", # HND layover: 1h 30m (90m)
                        "arriving_at": "2026-10-11T23:40:00+10:00", # HND -> SYD: 9h 40m (580m)
                        "duration": "PT9H40M",
                        "marketing_carrier": {"iata_code": "NH", "name": "ANA"},
                        "operating_carrier": {"iata_code": "NQ", "name": "Air Japan"},
                        "marketing_carrier_flight_number": "879",
                        "origin": {"iata_code": "HND", "name": "Tokyo Haneda", "terminal": "3"},
                        "destination": {"iata_code": "SYD", "name": "Sydney Kingsford Smith", "terminal": "1"},
                    },
                    {
                        "departing_at": "2026-10-12T08:05:00+10:00", # SYD layover: 8h 25m (505m)
                        "arriving_at": "2026-10-12T10:00:00+10:00", # SYD -> HBA: 1h 55m (115m)
                        "duration": "PT1H55M",
                        "marketing_carrier": {"iata_code": "VA", "name": "Virgin Australia"},
                        "operating_carrier": {"iata_code": "VA", "name": "Virgin Australia"},
                        "marketing_carrier_flight_number": "1528",
                        "origin": {"iata_code": "SYD", "name": "Sydney Kingsford Smith", "terminal": "2"},
                        "destination": {"iata_code": "HBA", "name": "Hobart Airport"},
                    },
                ],
            }
        ],
    }

    journey = parse_duffel_journey(raw_offer, currency_preference="USD", checked_at="2026-10-01T12:00:00Z")
    assert journey is not None, "Parsed journey must not be None"
    
    # 1. Total duration calculation: 13h30m (810m) + 1h30m (90m) + 9h40m (580m) + 8h25m (505m) + 1h55m (115m) = 2100m (35h 00m)
    assert journey.total_duration_minutes == 2100, f"Expected 2100m (35h), got {journey.total_duration_minutes}"
    assert journey.duration_minutes == 2100, f"Expected 2100m (35h), got {journey.duration_minutes}"

    # 2. Segments & connections
    sl = journey.slices[0]
    assert len(sl.segments) == 3, f"Expected 3 segments, got {len(sl.segments)}"
    assert len(sl.connections) == 2, f"Expected 2 connections, got {len(sl.connections)}"
    assert sl.connections[0].layover_minutes == 90, f"Layover 1 expected 90m, got {sl.connections[0].layover_minutes}"
    assert sl.connections[1].layover_minutes == 505, f"Layover 2 expected 505m, got {sl.connections[1].layover_minutes}"

    # 3. Operating airline difference
    assert sl.segments[1].operating_airline_name == "Air Japan"
    assert sl.segments[1].airline_name == "ANA"

    # 4. Disclosure defaults
    assert journey.connection_protection == "unknown"
    assert journey.baggage_transfer == "unknown"

    # 5. Ranking and Recommendation reason
    ranked = _rank_journeys([journey])
    rec_reason = ranked[0].recommendation_reason
    assert "Lowest price" in rec_reason
    assert journey.total_duration_minutes == 2100
    assert "longer than itself" not in rec_reason

    # 6. Grouping and seller options
    offer = journey_to_offer(journey)
    groups = group_offers_into_itineraries([offer])
    assert len(groups) == 1
    assert groups[0].total_duration_minutes == 2100

    print("ACCEPTANCE TEST SUCCESS:")
    print(f"  Route: {journey.origin} -> {journey.destination}")
    print(f"  Segments: {[s.origin + '->' + s.destination for s in sl.segments]}")
    print(f"  Calculated Total Duration: {journey.total_duration_minutes // 60}h {journey.total_duration_minutes % 60}m ({journey.total_duration_minutes} mins)")
    print(f"  Layovers: {[c.airport + ': ' + str(c.layover_minutes) + 'm' for c in sl.connections]}")
    print(f"  Recommendation Reason: {rec_reason}")


def test_acceptance_ord_hba_naive_timestamps():
    """Regression: Duffel sandbox often omits UTC offsets on segment timestamps."""
    raw_offer = {
        "id": "off_ord_hba_naive_test",
        "total_amount": "2400.00",
        "total_currency": "USD",
        "expires_at": "2099-01-01T00:00:00Z",
        "live_mode": False,
        "ticket_type": "multi",
        "fare_type": "multi_city",
        "slices": [
            {
                "duration": None,
                "origin": {"iata_code": "ORD"},
                "destination": {"iata_code": "HBA"},
                "segments": [
                    {
                        "departing_at": "2026-10-10T08:00:00",
                        "arriving_at": "2026-10-10T21:30:00",
                        "duration": "PT13H30M",
                        "marketing_carrier": {"iata_code": "NH", "name": "ANA"},
                        "operating_carrier": {"iata_code": "NH", "name": "ANA"},
                        "marketing_carrier_flight_number": "111",
                        "origin": {"iata_code": "ORD", "name": "Chicago O'Hare"},
                        "destination": {"iata_code": "HND", "name": "Tokyo Haneda"},
                    },
                    {
                        "departing_at": "2026-10-10T23:00:00",
                        "arriving_at": "2026-10-11T23:40:00",
                        "duration": "PT9H40M",
                        "marketing_carrier": {"iata_code": "NH", "name": "ANA"},
                        "operating_carrier": {"iata_code": "NQ", "name": "Air Japan"},
                        "marketing_carrier_flight_number": "879",
                        "origin": {"iata_code": "HND", "name": "Tokyo Haneda"},
                        "destination": {"iata_code": "SYD", "name": "Sydney"},
                    },
                    {
                        "departing_at": "2026-10-12T08:05:00",
                        "arriving_at": "2026-10-12T10:00:00",
                        "duration": "PT1H55M",
                        "marketing_carrier": {"iata_code": "VA", "name": "Virgin Australia"},
                        "operating_carrier": {"iata_code": "VA", "name": "Virgin Australia"},
                        "marketing_carrier_flight_number": "1528",
                        "origin": {"iata_code": "SYD", "name": "Sydney"},
                        "destination": {"iata_code": "HBA", "name": "Hobart"},
                    },
                ],
            }
        ],
    }

    journey = parse_duffel_journey(raw_offer, currency_preference="USD", checked_at="2026-10-01T12:00:00Z")
    assert journey is not None
    assert journey.total_duration_minutes == 2100, (
        f"Expected 35h (2100m), got {journey.total_duration_minutes // 60}h "
        f"{journey.total_duration_minutes % 60}m ({journey.total_duration_minutes}m)"
    )
    assert journey.total_duration_minutes != 3000, "Must not use naive ORD→HBA timestamp subtraction (50h bug)"
    assert journey.ticket_type == "unknown", "multi/multi_city must not imply separate tickets"
    assert journey.connection_protection == "unknown"

    sl = journey.slices[0]
    assert sl.connections[0].layover_minutes == 90
    assert sl.connections[1].layover_minutes == 505

    print("NAIVE TIMESTAMP ACCEPTANCE SUCCESS:")
    print(f"  Calculated Total Duration: {journey.total_duration_minutes // 60}h {journey.total_duration_minutes % 60}m")


if __name__ == "__main__":
    test_acceptance_ord_hba()
    test_acceptance_ord_hba_naive_timestamps()
