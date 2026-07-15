"""Tests for live Wikipedia summary lookups (no DB storage)."""
from __future__ import annotations

import pytest

from app.services.place_wikipedia_service import PlaceWikipediaService


def test_lookup_candidates_falls_back_to_city():
    candidates = PlaceWikipediaService._lookup_candidates(
        name="Pipsuk Avenue",
        city="Kaktovik",
        state="Alaska",
        country="United States",
        wikipedia_title=None,
    )
    queries = [q for _, q in candidates]
    assert "Pipsuk Avenue" not in queries
    assert "Kaktovik" in queries
    assert "Kaktovik, Alaska" in queries


def test_street_like_name_skipped_in_candidates():
    candidates = PlaceWikipediaService._lookup_candidates(
        name="North Kildare Avenue",
        city="Chicago",
        state="Illinois",
        country="United States",
        wikipedia_title=None,
    )
    queries = [q for _, q in candidates]
    assert "North Kildare Avenue" not in queries
    assert "Chicago" in queries
    assert "Chicago, Illinois" in queries


def test_is_street_like_name():
    from app.services.place_wikipedia_service import _is_street_like_name

    assert _is_street_like_name("North Kildare Avenue") is True
    assert _is_street_like_name("1625 N Pulaski Rd") is True
    assert _is_street_like_name("Millennium Park") is False
    assert _is_street_like_name("Chicago") is False


def test_map_pick_is_eligible_for_address():
    assert PlaceWikipediaService._is_lookup_eligible(
        name="Pipsuk Avenue",
        category="Address",
        source="map_pick",
        wikidata_id=None,
        wikipedia_title=None,
        city="Kaktovik",
    )


@pytest.mark.asyncio
async def test_get_wiki_summary_uses_city_fallback(monkeypatch):
    calls: list[str] = []

    async def fake_search(client, query):
        calls.append(query)
        if query == "Pipsuk Avenue":
            return None
        if query == "Kaktovik":
            return "Kaktovik, Alaska"
        return None

    async def fake_fetch(client, title):
        if title == "Kaktovik, Alaska":
            return {
                "title": "Kaktovik, Alaska",
                "extract": "Kaktovik is a city in North Slope Borough, Alaska.",
                "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Kaktovik,_Alaska"}},
            }
        return None

    async def fake_geo(client, lat, lng, **kwargs):
        return None

    monkeypatch.setattr("app.services.place_wikipedia_service._search_title", fake_search)
    monkeypatch.setattr("app.services.place_wikipedia_service._fetch_summary", fake_fetch)
    monkeypatch.setattr("app.services.place_wikipedia_service._geosearch_title", fake_geo)
    monkeypatch.setattr("app.services.place_wikipedia_service._get_from_cache", lambda key: None)
    monkeypatch.setattr("app.services.place_wikipedia_service._set_to_cache", lambda key, value: None)

    result = await PlaceWikipediaService.get_wiki_summary(
        name="Pipsuk Avenue",
        category="Address",
        lat=70.12564,
        lng=-143.60787,
        city="Kaktovik",
        state="Alaska",
        country="United States",
        source="map_pick",
    )

    assert result["available"] is True
    assert result["matchedOn"] == "city"
    assert "Kaktovik" in result["summary"]
    assert "Kaktovik" in calls


@pytest.mark.asyncio
async def test_street_address_rejects_distant_name_match(monkeypatch):
    async def fake_search(client, query):
        if query == "North Kildare Avenue":
            return "Kildare, Edmonton"
        if query == "Chicago":
            return "Chicago"
        return None

    async def fake_fetch(client, title):
        if title == "Kildare, Edmonton":
            return {
                "title": "Kildare, Edmonton",
                "extract": "Kildare is a neighbourhood in northeast Edmonton, Alberta, Canada.",
                "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Kildare,_Edmonton"}},
            }
        if title == "Chicago":
            return {
                "title": "Chicago",
                "extract": "Chicago is the most populous city in Illinois.",
                "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Chicago"}},
            }
        if title == "Hermosa, Chicago":
            return {
                "title": "Hermosa, Chicago",
                "extract": "Hermosa is a community area on the northwest side of Chicago.",
                "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Hermosa,_Chicago"}},
            }
        return None

    async def fake_geo(client, lat, lng, **kwargs):
        return "Hermosa, Chicago"

    async def fake_nearby(client, lat, lng, **kwargs):
        return {"hermosa, chicago", "chicago"}

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
    assert "Edmonton" not in result["summary"]
    assert result["matchedOn"] in {"nearby", "city"}
