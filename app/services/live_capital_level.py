"""OSM capital admin levels and zoom-based visibility for Live discovery layer."""
from __future__ import annotations

from typing import Any

# OSM `capital=*` — https://wiki.openstreetmap.org/wiki/Key:capital
CAPITAL_LEVEL_NATIONAL = 2
CAPITAL_LEVEL_STATE_PROVINCE = 4
CAPITAL_LEVEL_DISTRICT = 6
CAPITAL_LEVEL_MUNICIPAL = 8

def parse_osm_capital_level(tags: dict[str, Any]) -> int | None:
    raw = tags.get("capital")
    if raw is None:
        return None
    text = str(raw).strip().lower()
    if text in ("yes", "true", "1"):
        return CAPITAL_LEVEL_NATIONAL
    try:
        level = int(text)
    except ValueError:
        return None
    if level in (2, 4, 6, 8):
        return level
    if level <= 2:
        return CAPITAL_LEVEL_NATIONAL
    if level <= 4:
        return CAPITAL_LEVEL_STATE_PROVINCE
    if level <= 6:
        return CAPITAL_LEVEL_DISTRICT
    return CAPITAL_LEVEL_MUNICIPAL


def is_government_seat_building(tags: dict[str, Any]) -> bool:
    if tags.get("amenity") == "townhall":
        return True
    if tags.get("building") == "government":
        return True
    if tags.get("historic") == "government":
        return True
    if tags.get("office") == "government" and tags.get("government") == "administrative":
        return True
    return False


def is_capital_related_poi(tags: dict[str, Any]) -> bool:
    if parse_osm_capital_level(tags) is not None:
        return True
    place = str(tags.get("place") or "").lower()
    if place in ("city", "town", "municipality") and tags.get("capital"):
        return True
    return is_government_seat_building(tags)


def capital_levels_visible_at_zoom(zoom: float | None) -> frozenset[int]:
    """More local capitals appear as the user zooms in."""
    if zoom is None:
        return frozenset(
            {
                CAPITAL_LEVEL_NATIONAL,
                CAPITAL_LEVEL_STATE_PROVINCE,
                CAPITAL_LEVEL_DISTRICT,
                CAPITAL_LEVEL_MUNICIPAL,
            }
        )
    if zoom < 10:
        return frozenset({CAPITAL_LEVEL_NATIONAL})
    if zoom < 12:
        return frozenset({CAPITAL_LEVEL_NATIONAL, CAPITAL_LEVEL_STATE_PROVINCE})
    if zoom < 14:
        return frozenset(
            {
                CAPITAL_LEVEL_NATIONAL,
                CAPITAL_LEVEL_STATE_PROVINCE,
                CAPITAL_LEVEL_DISTRICT,
            }
        )
    return frozenset(
        {
            CAPITAL_LEVEL_NATIONAL,
            CAPITAL_LEVEL_STATE_PROVINCE,
            CAPITAL_LEVEL_DISTRICT,
            CAPITAL_LEVEL_MUNICIPAL,
        }
    )


def government_buildings_visible_at_zoom(zoom: float | None) -> bool:
    return zoom is not None and zoom >= 13


def capital_visible_for_zoom(tags: dict[str, Any], zoom: float | None) -> bool:
    level = parse_osm_capital_level(tags)
    if level is not None:
        return level in capital_levels_visible_at_zoom(zoom)
    if is_government_seat_building(tags):
        return government_buildings_visible_at_zoom(zoom)
    return True


def zoom_capital_cache_bucket(zoom: float | None) -> str:
    if zoom is None:
        return "cap-all"
    if zoom < 10:
        return "cap-z9"
    if zoom < 12:
        return "cap-z11"
    if zoom < 14:
        return "cap-z13"
    return "cap-z14"


def capital_category_label(tags: dict[str, Any]) -> str | None:
    """Human label for a capital node; None if not a capital place."""
    level = parse_osm_capital_level(tags)
    name_lower = str(tags.get("name") or "").lower()
    if "capitol" in name_lower and tags.get("amenity") == "townhall":
        return "Capitol"
    if level is None:
        if is_government_seat_building(tags):
            if "capitol" in name_lower:
                return "Capitol"
            if tags.get("amenity") == "townhall":
                return "Town hall"
            return "Government building"
        return None

    if level <= CAPITAL_LEVEL_NATIONAL:
        return "National capital"
    if level == CAPITAL_LEVEL_STATE_PROVINCE:
        country = str(
            tags.get("addr:country")
            or tags.get("is_in:country_code")
            or tags.get("country")
            or "",
        ).upper()
        if country in ("US", "USA", "UNITED STATES"):
            return "State capital"
        return "Province capital"
    if level == CAPITAL_LEVEL_DISTRICT:
        return "District capital"
    return "Municipality capital"
