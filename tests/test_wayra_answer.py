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
    is_structured_nearby_list_request,
    nearby_category_from_message,
    nearby_result_limit,
)


def test_nearby_category_pharmacy():
    assert nearby_category_from_message("Any pharmacies near me?") == "pharmacy"


def test_classify_nearby_tier():
    tier = classify_wayra_answer_tier("Find hospitals nearby", {})
    assert tier == "nearby"


def test_structured_restaurant_list_request():
    msg = "Give me a list of 15-20 restaurants with locations and date and time of opening."
    assert is_structured_nearby_list_request(msg) is True
    assert nearby_category_from_message(msg) == "food"
    assert nearby_result_limit(msg) == 20


@pytest.mark.asyncio
async def test_restaurant_list_on_live_uses_hybrid_then_llm_cascade():
    req = AIAssistantRequest(
        page="live",
        user_message="Give me a list of 15-20 restaurants with locations and date and time of opening.",
        context={
            "pathname": "/live",
            "selectedPlace": {
                "name": "Dropped pin",
                "lat": 58.66610,
                "lng": -121.43960,
                "state": "British Columbia",
                "country": "Canada",
            },
        },
    )
    fake_sources = [
        WayraSource(label="Search nearby on map", url="https://maps.example", source_type="maps"),
    ]
    with (
        patch(
            "app.services.wayra_answer_service.fetch_nearby_sources",
            new=AsyncMock(return_value=(fake_sources, "No food found", [])),
        ),
        patch(
            "app.services.wayra_answer_service.summarize_from_sources",
            new=AsyncMock(return_value=("No mapped restaurants; try Fort Nelson.", "deepseek", None)),
        ),
    ):
        out = await WayraAnswerService.try_answer(req, WayraMode.TRAVEL)

    assert out is not None
    assert out.summary and out.summary.get("provider") == "deepseek"


@pytest.mark.asyncio
async def test_activities_question_on_live_uses_discovery_hybrid():
    req = AIAssistantRequest(
        page="live",
        user_message="what we do, what we should do?",
        context={
            "pathname": "/live",
            "selectedPlace": {
                "name": "Dropped pin",
                "lat": 58.66610,
                "lng": -121.43960,
                "state": "British Columbia",
                "country": "Canada",
            },
        },
    )
    fake_sources = [
        WayraSource(
            label="Wikipedia · Northern British Columbia",
            url="https://en.wikipedia.org/wiki/Northern_Interior",
            source_type="wikipedia",
        ),
    ]
    with (
        patch(
            "app.services.wayra_answer_service.fetch_discovery_sources",
            new=AsyncMock(return_value=(fake_sources, "Wikipedia: Vast boreal forests.")),
        ),
        patch(
            "app.services.wayra_answer_service.summarize_from_sources",
            new=AsyncMock(return_value=("Wildlife viewing and hiking are common here.", "deepseek", None)),
        ),
    ):
        out = await WayraAnswerService.try_answer(req, WayraMode.TRAVEL)

    assert out is not None
    assert out.summary and out.summary.get("provider") == "deepseek"


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
            new=AsyncMock(return_value=(fake_sources, "Nearby pharmacy: CVS (0.3 mi)", [])),
        ),
        patch(
            "app.services.wayra_answer_service.summarize_from_sources",
            new=AsyncMock(return_value=("Two pharmacies are within walking distance.", "deepseek", None)),
        ),
    ):
        out = await WayraAnswerService.try_answer(req, WayraMode.TRAVEL)

    assert out is not None
    assert out.summary and out.summary.get("provider") == "deepseek"


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
            new=AsyncMock(return_value=(fake_sources, "Nearby pharmacy: CVS (0.3 mi)", [])),
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
