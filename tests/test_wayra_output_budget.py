"""Tests for explicit Wayra LLM output token budgets."""

from __future__ import annotations

from app.services.wayra_output_budget import is_plan_question, resolve_output_budget
from app.services.wayra_source_intent import classify_wayra_answer_tier


def test_plan_question_detected():
    msg = "I am asking particularly for a plan for this particular location. What do you say?"
    assert is_plan_question(msg)


def test_plan_question_routes_location_hard_on_live():
    ctx = {
        "pathname": "/live",
        "selectedPlace": {"lat": 46.8, "lng": -96.7, "name": "Theodore Roosevelt Expressway"},
    }
    tier = classify_wayra_answer_tier(
        "I am asking particularly for a plan for this particular location. What do you say?",
        ctx,
    )
    assert tier == "location_hard"


def test_output_budget_plan_tier():
    budget = resolve_output_budget("location_hard", "help me plan this stop")
    assert budget.style == "plan"
    assert budget.max_output_tokens >= 1200
    assert budget.max_message_chars >= 4000


def test_output_budget_standard_discovery():
    budget = resolve_output_budget("discovery", "What's special here?")
    assert budget.style == "standard"
    assert budget.max_output_tokens >= 800
