"""Tests for lazy place enrichment on map selection."""
from __future__ import annotations

import pytest

from app.services.place_enrichment_service import (
    _parse_nominatim,
    enrich_place,
)


def test_parse_nominatim_builds_formatted_address():
    data = {
        "display_name": "Long fallback",
        "address": {
            "house_number": "100",
            "road": "Michigan Ave",
            "city": "Chicago",
            "state": "Illinois",
            "postcode": "60603",
        },
    }
    out = _parse_nominatim(data)
    assert out["formatted_address"] == "100 Michigan Ave, Chicago, Illinois, 60603"
    assert out["city"] == "Chicago"
    assert out["state"] == "Illinois"


@pytest.mark.asyncio
async def test_enrich_place_uses_nominatim_and_wikipedia(monkeypatch):
    async def fake_reverse(client, lat, lon):
        return {
            "formatted_address": "100 Michigan Ave, Chicago, IL",
            "street": "100 Michigan Ave",
            "city": "Chicago",
            "state": "Illinois",
            "postcode": "60603",
        }

    async def fake_wiki_coords(client, lat, lon, name):
        return {
            "image_url": "https://upload.wikimedia.org/example.jpg",
            "description": "A historic monument.",
            "wikipedia_url": "https://en.wikipedia.org/wiki/Test",
        }

    async def fake_wiki_name(client, name):
        return {"image_url": "", "description": "", "wikipedia_url": ""}

    async def fake_route(client, o_lat, o_lon, d_lat, d_lon):
        return {
            "distance_miles": 2.1,
            "duration_minutes": 8,
            "polyline": [[41.88, -87.63], [41.89, -87.62]],
        }

    monkeypatch.setattr(
        "app.services.place_enrichment_service._reverse_geocode",
        fake_reverse,
    )
    monkeypatch.setattr(
        "app.services.place_enrichment_service._wikipedia_by_coords",
        fake_wiki_coords,
    )
    monkeypatch.setattr(
        "app.services.place_enrichment_service._wikipedia_by_name",
        fake_wiki_name,
    )
    monkeypatch.setattr(
        "app.services.place_enrichment_service._driving_route",
        fake_route,
    )
    monkeypatch.setattr(
        "app.services.place_enrichment_service._load_row",
        lambda db, eid: None,
    )
    monkeypatch.setattr(
        "app.services.place_enrichment_service._persist_enrichment",
        lambda db, row, data: None,
    )

    result = await enrich_place(
        db=None,  # type: ignore[arg-type]
        event_id="osm_landmarks_123",
        lat=41.8781,
        lon=-87.6298,
        name="Marquette Monument",
        origin_lat=41.88,
        origin_lon=-87.63,
    )

    assert result["formatted_address"] == "100 Michigan Ave, Chicago, IL"
    assert result["image_url"].startswith("https://")
    assert result["route"]["duration_minutes"] == 8
