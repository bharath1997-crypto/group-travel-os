"""Travel prep vs discovery routing on Live."""

from __future__ import annotations

from app.services.wayra_intent import is_live_travel_prep_question


def test_know_about_place_with_interesting_nearby_is_discovery_not_prep():
    msg = (
        "I'm looking at Brus Laguna on Rovvy Live (15.5542, -84.4433). "
        "What should I know about this place, and what are interesting things to see or do nearby?"
    )
    assert is_live_travel_prep_question(msg) is False


def test_prepare_for_trip_still_prep():
    assert is_live_travel_prep_question("What should I prepare for this trip?") is True


def test_what_should_i_know_before_still_prep():
    assert is_live_travel_prep_question("What should I know before I drive there?") is True


def test_budget_plan_from_home_is_not_travel_prep():
    msg = "I have $40,000 on my hand — I want to spend 15-16 days. What should I plan from Chicago?"
    assert is_live_travel_prep_question(msg) is False
