"""QA audit fixes: nearby routing + Wikipedia approximate flag."""

from __future__ import annotations

import pytest

from app.services.place_wikipedia_service import PlaceWikipediaService, _build_summary_result
from app.services.wayra_source_intent import classify_wayra_answer_tier, nearby_category_from_message


def test_wiki_approximate_flag_for_region_match():
    result = _build_summary_result(
        {
            "title": "Hermosa, Chicago",
            "extract": "Hermosa is a community area.",
            "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Hermosa,_Chicago"}},
        },
        "city",
    )
    assert result["approximate"] is True
    assert result["matchedOn"] == "city"


def test_wiki_exact_place_not_approximate():
    result = _build_summary_result(
        {
            "title": "Millennium Park",
            "extract": "Millennium Park is a public park.",
            "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Millennium_Park"}},
        },
        "place",
    )
    assert result["approximate"] is False


def test_multi_category_nearby_uses_all():
    msg = "What restaurants, cafes, or attractions are near this exact spot?"
    assert nearby_category_from_message(msg) == "all"
    assert classify_wayra_answer_tier(msg, {"pathname": "/live"}) == "nearby"


def test_hamlin_composite_whats_here_is_discovery():
    from app.services.wayra_behavior_hints import is_composite_whats_here_question

    msg = "What's here, how far is it, and how should I prepare?"
    assert is_composite_whats_here_question(msg) is True
    ctx = {
        "pathname": "/live",
        "userLocation": {"lat": 41.8781, "lng": -87.6298, "city": "Chicago"},
        "selectedPlace": {"lat": 41.962, "lng": -87.76, "name": "Hamlin Park"},
    }
    assert classify_wayra_answer_tier(msg, ctx) == "discovery"


@pytest.mark.asyncio
async def test_street_pin_tries_name_before_geosearch(monkeypatch):
    call_order: list[str] = []

    async def fake_search(client, query):
        call_order.append(f"search:{query}")
        if query == "Chicago":
            return "Chicago"
        return None

    async def fake_fetch(client, title):
        if title == "Chicago":
            return {
                "title": "Chicago",
                "extract": "Chicago is a city in Illinois.",
                "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Chicago"}},
            }
        return None

    async def fake_geo(client, lat, lng, **kwargs):
        call_order.append("geo")
        return "Hermosa, Chicago"

    async def fake_nearby(client, lat, lng, **kwargs):
        return {"chicago", "hermosa, chicago"}

    monkeypatch.setattr("app.services.place_wikipedia_service._search_title", fake_search)
    monkeypatch.setattr("app.services.place_wikipedia_service._fetch_summary", fake_fetch)
    monkeypatch.setattr("app.services.place_wikipedia_service._geosearch_title", fake_geo)
    monkeypatch.setattr(
        "app.services.place_wikipedia_service._geosearch_nearby_titles",
        fake_nearby,
    )
    monkeypatch.setattr("app.services.place_wikipedia_service._get_from_cache", lambda key: None)
    monkeypatch.setattr("app.services.place_wikipedia_service._set_to_cache", lambda key, value: None)

    result = await PlaceWikipediaService.get_wiki_summary(
        name="North Kildare Avenue",
        category="Address",
        lat=41.9106,
        lng=-87.7330,
        city="Chicago",
        state="Illinois",
        country="United States",
        source="search",
    )

    assert result["available"] is True
    assert result["matchedOn"] == "city"
    assert result["approximate"] is True
    assert call_order == ["search:Chicago"]
    assert "geo" not in call_order
