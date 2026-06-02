"""
app/jobs/osm_fetch.py — Fetch OpenStreetMap places in bulk using Overpass API and cache in explore_contents.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import select

from app.models.explore_content import ExploreContent
from app.jobs.job_control import osm_job
from app.utils.database import SessionLocal

logger = logging.getLogger(__name__)

OVERPASS_SERVERS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass-api.de/api/interpreter",
]
OVERPASS_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "RovvyExplore/1.0 (group-travel-os; contact@rovvy.app)",
}

REQUEST_DELAY_SECONDS = 3.0
OVERPASS_RADIUS_METERS = 30000
OVERPASS_RESULT_LIMIT = 10
OVERPASS_QUERY_TIMEOUT = 20

# Mapping of tags to category names
TAG_TO_CATEGORY = {
    ("amenity", "arcade"): "Gaming",
    ("leisure", "escape_game"): "Gaming",
    ("amenity", "amusement_arcade"): "Gaming",
    ("tourism", "theme_park"): "Amusement",
    ("leisure", "water_park"): "Amusement",
    ("leisure", "amusement_ride"): "Amusement",
    ("leisure", "park"): "Parks",
    ("leisure", "nature_reserve"): "Parks",
    ("boundary", "national_park"): "Parks",
    ("route", "hiking"): "Trekking",
    ("leisure", "trail"): "Trekking",
    ("natural", "peak"): "Trekking",
    ("tourism", "attraction"): "Landmarks",
    ("tourism", "museum"): "Landmarks",
    ("historic", "monument"): "Landmarks",
    ("tourism", "viewpoint"): "Landmarks",
}

OSM_TAG_FILTERS = [
    f'"{key}"="{value}"'
    for key, value in TAG_TO_CATEGORY
]

# Major US metro areas — start small to avoid Overpass overload
US_GRID = [
    {"lat": 41.8781, "lon": -87.6298},   # Chicago
    {"lat": 40.7128, "lon": -74.0060},   # New York
    {"lat": 34.0522, "lon": -118.2437},  # LA
    {"lat": 29.7604, "lon": -95.3698},   # Houston
    {"lat": 33.4484, "lon": -112.0740},  # Phoenix
    {"lat": 47.6062, "lon": -122.3321},  # Seattle
    {"lat": 37.7749, "lon": -122.4194},  # San Francisco
    {"lat": 39.7392, "lon": -104.9903},  # Denver
    {"lat": 25.7617, "lon": -80.1918},   # Miami
    {"lat": 30.2672, "lon": -97.7431},   # Austin
]


def generate_grid(
    lat_min: float,
    lat_max: float,
    lon_min: float,
    lon_max: float,
    step: float = 2.0,
) -> list[dict[str, float]]:
    points = []
    lat = lat_min
    while lat <= lat_max:
        lon = lon_min
        while lon <= lon_max:
            points.append({"lat": round(lat, 4), "lon": round(lon, 4)})
            lon += step
        lat += step
    return points


def build_osm_query(tag_filter: str, lat: float, lon: float) -> str:
    """Build a lightweight Overpass query — nodes only, capped results."""
    return (
        f"[out:json][timeout:{OVERPASS_QUERY_TIMEOUT}];\n"
        f"node[{tag_filter}](around:{OVERPASS_RADIUS_METERS},{lat},{lon});\n"
        f"out body {OVERPASS_RESULT_LIMIT};"
    )


def _overpass_get(client: httpx.Client, query: str) -> httpx.Response | None:
    """Try each Overpass mirror in order until one succeeds."""
    for url in OVERPASS_SERVERS:
        try:
            response = client.get(
                url,
                params={"data": query},
                headers=OVERPASS_HEADERS,
                timeout=35.0,
            )
            if response.status_code == 200:
                return response
            logger.warning(
                "OSM Overpass %s returned HTTP %s: %s",
                url,
                response.status_code,
                response.text[:200],
            )
        except Exception as exc:
            logger.warning("OSM Overpass %s failed: %s", url, exc)
    return None


def _parse_osm_elements(elements: list) -> list[dict]:
    results: list[dict] = []
    for el in elements:
        if not isinstance(el, dict):
            continue
        tags_dict = el.get("tags", {})
        name = tags_dict.get("name")
        if not name:
            continue

        category_name = None
        for (key, value), cat in TAG_TO_CATEGORY.items():
            if tags_dict.get(key) == value:
                category_name = cat
                break
        if not category_name:
            continue

        lat_val = el.get("lat")
        lon_val = el.get("lon")
        if not lat_val or not lon_val:
            continue

        results.append(
            {
                "name": name,
                "lat": float(lat_val),
                "lon": float(lon_val),
                "tags": tags_dict,
                "osm_id": el.get("id"),
                "category": category_name,
            }
        )
    return results


def fetch_osm_places(client: httpx.Client, lat: float, lon: float) -> list[dict]:
    """Fetch OSM places near a point using small per-tag queries."""
    seen_ids: set[int | str] = set()
    results: list[dict] = []

    for tag_filter in OSM_TAG_FILTERS:
        if osm_job.is_cancelled():
            break

        query = build_osm_query(tag_filter, lat, lon)
        response = _overpass_get(client, query)
        if response is None:
            continue

        for place in _parse_osm_elements(response.json().get("elements", [])):
            osm_id = place["osm_id"]
            if osm_id in seen_ids:
                continue
            seen_ids.add(osm_id)
            results.append(place)

        if osm_job.sleep(REQUEST_DELAY_SECONDS):
            break

    return results


def probe_osm_api(
    client: httpx.Client,
    *,
    lat: float = 41.8781,
    lon: float = -87.6298,
) -> bool:
    """Single-point smoke test before running the metro grid."""
    query = build_osm_query('"amenity"="arcade"', lat, lon)
    response = _overpass_get(client, query)
    if response is None:
        logger.error("OSM smoke test failed: all Overpass mirrors unavailable")
        return False
    if response.status_code != 200:
        logger.error(
            "OSM smoke test failed: HTTP %s — %s",
            response.status_code,
            response.text[:200],
        )
        return False

    elements = response.json().get("elements", [])
    logger.info(
        "OSM smoke test OK: HTTP 200, %d elements at (%s, %s)",
        len(elements),
        lat,
        lon,
    )
    return True


def request_osm_fetch_cancel() -> None:
    osm_job.request_cancel()


def run_osm_fetch() -> dict[str, int]:
    """
    Fetch OpenStreetMap places in bulk using Overpass API and cache in explore_contents.
    Returns counts of fetched, inserted, and updated records.
    """
    logger.info("Starting OpenStreetMap bulk fetch job...")
    if not osm_job.try_start():
        logger.warning("OSM fetch already running — ignoring duplicate trigger")
        return {"fetched": 0, "inserted": 0, "updated": 0}

    try:
        fetched_places = []
        total_points = len(US_GRID)

        with httpx.Client(timeout=40.0) as client:
            if not probe_osm_api(client):
                logger.error("Aborting OSM bulk fetch — smoke test failed")
                return {"fetched": 0, "inserted": 0, "updated": 0}

            for idx, pt in enumerate(US_GRID):
                if osm_job.is_cancelled():
                    logger.info(
                        "OSM fetch cancelled at point %d/%d",
                        idx + 1,
                        total_points,
                    )
                    break

                lat = pt["lat"]
                lon = pt["lon"]

                logger.info(
                    "OSM Overpass fetching at (%s, %s) — point %d/%d",
                    lat,
                    lon,
                    idx + 1,
                    total_points,
                )

                results = fetch_osm_places(client, lat, lon)
                for place in results:
                    tags_dict = place["tags"]

                    extra_data = {
                        "country": tags_dict.get("addr:country", "US"),
                        "rating": 0.0,
                        "tags": tags_dict,
                    }

                    fetched_places.append(
                        {
                            "event_id": f"osm_{place['osm_id']}",
                            "title": place["name"],
                            "category": place["category"],
                            "content_type": "osm_place",
                            "venue_name": place["name"],
                            "venue_lat": place["lat"],
                            "venue_lon": place["lon"],
                            "city": tags_dict.get("addr:city", ""),
                            "state": tags_dict.get("addr:state", ""),
                            "source": "openstreetmap",
                            "data": [extra_data],
                        }
                    )

                if osm_job.sleep(REQUEST_DELAY_SECONDS):
                    logger.info(
                        "OSM fetch cancelled at point %d/%d",
                        idx + 1,
                        total_points,
                    )
                    break

        seen_ids = set()
        unique_places = []
        for p in fetched_places:
            eid = p["event_id"]
            if eid not in seen_ids:
                seen_ids.add(eid)
                unique_places.append(p)

        logger.info(
            "Fetched %d unique OpenStreetMap places. Writing to database...",
            len(unique_places),
        )

        inserted_count = 0
        updated_count = 0

        db = SessionLocal()
        try:
            now = datetime.now(timezone.utc)
            event_ids = [p["event_id"] for p in unique_places]
            existing_rows = {}

            for i in range(0, len(event_ids), 500):
                chunk = event_ids[i : i + 500]
                stmt = select(ExploreContent).where(ExploreContent.event_id.in_(chunk))
                for row in db.scalars(stmt).all():
                    existing_rows[row.event_id] = row

            for p in unique_places:
                row = existing_rows.get(p["event_id"])
                if row:
                    row.title = p["title"]
                    row.category = p["category"]
                    row.venue_name = p["venue_name"]
                    row.venue_lat = p["venue_lat"]
                    row.venue_lon = p["venue_lon"]
                    row.city = p["city"]
                    row.state = p["state"]
                    row.data = p["data"]
                    row.fetched_at = now
                    updated_count += 1
                else:
                    new_row = ExploreContent(
                        event_id=p["event_id"],
                        title=p["title"],
                        category=p["category"],
                        content_type=p["content_type"],
                        venue_name=p["venue_name"],
                        venue_lat=p["venue_lat"],
                        venue_lon=p["venue_lon"],
                        city=p["city"],
                        state=p["state"],
                        source=p["source"],
                        data=p["data"],
                        fetched_at=now,
                    )
                    db.add(new_row)
                    inserted_count += 1

            db.commit()
            logger.info(
                "OpenStreetMap bulk fetch job completed! Inserted: %d | Updated: %d",
                inserted_count,
                updated_count,
            )
        except Exception as e:
            logger.exception("OpenStreetMap DB operation failed: %s", e)
            db.rollback()
        finally:
            db.close()

        return {
            "fetched": len(unique_places),
            "inserted": inserted_count,
            "updated": updated_count,
        }
    finally:
        osm_job.finish()
