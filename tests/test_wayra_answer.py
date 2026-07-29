"""Tests for Perplexity-style Wayra hybrid routing and source intent."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.schemas.ai_assistant import AIAssistantRequest, WayraSource
from app.services.wayra_answer_service import WayraAnswerService
from app.services.wayra_intent import WayraMode
from app.services.wayra_source_intent import (
    classify_wayra_answer_tier,
    extract_place_from_context,
    is_distance_from_me_question,
    nearby_category_from_message,
)


def test_nearby_category_pharmacy():
    assert nearby_category_from_message("Any pharmacies near me?") == "pharmacy"


def test_classify_nearby_tier():
    tier = classify_wayra_answer_tier("Find hospitals nearby", {})
    assert tier == "nearby"


def test_classify_location_hard_tier():
    tier = classify_wayra_answer_tier("How far is this from me?", {})
    assert tier == "location_hard"


def test_distance_from_me_question_detected():
    assert is_distance_from_me_question("How far is it from me?") is True
    assert is_distance_from_me_question("How far is this?") is True
    assert is_distance_from_me_question("How is the food?") is False


def test_classify_discovery_on_live_with_pin():
    ctx = {"pathname": "/live", "selectedPlace": {"name": "Millennium Park", "lat": 41.88, "lng": -87.62}}
    tier = classify_wayra_answer_tier("What's special here?", ctx)
    assert tier == "discovery"


def test_classify_discovery_for_place_culture_and_food_talk():
    ctx = {"pathname": "/live", "selectedPlace": {"name": "Red Square", "lat": 55.75, "lng": 37.62}}
    assert classify_wayra_answer_tier("What kind of clothes should I wear?", ctx) == "discovery"
    assert classify_wayra_answer_tier("What cultural event is going to happen?", ctx) == "discovery"
    assert classify_wayra_answer_tier("How many vegetarian options are available?", ctx) == "discovery"
    assert classify_wayra_answer_tier("Any restrictions?", ctx) == "discovery"


def test_extract_place_from_selected_and_attached():
    ctx = {
        "selectedPlace": {"name": "Millennium Park", "lat": 41.88, "lng": -87.62},
        "chatAttachedLocation": {"label": "GPS", "lat": 42.0, "lng": -88.0},
    }
    place = extract_place_from_context(ctx)
    assert place is not None
    assert place["name"] == "GPS"


@pytest.mark.asyncio
async def test_nearby_without_location_returns_local_prompt():
    req = AIAssistantRequest(page="live", user_message="Any pharmacies near me?", context={})
    out = await WayraAnswerService.try_answer(req, WayraMode.TRAVEL)
    assert out is not None
    assert out.summary and out.summary.get("needs_location") is True
    assert "location" in out.message.lower()


@pytest.mark.asyncio
async def test_nearby_with_place_uses_sources_and_summary():
    req = AIAssistantRequest(
        page="live",
        user_message="Any pharmacies near me?",
        context={
            "pathname": "/live",
            "selectedPlace": {"name": "Loop", "lat": 41.88, "lng": -87.63, "city": "Chicago"},
        },
    )
    fake_sources = [
        WayraSource(label="CVS · 0.3 mi", url="https://www.openstreetmap.org/node/1", source_type="osm"),
    ]
    with (
        patch(
            "app.services.wayra_answer_service.fetch_nearby_sources",
            new=AsyncMock(return_value=(fake_sources, "Nearby pharmacy: CVS (0.3 mi)")),
        ),
        patch(
            "app.services.wayra_answer_service.summarize_from_sources",
            new=AsyncMock(return_value=("Two pharmacies are within walking distance.", "template", None)),
        ),
    ):
        out = await WayraAnswerService.try_answer(req, WayraMode.TRAVEL)

    assert out is not None
    assert "pharmacies" in out.message.lower() or "pharmacy" in out.message.lower()
    assert len(out.sources) == 1
    assert out.summary and out.summary.get("tier") == "nearby"


@pytest.mark.asyncio
async def test_discovery_with_place_returns_wikipedia_sources():
    req = AIAssistantRequest(
        page="live",
        user_message="What's special about this place?",
        context={
            "pathname": "/live",
            "selectedPlace": {
                "name": "Millennium Park",
                "lat": 41.88,
                "lng": -87.62,
                "category": "Park",
                "city": "Chicago",
            },
        },
    )
    fake_sources = [
        WayraSource(
            label="Wikipedia · Millennium Park",
            url="https://en.wikipedia.org/wiki/Millennium_Park",
            source_type="wikipedia",
            snippet="A public park in Chicago.",
        ),
    ]
    with (
        patch(
            "app.services.wayra_answer_service.fetch_discovery_sources",
            new=AsyncMock(return_value=(fake_sources, "Wikipedia: A public park.")),
        ),
        patch(
            "app.services.wayra_answer_service.summarize_from_sources",
            new=AsyncMock(return_value=("Millennium Park is a famous downtown green space.", "deepseek", {"total_tokens": 50})),
        ),
    ):
        out = await WayraAnswerService.try_answer(req, WayraMode.TRAVEL)

    assert out is not None
    assert out.sources[0].source_type == "wikipedia"
    assert out.summary and out.summary.get("provider") == "deepseek"


def test_extract_place_from_user_location():
    ctx = {
        "userLocation": {"lat": 41.88, "lng": -87.63, "city": "Chicago", "state": "IL"},
    }
    place = extract_place_from_context(ctx)
    assert place is not None
    assert place["name"] == "Your location"
    assert place["city"] == "Chicago"


@pytest.mark.asyncio
async def test_location_hard_how_far_uses_local_distance_without_llm():
    req = AIAssistantRequest(
        page="live",
        user_message="How far is it from me?",
        context={
            "pathname": "/live",
            "selectedPlace": {
                "name": "Red Square",
                "lat": 55.7539,
                "lng": 37.6208,
                "city": "Moscow",
                "country": "Russia",
            },
            "userLocation": {
                "lat": 40.7128,
                "lng": -74.0060,
                "city": "New York",
                "country": "United States",
            },
        },
    )
    out = await WayraAnswerService.try_answer(req, WayraMode.TRAVEL)

    assert out is not None
    assert out.summary and out.summary.get("provider") == "local"
    assert "mi" in out.message.lower()
    assert "Red Square" in out.message
    assert "New York" in out.message


@pytest.mark.asyncio
async def test_nearby_with_user_location_only():
    req = AIAssistantRequest(
        page="live",
        user_message="Any pharmacies near me?",
        context={
            "pathname": "/live",
            "userLocation": {"lat": 41.88, "lng": -87.63, "city": "Chicago"},
        },
    )
    fake_sources = [
        WayraSource(label="CVS · 0.3 mi", url="https://www.openstreetmap.org/node/1", source_type="osm"),
    ]
    with (
        patch(
            "app.services.wayra_answer_service.fetch_nearby_sources",
            new=AsyncMock(return_value=(fake_sources, "Nearby pharmacy: CVS (0.3 mi)")),
        ),
        patch(
            "app.services.wayra_answer_service.summarize_from_sources",
            new=AsyncMock(return_value=("Two pharmacies are nearby.", "template", None)),
        ),
    ):
        out = await WayraAnswerService.try_answer(req, WayraMode.TRAVEL)

    assert out is not None
    assert out.summary and out.summary.get("needs_location") is not True
    assert len(out.sources) == 1
