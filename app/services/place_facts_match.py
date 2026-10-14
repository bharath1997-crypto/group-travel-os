"""OSM ↔ Overture place matching for place_facts (F50 §4)."""
from __future__ import annotations

import math
import re
from collections import defaultdict
from typing import Any, Iterable, Protocol, TypeVar
from urllib.parse import urlparse

MATCH_RADIUS_M = 50.0
OSM_GRID_CELL_M = 100.0

_WIKIDATA_TAG = re.compile(r"^Q\d+$", re.IGNORECASE)
_STRIP_CHARS = re.compile(r"[^\w\s]", re.UNICODE)


def normalize_place_name(name: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace — no fuzzy match."""
    raw = (name or "").strip().lower()
    cleaned = _STRIP_CHARS.sub(" ", raw)
    return " ".join(cleaned.split())


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def _normalize_website(url: str | None) -> str | None:
    if not url:
        return None
    u = url.strip()
    if not u:
        return None
    if not u.startswith(("http://", "https://")):
        u = f"https://{u}"
    try:
        parsed = urlparse(u)
        host = (parsed.netloc or "").lower().removeprefix("www.")
        path = (parsed.path or "").rstrip("/")
        return f"{host}{path}" if host else None
    except ValueError:
        return None


def _wikidata_from_osm_tags(tags: dict[str, Any]) -> str | None:
    for key in ("wikidata", "ref:wikidata"):
        val = tags.get(key)
        if isinstance(val, str) and _WIKIDATA_TAG.match(val.strip()):
            return val.strip().upper()
    return None


def osm_matches_place(
    *,
    place_name: str,
    place_lat: float,
    place_lon: float,
    place_wikidata_qid: str | None,
    place_website: str | None,
    osm_name: str | None,
    osm_lat: float,
    osm_lon: float,
    osm_tags: dict[str, Any],
    max_radius_m: float = MATCH_RADIUS_M,
) -> bool:
    dist = haversine_meters(place_lat, place_lon, osm_lat, osm_lon)
    if dist > max_radius_m:
        return False

    osm_qid = _wikidata_from_osm_tags(osm_tags)
    place_qid = (place_wikidata_qid or "").strip().upper() or None
    if place_qid and osm_qid and place_qid == osm_qid:
        return True

    place_site = _normalize_website(place_website)
    osm_site = _normalize_website(
        osm_tags.get("website") or osm_tags.get("contact:website") or osm_tags.get("url")
    )
    if place_site and osm_site and place_site == osm_site:
        return True

    place_norm = normalize_place_name(place_name)
    osm_norm = normalize_place_name(osm_name or "")
    if not place_norm or not osm_norm:
        return False
    return place_norm == osm_norm


OSM_FACT_KEYS = ("opening_hours", "wheelchair", "website", "phone", "cuisine")


def osm_fact_rows_from_tags(
    tags: dict[str, Any],
    *,
    source_url: str | None,
) -> list[dict[str, str]]:
    """Raw tag values only — provider-stated."""
    out: list[dict[str, str]] = []
    for key in OSM_FACT_KEYS:
        if key == "phone":
            raw = tags.get("phone") or tags.get("contact:phone")
        elif key == "website":
            raw = tags.get("website") or tags.get("contact:website") or tags.get("url")
        else:
            raw = tags.get(key)
        if raw is None:
            continue
        value = str(raw).strip()
        if not value:
            continue
        out.append(
            {
                "key": key,
                "value": value,
                "source": "osm",
                "source_url": source_url or "",
                "license": "ODbL",
                "attribution": "© OpenStreetMap contributors",
            }
        )
    return out


class _OsmLike(Protocol):
    lat: float
    lon: float
    name: str | None
    tags: dict[str, Any]


P = TypeVar("P", bound=_OsmLike)


def _cell_degrees(lat: float) -> tuple[float, float]:
    m_per_deg_lat = 111_320.0
    m_per_deg_lon = max(m_per_deg_lat * math.cos(math.radians(lat)), 1e-6)
    return OSM_GRID_CELL_M / m_per_deg_lat, OSM_GRID_CELL_M / m_per_deg_lon


def osm_grid_key(lat: float, lon: float) -> tuple[int, int]:
    dlat, dlon = _cell_degrees(lat)
    return (int(math.floor(lat / dlat)), int(math.floor(lon / dlon)))


def build_osm_spatial_index(pois: Iterable[P]) -> dict[tuple[int, int], list[P]]:
    index: dict[tuple[int, int], list[P]] = defaultdict(list)
    for poi in pois:
        index[osm_grid_key(poi.lat, poi.lon)].append(poi)
    return index


def neighbouring_osm_cells(lat: float, lon: float) -> list[tuple[int, int]]:
    ci, cj = osm_grid_key(lat, lon)
    return [(ci + di, cj + dj) for di in (-1, 0, 1) for dj in (-1, 0, 1)]


def iter_osm_candidates(
    index: dict[tuple[int, int], list[P]],
    lat: float,
    lon: float,
) -> Iterable[P]:
    seen: set[int] = set()
    for key in neighbouring_osm_cells(lat, lon):
        for poi in index.get(key, ()):
            oid = id(poi)
            if oid in seen:
                continue
            seen.add(oid)
            yield poi


def first_osm_match_for_place(
    place: dict[str, Any],
    pois: Iterable[P],
) -> P | None:
    plat, plon = float(place["lat"]), float(place["lon"])
    for poi in pois:
        if osm_matches_place(
            place_name=str(place["name"]),
            place_lat=plat,
            place_lon=plon,
            place_wikidata_qid=place.get("wikidata_qid"),
            place_website=place.get("website"),
            osm_name=poi.name,
            osm_lat=poi.lat,
            osm_lon=poi.lon,
            osm_tags=poi.tags,
        ):
            return poi
    return None


def match_places_to_osm_brute(
    places: list[dict[str, Any]],
    pois: list[P],
) -> list[tuple[str, P]]:
    """Return (place_key, poi) pairs in place list order; place_key = gers_id or id."""
    out: list[tuple[str, P]] = []
    for place in places:
        poi = first_osm_match_for_place(place, pois)
        if poi is not None:
            key = str(place.get("gers_id") or place.get("id"))
            out.append((key, poi))
    return out


def match_places_to_osm_indexed(
    places: list[dict[str, Any]],
    pois: list[P],
) -> list[tuple[str, P]]:
    index = build_osm_spatial_index(pois)
    poi_rank = {id(p): i for i, p in enumerate(pois)}
    out: list[tuple[str, P]] = []
    for place in places:
        plat, plon = float(place["lat"]), float(place["lon"])
        candidates = sorted(
            iter_osm_candidates(index, plat, plon),
            key=lambda p: poi_rank[id(p)],
        )
        poi = first_osm_match_for_place(place, candidates)
        if poi is not None:
            key = str(place.get("gers_id") or place.get("id"))
            out.append((key, poi))
    return out
