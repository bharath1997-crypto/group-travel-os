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
    assert "Pipsuk Avenue" in queries
    assert "Kaktovik" in queries
    assert "Kaktovik, Alaska" in queries


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
