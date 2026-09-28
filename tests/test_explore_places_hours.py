from __future__ import annotations

from app.services.explore_city_extended_service import opening_hours_from_osm_tags


def test_opening_hours_from_osm_tags_returns_source_when_present() -> None:
    hours, source = opening_hours_from_osm_tags({"opening_hours": "Mo-Fr 09:00-17:00"})
    assert hours == "Mo-Fr 09:00-17:00"
    assert source == "openstreetmap"


def test_opening_hours_24_7_preserved_verbatim() -> None:
    hours, source = opening_hours_from_osm_tags({"opening_hours": "24/7"})
    assert hours == "24/7"
    assert source == "openstreetmap"


def test_opening_hours_missing_returns_none() -> None:
    assert opening_hours_from_osm_tags({}) == (None, None)
    assert opening_hours_from_osm_tags({"opening_hours": "  "}) == (None, None)
