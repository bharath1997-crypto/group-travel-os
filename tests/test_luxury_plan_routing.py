"""Plan/budget questions must not route to nearby OSM search."""

from app.services.wayra_source_intent import (
    classify_wayra_answer_tier,
    is_plan_or_budget_question,
    nearby_category_from_message,
)

LUXURY = (
    "I have a $50,000 budget for a 4-day trip starting here. Plan an insanely luxurious "
    "itinerary including private jets, 5-star hotels, Michelin-star dining, and exclusive "
    "experiences, with a full cost breakdown."
)


def test_luxury_plan_not_nearby_category():
    assert is_plan_or_budget_question(LUXURY)
    assert nearby_category_from_message(LUXURY) is None
    assert classify_wayra_answer_tier(LUXURY, {"pathname": "/live"}) == "location_hard"
