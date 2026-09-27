"""Live map discovery layer — bbox Overpass proxy with cache and spine merge."""
from __future__ import annotations

import logging
import math
import re
import time
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.services.live_search_taxonomy_service import merged_osm_queries_for_category
from app.services.places_nearby_service import (
    OVERPASS_MIRRORS,
    OVERPASS_USER_AGENT,
    HTTP_TIMEOUT_SECONDS,
    PlacesNearbyService,
    normalize_poi_result,
)

LIVE_LAYER_HTTP_TIMEOUT_SECONDS = 25.0
from app.services.live_capital_level import (
    capital_visible_for_zoom,
    is_capital_related_poi,
    zoom_capital_cache_bucket,
)
from app.services.place_spine_service import PlaceSpineService, DEFAULT_SPINE_NEAR_RADIUS_M
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)

LIVE_LAYER_DEFAULT_CATS = (
    "parks",
    "national_parks",
    "capitals",
    "historic_sites",
    "monuments",
    "viewpoints",
)
LIVE_LAYER_MAX_PINS = 120
LIVE_LAYER_MAX_AREA_KM2 = 60.0


def max_area_km2_for_zoom(zoom: float | None) -> float:
    """Smaller query footprint when zoomed out — center clamp, not full viewport."""
    if zoom is None:
        return LIVE_LAYER_MAX_AREA_KM2
    if zoom >= 14:
        return 60.0
    if zoom >= 10:
        return 35.0
    return 22.0
LIVE_LAYER_CACHE_TTL_SECONDS = 604800  # 7 days
LIVE_LAYER_SNAP_DEG = 0.01
LIVE_LAYER_IP_WINDOW_SECONDS = 60
LIVE_LAYER_IP_MAX_REQUESTS = 40

_layer_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}
_ip_buckets: dict[str, list[float]] = {}


def _round_bbox(value: float) -> float:
    return round(value / LIVE_LAYER_SNAP_DEG) * LIVE_LAYER_SNAP_DEG


def snap_bbox(south: float, west: float, north: float, east: float) -> tuple[float, float, float, float]:
    return (
        _round_bbox(south),
        _round_bbox(west),
        _round_bbox(north),
        _round_bbox(east),
    )


def bbox_area_km2(south: float, west: float, north: float, east: float) -> float:
    mid_lat = (south + north) / 2.0
    lat_km = abs(north - south) * 111.0
    lng_km = abs(east - west) * 111.0 * max(0.2, math.cos(math.radians(mid_lat)))
    return lat_km * lng_km


def clamp_bbox_area(
    south: float,
    west: float,
    north: float,
    east: float,
    max_km2: float = LIVE_LAYER_MAX_AREA_KM2,
) -> tuple[float, float, float, float]:
    if bbox_area_km2(south, west, north, east) <= max_km2:
        return south, west, north, east
    mid_lat = (south + north) / 2.0
    mid_lng = (west + east) / 2.0
    side_deg = math.sqrt(max_km2 / 111.0 / max(0.2, math.cos(math.radians(mid_lat)))) / 2.0
    return (
        mid_lat - side_deg,
        mid_lng - side_deg,
        mid_lat + side_deg,
        mid_lng + side_deg,
    )


_AROUND_RE = re.compile(
    r"\(around:\{radius\},\{lat\},\{lng\}\)",
    re.IGNORECASE,
)


def _queries_to_bbox(subqueries: list[str], south: float, west: float, north: float, east: float) -> str:
    bbox = f"({south},{west},{north},{east})"
    converted: list[str] = []
    for q in subqueries:
        line = _AROUND_RE.sub(bbox, q)
        converted.append(line)
    return "\n".join(converted)


def _cache_key(
    bbox: tuple[float, float, float, float],
    cats: tuple[str, ...],
    zoom: float | None,
) -> str:
    s, w, n, e = bbox
    cap_bucket = zoom_capital_cache_bucket(zoom) if "capitals" in cats else "no-cap"
    return f"{','.join(cats)}|{cap_bucket}|{s:.2f},{w:.2f},{n:.2f},{e:.2f}"


LAYER_CATEGORY_QUOTAS: dict[str, int] = {
    "capitals": 35,
    "national_parks": 18,
    "parks": 22,
    "historic_sites": 22,
    "monuments": 18,
    "viewpoints": 18,
}


def _poi_discovery_bucket(poi: dict[str, Any]) -> str:
    tags = poi.get("tags") or {}
    cat = str(poi.get("category") or "").lower()
    if is_capital_related_poi(tags) or any(
        token in cat
        for token in ("capital", "capitol", "town hall", "government building")
    ):
        return "capitals"
    if "national park" in cat or tags.get("boundary") == "national_park":
        return "national_parks"
    if cat == "park" or tags.get("leisure") == "park":
        return "parks"
    if tags.get("historic") or "historic" in cat or cat in ("monument", "memorial", "castle", "ruins"):
        if cat in ("monument", "memorial", "obelisk") or tags.get("historic") in (
            "monument",
            "memorial",
        ):
            return "monuments"
        return "historic_sites"
    if cat == "viewpoint" or tags.get("tourism") == "viewpoint":
        return "viewpoints"
    return "other"


def _balance_layer_pois(
    pois: list[dict[str, Any]],
    cat_list: tuple[str, ...],
    max_total: int = LIVE_LAYER_MAX_PINS,
) -> list[dict[str, Any]]:
    """Avoid one dense OSM area (e.g. a large park) consuming the entire pin budget."""
    by_cat: dict[str, list[dict[str, Any]]] = {c: [] for c in cat_list}
    by_cat["other"] = []
    for poi in pois:
        bucket = _poi_discovery_bucket(poi)
        if bucket in by_cat:
            by_cat[bucket].append(poi)
        else:
            by_cat["other"].append(poi)

    merged: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for cat in cat_list:
        quota = LAYER_CATEGORY_QUOTAS.get(cat, 15)
        for poi in by_cat.get(cat, [])[:quota]:
            osm_key = (str(poi.get("osmType") or ""), str(poi.get("osmId") or ""))
            if osm_key[0] and osm_key[1] and osm_key in seen:
                continue
            if osm_key[0] and osm_key[1]:
                seen.add(osm_key)
            merged.append(poi)
            if len(merged) >= max_total:
                return merged

    for poi in by_cat.get("other", []):
        if len(merged) >= max_total:
            break
        osm_key = (str(poi.get("osmType") or ""), str(poi.get("osmId") or ""))
        if osm_key[0] and osm_key[1] and osm_key in seen:
            continue
        if osm_key[0] and osm_key[1]:
            seen.add(osm_key)
        merged.append(poi)

    return merged[:max_total]


def _filter_capitals_for_zoom(
    pois: list[dict[str, Any]],
    zoom: float | None,
    cat_list: tuple[str, ...],
) -> list[dict[str, Any]]:
    if "capitals" not in cat_list:
        return pois
    filtered: list[dict[str, Any]] = []
    for poi in pois:
        tags = poi.get("tags") or {}
        if is_capital_related_poi(tags) and not capital_visible_for_zoom(tags, zoom):
            continue
        filtered.append(poi)
    return filtered


def check_ip_budget(client_ip: str) -> None:
    now = time.time()
    bucket = _ip_buckets.get(client_ip, [])
    bucket = [t for t in bucket if now - t < LIVE_LAYER_IP_WINDOW_SECONDS]
    if len(bucket) >= LIVE_LAYER_IP_MAX_REQUESTS:
        AppException.bad_request("Rate limit exceeded")
    bucket.append(now)
    _ip_buckets[client_ip] = bucket


def _dedupe_pois(pois: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen_osm: set[tuple[str, str]] = set()
    seen_gers: set[str] = set()
    out: list[dict[str, Any]] = []
    for poi in pois:
        osm_key = (str(poi.get("osmType") or ""), str(poi.get("osmId") or ""))
        if osm_key[0] and osm_key[1] and osm_key in seen_osm:
            continue
        gers = str(poi.get("gersId") or poi.get("gers_id") or "").strip()
        if gers and gers in seen_gers:
            continue
        if osm_key[0] and osm_key[1]:
            seen_osm.add(osm_key)
        if gers:
            seen_gers.add(gers)
        out.append(poi)
    return out


def _radius_meters_for_zoom(zoom: float | None) -> int:
    area_km2 = max_area_km2_for_zoom(zoom)
    return max(1500, min(8000, int(1000 * math.sqrt(area_km2 / math.pi))))


async def _fetch_via_nearby_fallback(
    center_lat: float,
    center_lng: float,
    cat_list: tuple[str, ...],
    zoom: float | None,
) -> list[dict[str, Any]]:
    """When bbox Overpass fails, reuse the proven nearby (around) queries."""
    radius_m = _radius_meters_for_zoom(zoom)
    per_cat = max(20, LIVE_LAYER_MAX_PINS // max(1, len(cat_list)))
    merged: list[dict[str, Any]] = []
    seen_osm: set[tuple[str, str]] = set()
    for cat in cat_list:
        batch = await PlacesNearbyService.search_nearby_places(
            category=cat,
            lat=center_lat,
            lng=center_lng,
            radius_meters=radius_m,
            limit=per_cat,
        )
        for poi in batch:
            osm_key = (str(poi.get("osmType") or ""), str(poi.get("osmId") or ""))
            if osm_key[0] and osm_key[1] and osm_key in seen_osm:
                continue
            if osm_key[0] and osm_key[1]:
                seen_osm.add(osm_key)
            merged.append(poi)
    merged.sort(key=lambda p: p.get("distanceMiles") or 9999)
    return merged[:LIVE_LAYER_MAX_PINS]


def attach_spine_to_pois(db: Session, pois: list[dict[str, Any]]) -> list[dict[str, Any]]:
    enriched: list[dict[str, Any]] = []
    for poi in pois:
        lat = float(poi["lat"])
        lng = float(poi["lng"])
        try:
            detail = PlaceSpineService.get_nearest(
                db,
                lat=lat,
                lon=lng,
                radius_meters=DEFAULT_SPINE_NEAR_RADIUS_M,
            )
            row = detail.model_dump()
            poi = {
                **poi,
                "gersId": row.get("gers_id"),
                "spine": row,
                "category": row.get("category_label") or poi.get("category"),
            }
        except Exception:
            pass
        enriched.append(poi)
    return enriched


class LiveMapLayerService:
    @staticmethod
    async def fetch_layer_points(
        db: Session,
        south: float,
        west: float,
        north: float,
        east: float,
        cats: list[str] | None = None,
        client_ip: str = "unknown",
        zoom: float | None = None,
    ) -> tuple[list[dict[str, Any]], bool, str | None]:
        """
        Returns (points, cached, error_message).
        Raises AppException on rate limit.
        """
        check_ip_budget(client_ip)

        if south >= north or west >= east:
            AppException.bad_request("Invalid bbox")

        south, west, north, east = clamp_bbox_area(
            south, west, north, east, max_km2=max_area_km2_for_zoom(zoom)
        )
        bbox = snap_bbox(south, west, north, east)
        cat_list = tuple(sorted({c.strip().lower() for c in (cats or LIVE_LAYER_DEFAULT_CATS) if c.strip()}))
        if not cat_list:
            cat_list = LIVE_LAYER_DEFAULT_CATS

        key = _cache_key(bbox, cat_list, zoom)
        now = time.time()
        cached = _layer_cache.get(key)
        if cached and cached[0] > now:
            return cached[1], True, None

        center_lat = (south + north) / 2.0
        center_lng = (west + east) / 2.0

        subqueries: list[str] = []
        seen_q: set[str] = set()
        for cat in cat_list:
            for q in merged_osm_queries_for_category(cat):
                if q not in seen_q:
                    seen_q.add(q)
                    subqueries.append(q)

        if not subqueries:
            return [], False, "No categories configured"

        body = _queries_to_bbox(subqueries, *bbox)
        overpass_query = f"""[out:json][timeout:25];
(
{body}
);
out center;"""

        response = None
        last_status: int | None = None
        async with httpx.AsyncClient() as client:
            for mirror_url in OVERPASS_MIRRORS:
                try:
                    r = await client.post(
                        mirror_url,
                        data={"data": overpass_query},
                        timeout=LIVE_LAYER_HTTP_TIMEOUT_SECONDS,
                        headers={"User-Agent": OVERPASS_USER_AGENT},
                    )
                    last_status = r.status_code
                    if r.status_code == 200:
                        response = r
                        break
                    if r.status_code == 429:
                        AppException.bad_request("Overpass rate limited")
                except Exception as exc:
                    logger.warning("Live layer Overpass mirror failed: %s", exc)

        pois: list[dict[str, Any]] = []
        if response is not None:
            data = response.json()
            elements = data.get("elements") or []
            seen_osm: set[tuple[str, str]] = set()
            for elem in elements:
                norm = normalize_poi_result(elem, center_lat, center_lng)
                if not norm:
                    continue
                osm_key = (str(norm.get("osmType") or ""), str(norm.get("osmId") or ""))
                if osm_key in seen_osm:
                    continue
                seen_osm.add(osm_key)
                pois.append(norm)

        if not pois:
            logger.info("Live layer bbox Overpass empty/failed — nearby fallback at %s,%s", center_lat, center_lng)
            pois = await _fetch_via_nearby_fallback(center_lat, center_lng, cat_list, zoom)

        if not pois:
            if last_status == 429:
                AppException.bad_request("Overpass rate limited")
            return [], False, "layer unavailable · try again"

        pois = _filter_capitals_for_zoom(pois, zoom, cat_list)
        pois.sort(key=lambda p: p.get("distanceMiles") or 9999)
        pois = _balance_layer_pois(pois, cat_list)
        pois = attach_spine_to_pois(db, pois)
        pois = _dedupe_pois(pois)

        _layer_cache[key] = (now + LIVE_LAYER_CACHE_TTL_SECONDS, pois)
        return pois, False, None
