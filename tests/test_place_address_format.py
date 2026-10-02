"""Overture places store the street line as `freeform`; it must reach the Explore drawer."""
from __future__ import annotations

from app.services.explore_place_spine_service import map_spine_row_to_explore_place
from app.services.place_spine_service import _format_address


def test_overture_freeform_street_is_kept() -> None:
    address = {"freeform": "100 S Eola Dr", "locality": "Orlando", "region": "FL", "postcode": "32801", "country": "US"}
    assert _format_address(address) == "100 S Eola Dr, Orlando, FL, 32801"


def test_osm_style_number_and_road_still_win() -> None:
    address = {"house_number": "201", "road": "E Randolph St", "city": "Chicago", "state": "IL", "freeform": "ignored"}
    assert _format_address(address) == "201 E Randolph St, Chicago, IL"


def test_locality_only_when_no_street() -> None:
    assert _format_address({"locality": "Chicago", "region": "IL"}) == "Chicago, IL"


def test_spine_row_carries_phone_and_full_address() -> None:
    row = {
        "gers_id": "g1",
        "name": "Pritzker Park",
        "basic_category": "park",
        "confidence": 0.9,
        "website": "https://example.com",
        "phone": " +1 312-555-0100 ",
        "address": {"freeform": "547 S State St", "locality": "Chicago", "region": "IL", "postcode": "60605"},
        "photos": None,
        "lat": 41.875,
        "lng": -87.627,
    }
    place = map_spine_row_to_explore_place(row)
    assert place["address"] == "547 S State St, Chicago, IL, 60605"
    assert place["phone"] == "+1 312-555-0100"
    assert map_spine_row_to_explore_place(row | {"phone": None})["phone"] is None
