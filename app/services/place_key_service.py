"""Stable placeKey generation for lazy place registry lookups."""
from __future__ import annotations

import re

_OSM_TYPES = frozenset({"node", "way", "relation"})


def normalize_place_token(value: str | None, *, max_len: int = 80) -> str:
    if not value or not str(value).strip():
        return "unknown"
    s = str(value).strip().lower()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s-]+", "_", s).strip("_")
    return (s[:max_len] or "unknown")


def build_place_key(
    *,
    name: str,
    lat: float,
    lng: float,
    city: str | None = None,
    country: str | None = None,
    osm_type: str | None = None,
    osm_id: int | str | None = None,
) -> str:
    """Prefer osm:{type}:{id}; fallback to normalized name + rounded coords."""
    if osm_type and osm_id is not None:
        ot = str(osm_type).strip().lower()
        if ot in _OSM_TYPES:
            return f"osm:{ot}:{int(osm_id)}"

    norm_name = normalize_place_token(name, max_len=80)
    rlat = round(float(lat), 4)
    rlng = round(float(lng), 4)
    city_part = normalize_place_token(city, max_len=60)
    country_part = normalize_place_token(country, max_len=60)
    return f"source:{norm_name}:{rlat}:{rlng}:{city_part}:{country_part}"
