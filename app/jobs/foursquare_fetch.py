"""
app/jobs/foursquare_fetch.py — Fetch Foursquare places in bulk and cache in explore_contents.
"""
from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timezone
import httpx
from sqlalchemy import select

from app.models.explore_content import ExploreContent
from app.utils.database import SessionLocal

logger = logging.getLogger(__name__)

FOURSQUARE_URL = "https://places-api.foursquare.com/places/search"
FOURSQUARE_API_VERSION = "2025-06-17"

FOURSQUARE_CATEGORIES = {
    'Food': '13000',
    'Nightlife': '10032',
    'Shopping': '17000',
}

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
    raw = (os.environ.get("FOURSQUARE_API_KEY") or "").strip()
    if raw.lower().startswith("bearer "):
        raw = raw[7:].strip()
    return raw


def _foursquare_headers(api_key: str) -> dict[str, str]:
    # Service keys on the Places API use Bearer auth (see Foursquare migration guide).
    return {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
        "X-Places-Api-Version": FOURSQUARE_API_VERSION,
    }


def fetch_foursquare_places(
    client: httpx.Client,
    lat: float,
    lon: float,
    category_id: str,
    api_key: str,
) -> list[dict]:
    headers = _foursquare_headers(api_key)
    params = {
        "ll": f"{lat},{lon}",
        "categories": category_id,
        "limit": 50,
        "radius": 80000,
        "fields": "fsq_id,name,location,geocodes,categories,rating,stats,price,photos"
    }
    try:
        response = client.get(FOURSQUARE_URL, headers=headers, params=params, timeout=20.0)
        if response.status_code == 200:
            return response.json().get("results") or []
        else:
            logger.warning("Foursquare API returned HTTP %s: %s", response.status_code, response.text[:200])
    except Exception as e:
        logger.error("Error fetching from Foursquare at (%s, %s): %s", lat, lon, e)
    return []

def run_foursquare_fetch() -> dict[str, int]:
    """
    Fetch Foursquare places in bulk across the US grid and cache in explore_contents.
    Returns counts of fetched, inserted, and updated records.
    """
    logger.info("Starting Foursquare bulk fetch job...")
    api_key = _foursquare_api_key()
    if not api_key:
        logger.error("FOURSQUARE_API_KEY is not configured.")
        return {"fetched": 0, "inserted": 0, "updated": 0}

    logger.info(
        "FOURSQUARE_API_KEY loaded (first 10 chars): %s",
        api_key[:10],
    )

    fetched_places = []
    
    with httpx.Client(timeout=30.0) as client:
        for idx, pt in enumerate(US_GRID):
            lat = pt['lat']
            lon = pt['lon']
            
            for cat_name, cat_id in FOURSQUARE_CATEGORIES.items():
                # Respect rate limits and stay under monthly free quota (10,000 requests)
                time.sleep(0.5)
                logger.info(
                    "Foursquare fetching %s at (%s, %s) — point %d/%d",
                    cat_name, lat, lon, idx + 1, len(US_GRID)
                )
                
                results = fetch_foursquare_places(client, lat, lon, cat_id, api_key)
                for place in results:
                    if not isinstance(place, dict):
                        continue
                    
                    fsq_id = place.get("fsq_place_id") or place.get("fsq_id")
                    if not fsq_id:
                        continue
                    
                    geocodes = place.get("geocodes", {})
                    main_geo = geocodes.get("main", {}) if isinstance(geocodes, dict) else {}
                    v_lat = main_geo.get("latitude") if isinstance(main_geo, dict) else None
                    v_lon = main_geo.get("longitude") if isinstance(main_geo, dict) else None
                    
                    if v_lat is None or v_lon is None:
                        continue
                        
                    loc = place.get("location", {})
                    if not isinstance(loc, dict):
                        loc = {}
                        
                    city = loc.get("city") or "US"
                    state = loc.get("state") or "US"
                    
                    photo_url = get_fsq_photo(place.get("photos", []))
                    price_val = map_fsq_price(place.get("price", 1))
                    
                    # Store extra metadata in the data JSONB column
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
                    
    # Deduplicate before database operations
    seen_ids = set()
    unique_places = []
    for p in fetched_places:
        eid = p["event_id"]
        if eid not in seen_ids:
            seen_ids.add(eid)
            unique_places.append(p)
            
    logger.info("Fetched %d unique Foursquare places. Writing to database...", len(unique_places))
    
    inserted_count = 0
    updated_count = 0
    
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        event_ids = [p["event_id"] for p in unique_places]
        existing_rows = {}
        
        # Batch select in chunks of 500
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
        logger.info("Foursquare bulk fetch job completed! Inserted: %d | Updated: %d", inserted_count, updated_count)
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
