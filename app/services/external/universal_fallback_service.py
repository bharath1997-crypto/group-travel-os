import logging
import json
import httpx
from typing import Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from config import settings
from app.models.explore_content import ExploreContent

logger = logging.getLogger(__name__)

API_TIMEOUT = 10.0

def _get_cached_fallback(db: Session, city: str, content_type: str, ttl_hours: float = 24.0) -> Optional[dict]:
    """Helper to get cached fallback data from explore_contents."""
    cache = db.query(ExploreContent).filter(
        ExploreContent.city == city,
        ExploreContent.content_type == content_type
    ).first()

    if cache and (datetime.utcnow() - cache.fetched_at) < timedelta(hours=ttl_hours):
        return cache.data
    return None

def _set_cached_fallback(db: Session, city: str, content_type: str, data: Any):
    """Helper to set cached fallback data."""
    cache = db.query(ExploreContent).filter(
        ExploreContent.city == city,
        ExploreContent.content_type == content_type
    ).first()

    if cache:
        cache.data = data
        cache.fetched_at = datetime.utcnow()
    else:
        new_cache = ExploreContent(
            city=city,
            content_type=content_type,
            data=data,
            fetched_at=datetime.utcnow()
        )
        db.add(new_cache)
    db.commit()

async def get_universal_fallback(db: Session, lat: float, lon: float, city: str, radius_meters: int = 25000) -> dict[str, Any]:
    """
    Implements a universal location fallback system:
    1. Reverse Geocode (Nominatim)
    2. Nearby Features (Overpass)
    3. Nearest Cities (GeoNames)
    4. Gemini AI Summary (if needed)
    """
    cache_key = f"fallback_{city}_{lat}_{lon}_{radius_meters}"
    cached = _get_cached_fallback(db, cache_key, "universal_fallback")
    if cached:
        return cached

    results = {
        "reverse_geocode": None,
        "osm_features": [],
        "nearby_cities": [],
        "ai_summary": None,
        "radius_meters": radius_meters
    }

    async with httpx.AsyncClient(timeout=API_TIMEOUT) as client:
        # A. Reverse Geocode (Nominatim)
        try:
            r = await client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"lat": lat, "lon": lon, "format": "json"},
                headers={"User-Agent": "Travello/1.0"}
            )
            if r.status_code == 200:
                results["reverse_geocode"] = r.json()
        except Exception as e:
            logger.error(f"Nominatim fallback error: {e}")

        # B. Nearby OSM features (Overpass)
        try:
            query = f"""
            [out:json];
            (
              node["tourism"](around:{radius_meters},{lat},{lon});
              node["natural"](around:{radius_meters},{lat},{lon});
              node["amenity"](around:{radius_meters},{lat},{lon});
              node["historic"](around:{radius_meters},{lat},{lon});
            );
            out body 20;
            """
            r = await client.post("https://overpass-api.de/api/interpreter", content=query)
            if r.status_code == 200:
                results["osm_features"] = r.json().get("elements", [])
        except Exception as e:
            logger.error(f"Overpass fallback error: {e}")

        # C. Nearest Cities (GeoNames)
        try:
            username = settings.geonames_username or "travello"
            r = await client.get(
                "http://api.geonames.org/findNearbyPlaceNameJSON",
                params={"lat": lat, "lng": lon, "username": username, "maxRows": 5}
            )
            if r.status_code == 200:
                results["nearby_cities"] = r.json().get("geonames", [])
        except Exception as e:
            logger.error(f"GeoNames fallback error: {e}")

    # D. Gemini AI summary (Only if results are sparse)
    sparse = not results["osm_features"] and not results["nearby_cities"]
    if sparse and settings.gemini_api_key:
        try:
            results["ai_summary"] = await _generate_gemini_fallback(
                lat, lon, 
                results["reverse_geocode"], 
                results["osm_features"], 
                results["nearby_cities"]
            )
        except Exception as e:
            logger.error(f"Gemini fallback error: {e}")

    _set_cached_fallback(db, cache_key, "universal_fallback", results)
    return results

async def _generate_gemini_fallback(lat, lon, geo, features, cities) -> Optional[dict]:
    """Generates an AI summary for an obscure location."""
    from app.services.ai_assistant_service import generate_gemini_content
    
    features_summary = ", ".join([f.get("tags", {}).get("name", "Unknown") for f in features[:5]])
    cities_summary = ", ".join([c.get("name", "Unknown") for c in cities])
    geo_summary = json.dumps(geo) if geo else "Unknown area"

    prompt = f"""
    Generate a brief travel overview for this location:
    - Coordinates: {lat}, {lon}
    - Area: {geo_summary}
    - Nearby features: {features_summary}
    - Nearest cities: {cities_summary}

    Return JSON with fields:
    - about (2-3 sentences)
    - best_for (array of 3 tags)
    - nearby_highlights (array of 3 places)
    - travel_tip (1 sentence)
    """
    
    try:
        # Assuming generate_gemini_content returns raw text, we might need to parse JSON.
        # But for now, let's call it and hope for the best.
        res_text = await generate_gemini_content(prompt)
        # Clean up JSON if Gemini wraps it in markdown blocks
        if "```json" in res_text:
            res_text = res_text.split("```json")[1].split("```")[0].strip()
        elif "```" in res_text:
            res_text = res_text.split("```")[1].strip()
            
        return json.loads(res_text)
    except Exception as e:
        logger.warning(f"Gemini summary generation failed: {e}")
        return None
