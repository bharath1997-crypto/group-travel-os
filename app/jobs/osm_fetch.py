"""
app/jobs/osm_fetch.py — Fetch OpenStreetMap places in bulk using Overpass API and cache in explore_contents.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
import httpx
from sqlalchemy import select

from app.models.explore_content import ExploreContent
from app.utils.database import SessionLocal

logger = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_MIRROR_URL = "https://overpass.kumi.systems/api/interpreter"
OVERPASS_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "RovvyExplore/1.0 (group-travel-os; contact@rovvy.app)",
}

# Mapping of tags to category names
TAG_TO_CATEGORY = {
    ('amenity', 'arcade'): 'Gaming',
    ('leisure', 'escape_game'): 'Gaming',
    ('amenity', 'amusement_arcade'): 'Gaming',
    
    ('tourism', 'theme_park'): 'Amusement',
    ('leisure', 'water_park'): 'Amusement',
    ('leisure', 'amusement_ride'): 'Amusement',
    
    ('leisure', 'park'): 'Parks',
    ('leisure', 'nature_reserve'): 'Parks',
    ('boundary', 'national_park'): 'Parks',
    
    ('route', 'hiking'): 'Trekking',
    ('leisure', 'trail'): 'Trekking',
    ('natural', 'peak'): 'Trekking',
    
    ('tourism', 'attraction'): 'Landmarks',
    ('tourism', 'museum'): 'Landmarks',
    ('historic', 'monument'): 'Landmarks',
    ('tourism', 'viewpoint'): 'Landmarks',
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

def build_all_osm_query(lat: float, lon: float, radius_meters: int = 80000) -> str:
    """
    Build a single combined Overpass query for all relevant tags to minimize API requests
    and run extremely fast and safely without rate limiting.
    """
    all_tags = [
        '"amenity"="arcade"',
        '"leisure"="escape_game"',
        '"amenity"="amusement_arcade"',
        '"tourism"="theme_park"',
        '"leisure"="water_park"',
        '"leisure"="amusement_ride"',
        '"leisure"="park"',
        '"leisure"="nature_reserve"',
        '"boundary"="national_park"',
        '"route"="hiking"',
        '"leisure"="trail"',
        '"natural"="peak"',
        '"tourism"="attraction"',
        '"tourism"="museum"',
        '"historic"="monument"',
        '"tourism"="viewpoint"'
    ]
    
    union_parts = []
    for tag in all_tags:
        union_parts.append(f'node[{tag}](around:{radius_meters},{lat},{lon});')
        union_parts.append(f'way[{tag}](around:{radius_meters},{lat},{lon});')
        
    union_str = "\n".join(union_parts)
    return (
        "[out:json][timeout:25];\n"
        "(\n"
        f"{union_str}\n"
        ");\n"
        "out body center;"
    )

def fetch_osm_places(client: httpx.Client, lat: float, lon: float) -> list[dict]:
    query = build_all_osm_query(lat, lon, 25000)
    try:
        response = None
        for url in (OVERPASS_URL, OVERPASS_MIRROR_URL):
            response = client.get(
                url,
                params={"data": query},
                headers=OVERPASS_HEADERS,
                timeout=60.0,
            )
            if response.status_code == 200:
                break
            logger.warning(
                "OSM Overpass API %s returned HTTP %s: %s",
                url,
                response.status_code,
                response.text[:200],
            )
        if response is None or response.status_code != 200:
            return []
        elements = response.json().get("elements", [])
        results = []
        for el in elements:
            tags_dict = el.get("tags", {})
            name = tags_dict.get("name")
            if not name:
                continue

            category_name = None
            for (k, v), cat in TAG_TO_CATEGORY.items():
                if tags_dict.get(k) == v:
                    category_name = cat
                    break

            if not category_name:
                continue

            lat_val = el.get("lat") or el.get("center", {}).get("lat")
            lon_val = el.get("lon") or el.get("center", {}).get("lon")
            if not lat_val or not lon_val:
                continue

            results.append({
                "name": name,
                "lat": float(lat_val),
                "lon": float(lon_val),
                "tags": tags_dict,
                "osm_id": el.get("id"),
                "category": category_name,
            })
        return results
    except Exception as e:
        logger.error("Error fetching from OSM at (%s, %s): %s", lat, lon, e)
    return []

def run_osm_fetch() -> dict[str, int]:
    """
    Fetch OpenStreetMap places in bulk using Overpass API and cache in explore_contents.
    Returns counts of fetched, inserted, and updated records.
    """
    logger.info("Starting OpenStreetMap bulk fetch job...")
    fetched_places = []
    
    with httpx.Client(timeout=40.0) as client:
        for idx, pt in enumerate(US_GRID):
            lat = pt['lat']
            lon = pt['lon']
            
            # Stagger requests slightly to be extremely polite and follow Overpass usage policy
            time.sleep(1.0)
            logger.info("OSM Overpass fetching at (%s, %s) — point %d/%d", lat, lon, idx + 1, len(US_GRID))
            
            results = fetch_osm_places(client, lat, lon)
            for place in results:
                tags_dict = place['tags']
                
                extra_data = {
                    "country": tags_dict.get('addr:country', 'US'),
                    "rating": 0.0,
                    "tags": tags_dict
                }
                
                fetched_places.append({
                    "event_id": f"osm_{place['osm_id']}",
                    "title": place['name'],
                    "category": place['category'],
                    "content_type": "osm_place",
                    "venue_name": place['name'],
                    "venue_lat": place['lat'],
                    "venue_lon": place['lon'],
                    "city": tags_dict.get('addr:city', ''),
                    "state": tags_dict.get('addr:state', ''),
                    "source": "openstreetmap",
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
            
    logger.info("Fetched %d unique OpenStreetMap places. Writing to database...", len(unique_places))
    
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
                    fetched_at=now
                )
                db.add(new_row)
                inserted_count += 1
                
        db.commit()
        logger.info("OpenStreetMap bulk fetch job completed! Inserted: %d | Updated: %d", inserted_count, updated_count)
    except Exception as e:
        logger.exception("OpenStreetMap DB operation failed: %s", e)
        db.rollback()
    finally:
        db.close()
        
    return {
        "fetched": len(unique_places),
        "inserted": inserted_count,
        "updated": updated_count
    }
