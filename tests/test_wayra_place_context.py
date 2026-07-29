"""Tests for Wayra place context normalization."""

from __future__ import annotations

from app.services.wayra_place_context import normalize_place_for_sources
from app.services.wayra_source_intent import classify_wayra_answer_tier, nearby_category_from_message


def test_must_try_food_is_discovery_not_nearby():
    q = "Any must-try food around here?"
    assert nearby_category_from_message(q) is None
    assert classify_wayra_answer_tier(q, {"pathname": "/live", "selectedPlace": {"lat": 1.0, "lng": 2.0}}) == "discovery"


def test_local_culture_is_discovery():
    q = "What's the local culture like here?"
    assert classify_wayra_answer_tier(
        q,
        {"pathname": "/live", "selectedPlace": {"name": "Dropped pin", "lat": 62.0, "lng": 129.0}},
    ) == "discovery"
    assert nearby_category_from_message(q) is None


def test_restaurants_nearby_still_nearby():
    assert nearby_category_from_message("Any restaurants near me?") == "food"


def test_normalize_generic_pin_uses_region():
    place = normalize_place_for_sources(
        {"name": "Dropped pin", "lat": 62.0, "lng": 129.0},
        {
            "resolvedMapRegion": "Yakutsk, Sakha Republic, Russia",
            "selectedPlace": {
                "name": "Dropped pin",
                "lat": 62.0,
                "lng": 129.0,
                "city": "Yakutsk",
                "country": "Russia",
            },
        },
    )
    assert place["name"] == "Yakutsk, Sakha Republic, Russia"
    assert place["city"] == "Yakutsk"
