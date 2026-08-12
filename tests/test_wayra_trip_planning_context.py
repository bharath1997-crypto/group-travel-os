"""Home → destination trip planning context on Live map."""

from __future__ import annotations

from app.services.wayra_local_replies import (
    is_where_am_i_question,
    resolve_navigation_reply,
    resolve_where_am_i_reply,
)
from app.services.wayra_source_intent import (
    classify_wayra_answer_tier,
    is_planning_from_home,
    is_trip_logistics_question,
)
from app.services.wayra_sources_service import build_user_origin_planning_block

ANTARCTICA = {
    "name": "Vinson Massif",
    "lat": -78.5255,
    "lng": -85.6171,
    "city": "Antarctica",
    "country": "Antarctica",
}
CTX = {
    "pathname": "/live",
    "selectedPlace": ANTARCTICA,
    "userLocation": {
        "lat": 41.8781,
        "lng": -87.6298,
        "city": "Chicago",
        "state": "Illinois",
        "country": "United States",
    },
    "contextNotice": "Far from your current area.",
}


def test_planning_from_home_detects_chicago_to_antarctica():
    assert is_planning_from_home(CTX) is True


def test_how_to_reach_routes_location_hard():
    msg = "What is the way to reach over there?"
    assert is_trip_logistics_question(msg)
    assert classify_wayra_answer_tier(msg, CTX) == "location_hard"


def test_budget_plan_question_routes_location_hard():
    msg = "I have $40,000 on my hand — what should I plan for 15-16 days?"
    assert classify_wayra_answer_tier(msg, CTX) == "location_hard"


def test_origin_block_includes_home_and_destination():
    block = build_user_origin_planning_block(CTX, ANTARCTICA)
    lower = block.lower()
    assert "chicago" in lower
    assert "physically" in lower
    assert "vinson massif" in lower
    assert "planning destination" in lower


def test_where_am_i_dual_location_reply():
    assert is_where_am_i_question("Where I am right now")
    text = resolve_where_am_i_reply("Where I am right now", ANTARCTICA, CTX)
    assert text is not None
    lower = text.lower()
    assert "chicago" in lower
    assert "vinson massif" in lower
    assert "planning" in lower


def test_reach_question_defers_to_llm_when_far():
    text = resolve_navigation_reply("How to reach over there?", ANTARCTICA, CTX)
    assert text is None
