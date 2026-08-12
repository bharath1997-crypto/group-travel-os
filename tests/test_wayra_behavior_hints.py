"""Product-default Wayra behavior hints."""

from __future__ import annotations

from app.services.wayra_behavior_hints import (
    build_wayra_behavior_hints,
    is_composite_whats_here_question,
    is_polar_day_night_question,
    is_polar_region_pin,
)
from app.services.wayra_source_intent import (
    classify_wayra_answer_tier,
    nearby_category_from_message,
)


def test_composite_whats_here_routes_discovery_not_distance_only():
    msg = "What's here, how far is it, and how do I prepare?"
    assert is_composite_whats_here_question(msg) is True
    ctx = {
        "pathname": "/live",
        "userLocation": {"lat": 41.88, "lng": -87.63, "city": "Chicago"},
        "selectedPlace": {"lat": 41.96, "lng": -87.76, "name": "Hamlin Park"},
    }
    assert classify_wayra_answer_tier(msg, ctx) == "discovery"


def test_temperature_here_default_is_destination_pin():
    hints = build_wayra_behavior_hints(
        "What's the temperature from here?",
        {"userLocation": {"lat": 41.88, "lng": -87.63}},
        {"lat": -75.0, "lng": 0.0, "name": "Antarctica"},
    )
    assert "DESTINATION PIN" in hints


def test_days_far_from_home_includes_travel():
    hints = build_wayra_behavior_hints(
        "How many days should I spend here?",
        {
            "userLocation": {"lat": 41.88, "lng": -87.63},
            "selectedPlace": {"lat": -75.0, "lng": 0.0},
        },
        {"lat": -75.0, "lng": 0.0, "name": "Antarctica"},
    )
    assert "TOTAL trip length" in hints


def test_survive_antarctica_serious_tone():
    hints = build_wayra_behavior_hints(
        "How do I survive there?",
        {
            "userLocation": {"lat": 41.88, "lng": -87.63},
            "selectedPlace": {"lat": -75.0, "lng": 0.0, "country": "Antarctica"},
        },
        {"lat": -75.0, "lng": 0.0, "country": "Antarctica"},
    )
    assert "expedition prep" in hints


def test_polar_question_at_non_polar_pin_redirects():
    hints = build_wayra_behavior_hints(
        "Is it six months of sun and six months of night?",
        {"userLocation": {"lat": 41.88, "lng": -87.63}},
        {"lat": 41.88, "lng": -87.63, "name": "Chicago"},
    )
    assert "NOT in a polar region" in hints
    assert is_polar_region_pin({"lat": 41.88, "lng": -87.63}) is False


def test_polar_question_routes_discovery_not_nearby():
    msg = (
        "I heard there is a place where the sun never sets for months and never rises for months. "
        "Is that anywhere near Brus Laguna or this region?"
    )
    assert is_polar_day_night_question(msg) is True
    assert nearby_category_from_message(msg) is None
    ctx = {
        "pathname": "/live",
        "selectedPlace": {"lat": 15.73, "lng": -84.85, "name": "Brus Laguna"},
    }
    assert classify_wayra_answer_tier(msg, ctx) == "discovery"


def test_polar_question_at_polar_pin_explains():
    hints = build_wayra_behavior_hints(
        "Six months daylight and six months night?",
        None,
        {"lat": 78.0, "lng": 15.0, "name": "Svalbard"},
    )
    assert "polar day/night" in hints.lower()
