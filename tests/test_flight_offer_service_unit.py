"""Unit tests for flight offer parsing."""

from app.services.flight_offer_service import parse_duffel_offer_detail


def test_parse_duffel_offer_detail_outbound_segments():
    offer = {
        "id": "off_test",
        "total_amount": "220.00",
        "total_currency": "USD",
        "cabin_class": "economy",
        "live_mode": False,
        "slices": [
            {
                "origin": {"iata_code": "ORD"},
                "destination": {"iata_code": "LAX"},
                "duration": "PT4H21M",
                "segments": [
                    {
                        "origin": {"iata_code": "ORD", "name": "O'Hare", "terminal": "3"},
                        "destination": {"iata_code": "LAX", "name": "Los Angeles", "terminal": "4"},
                        "departing_at": "2026-08-22T08:30:00Z",
                        "arriving_at": "2026-08-22T10:51:00Z",
                        "duration": "PT4H21M",
                        "marketing_carrier": {"iata_code": "AA", "name": "American Airlines"},
                        "marketing_carrier_flight_number": "123",
                        "aircraft": {"name": "Boeing 737-800"},
                    }
                ],
            }
        ],
        "passengers": [{"type": "adult"}],
    }
    detail = parse_duffel_offer_detail(offer)
    assert detail.origin == "ORD"
    assert detail.destination == "LAX"
    assert detail.stops == 0
    assert detail.slices[0].segments[0].flight_number == "AA123"
