"""
app/jobs/foursquare_fetch.py — Fetch Foursquare places in bulk and cache in explore_contents.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
import httpx
from sqlalchemy import select

from app.models.explore_content import ExploreContent
from app.jobs.job_control import foursquare_job
from app.utils.database import SessionLocal
from app.utils.foursquare_auth import (
    FOURSQUARE_PLACES_URL,
    foursquare_headers,
    normalize_foursquare_api_key,
)

logger = logging.getLogger(__name__)

FOURSQUARE_URL = FOURSQUARE_PLACES_URL

FOURSQUARE_CATEGORIES = {
    'Food': '13000',
    'Nightlife': '10032',
    'Shopping': '17000',
}

REQUEST_DELAY_SECONDS = 1.0
PROGRESS_LOG_INTERVAL = 10

def generate_grid(lat_min: float, lat_max: float, lon_min: float, lon_max: float, step: float = 2.0) -> list[dict[str, float]]:
    points = []
    lat = lat_min
    while lat <= lat_max:
        lon = lon_min
        while lon <= lon_max:
            points.append({'lat': round(lat, 4), 'lon': round(lon, 4)})
            lon += step
        lat += step
    return points

# US grid only for now
US_GRID = generate_grid(24.5, 49.5, -125.0, -66.0, step=2.0)

def get_fsq_photo(photos: list) -> str | None:
    if not photos or not isinstance(photos, list):
        return None
    p = photos[0]
    if isinstance(p, dict) and "prefix" in p and "suffix" in p:
        return f"{p['prefix']}300x200{p['suffix']}"
    return None

def map_fsq_price(price: int | None) -> float:
    if price is None:
        return 0.0
    return float({1: 0, 2: 15, 3: 30, 4: 50}.get(price, 0))

def _foursquare_api_key() -> str:
    return normalize_foursquare_api_key()


def _foursquare_request_headers(api_key: str) -> dict[str, str]:
    return foursquare_headers(api_key)


def fetch_with_retry(
    client: httpx.Client,
    url: str,
    *,
    headers: dict[str, str],
    params: dict[str, str | int],
    timeout: float = 30.0,
    max_retries: int = 3,
) -> httpx.Response | None:
    for attempt in range(max_retries):
        try:
            response = client.get(url, headers=headers, params=params, timeout=timeout)
        except Exception as exc:
            logger.error("Foursquare request failed: %s", exc)
            return None

        if response.status_code == 429:
            wait = 2 ** attempt
            logger.warning("Rate limited. Waiting %ss...", wait)
            if foursquare_job.sleep(wait):
                return None
            continue

        return response

    logger.warning("Foursquare rate limit exceeded after %d retries", max_retries)
    return None


def fetch_foursquare_places(
    client: httpx.Client,
    lat: float,
    lon: float,
    category_id: str,
    api_key: str,
) -> list[dict]:
    headers = _foursquare_request_headers(api_key)
    params = {
        "ll": f"{lat},{lon}",
        "categories": category_id,
        "limit": 50,
        "radius": 80000,
        "fields": "fsq_id,name,location,geocodes,categories,rating,stats,price,photos",
    }
    response = fetch_with_retry(
        client,
        FOURSQUARE_URL,
        headers=headers,
        params=params,
        timeout=30.0,
    )
    if response is None:
        return []
    if response.status_code == 200:
        return response.json().get("results") or []
    logger.warning(
        "Foursquare API returned HTTP %s: %s",
        response.status_code,
        response.text[:200],
    )
    return []


def probe_foursquare_api(
    client: httpx.Client,
    api_key: str,
    *,
    lat: float = 41.8781,
    lon: float = -87.6298,
    category_id: str = "13000",
) -> bool:
    """Single-call smoke test before running the full US grid."""
    headers = _foursquare_request_headers(api_key)
    params = {
        "ll": f"{lat},{lon}",
        "categories": category_id,
        "limit": 5,
        "radius": 5000,
        "fields": "fsq_id,name,location,geocodes,categories,rating,stats,price,photos",
    }
    response = fetch_with_retry(
        client,
        FOURSQUARE_URL,
        headers=headers,
        params=params,
        timeout=30.0,
    )
    if response is None:
        logger.error("Foursquare smoke test failed: no response")
        return False
    if response.status_code != 200:
        logger.error(
            "Foursquare smoke test failed: HTTP %s — %s",
            response.status_code,
            response.text[:200],
        )
        return False

    payload = response.json()
    results = payload.get("results") or []
    sample = results[0] if results else {}
    logger.info(
        "Foursquare smoke test OK: HTTP 200, %d results, sample=%s",
        len(results),
        str(sample)[:200],
    )
    return True


def _place_coordinates(place: dict) -> tuple[float | None, float | None]:
    geocodes = place.get("geocodes", {})
    main_geo = geocodes.get("main", {}) if isinstance(geocodes, dict) else {}
    v_lat = main_geo.get("latitude") if isinstance(main_geo, dict) else None
    v_lon = main_geo.get("longitude") if isinstance(main_geo, dict) else None
    if v_lat is None:
        v_lat = place.get("latitude")
    if v_lon is None:
        v_lon = place.get("longitude")
    return v_lat, v_lon


def request_foursquare_fetch_cancel() -> None:
    foursquare_job.request_cancel()


def run_foursquare_fetch() -> dict[str, int]:
    """
    Fetch Foursquare places in bulk across the US grid and cache in explore_contents.
    Returns counts of fetched, inserted, and updated records.
    """
    logger.info("Starting Foursquare bulk fetch job...")
    if not foursquare_job.try_start():
        logger.warning("Foursquare fetch already running — ignoring duplicate trigger")
        return {"fetched": 0, "inserted": 0, "updated": 0}

    try:
        api_key = _foursquare_api_key()
        if not api_key:
            logger.error("FOURSQUARE_API_KEY is not configured.")
            return {"fetched": 0, "inserted": 0, "updated": 0}

        logger.info(
            "FOURSQUARE_API_KEY loaded (len=%d, has_plus=%s, prefix=%s)",
            len(api_key),
            "+" in api_key,
            api_key[:10],
        )

        fetched_places = []
        total_points = len(US_GRID)
        cancelled = False

        limits = httpx.Limits(max_connections=1, max_keepalive_connections=0)
        with httpx.Client(timeout=30.0, limits=limits, verify=True) as client:
            if not probe_foursquare_api(client, api_key):
                logger.error("Aborting Foursquare bulk fetch — smoke test failed")
                return {"fetched": 0, "inserted": 0, "updated": 0}

            for idx, pt in enumerate(US_GRID):
                if foursquare_job.is_cancelled():
                    logger.info(
                        "Foursquare fetch cancelled at point %d/%d",
                        idx + 1,
                        total_points,
                    )
                    cancelled = True
                    break

                lat = pt["lat"]
                lon = pt["lon"]

                if idx == 0 or (idx + 1) % PROGRESS_LOG_INTERVAL == 0:
                    logger.info(
                        "Progress: %d/%d grid points processed",
                        idx + 1,
                        total_points,
                    )

                for cat_name, cat_id in FOURSQUARE_CATEGORIES.items():
                    if foursquare_job.is_cancelled():
                        cancelled = True
                        break

                    logger.info(
                        "Foursquare fetching %s at (%s, %s) — point %d/%d",
                        cat_name,
                        lat,
                        lon,
                        idx + 1,
                        total_points,
                    )

                    results = fetch_foursquare_places(client, lat, lon, cat_id, api_key)
                    if foursquare_job.sleep(REQUEST_DELAY_SECONDS):
                        cancelled = True
                        break

                    for place in results:
                        if not isinstance(place, dict):
                            continue

                        fsq_id = place.get("fsq_place_id") or place.get("fsq_id")
                        if not fsq_id:
                            continue

                        v_lat, v_lon = _place_coordinates(place)

                        if v_lat is None or v_lon is None:
                            continue

                        loc = place.get("location", {})
                        if not isinstance(loc, dict):
                            loc = {}

                        city = loc.get("city") or "US"
                        state = loc.get("state") or "US"

                        photo_url = get_fsq_photo(place.get("photos", []))
                        price_val = map_fsq_price(place.get("price", 1))

                        extra_data = {
                            "country": loc.get("country", "US"),
                            "rating": round(place.get("rating", 0) / 2, 1) if place.get("rating") is not None else 0.0,
                            "categories": place.get("categories", []),
                            "stats": place.get("stats", {})
                        }

                        fetched_places.append({
                            "event_id": f"fsq_{fsq_id}",
                            "title": place.get("name") or "Place",
                            "category": cat_name,
                            "content_type": "foursquare_place",
                            "venue_name": place.get("name") or "Place",
                            "venue_lat": float(v_lat),
                            "venue_lon": float(v_lon),
                            "city": city,
                            "state": state,
                            "image_url": photo_url,
                            "source": "foursquare",
                            "price_min": price_val,
                            "price_max": price_val,
                            "data": [extra_data]
                        })

                if cancelled:
                    break

        # Deduplicate before database operations
        seen_ids = set()
        unique_places = []
        for p in fetched_places:
            eid = p["event_id"]
            if eid not in seen_ids:
                seen_ids.add(eid)
                unique_places.append(p)

        if cancelled:
            logger.info(
                "Foursquare fetch stopped early with %d places collected so far",
                len(unique_places),
            )
        else:
            logger.info(
                "Fetched %d unique Foursquare places. Writing to database...",
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
                chunk = event_ids[i:i+500]
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
                    row.image_url = p["image_url"]
                    row.price_min = p["price_min"]
                    row.price_max = p["price_max"]
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
                        image_url=p["image_url"],
                        source=p["source"],
                        price_min=p["price_min"],
                        price_max=p["price_max"],
                        data=p["data"],
                        fetched_at=now
                    )
                    db.add(new_row)
                    inserted_count += 1

            db.commit()
            logger.info(
                "Foursquare bulk fetch job completed! Inserted: %d | Updated: %d",
                inserted_count,
                updated_count,
            )
        except Exception as e:
            logger.exception("Foursquare DB operation failed: %s", e)
            db.rollback()
        finally:
            db.close()

        return {
            "fetched": len(unique_places),
            "inserted": inserted_count,
            "updated": updated_count
        }
    finally:
        foursquare_job.finish()
