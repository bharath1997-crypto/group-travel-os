import logging
import math
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.place_registry import PlaceRegistry
from app.services.geocoding_service import GeocodingService
from app.services.places_nearby_service import PlacesNearbyService, calculate_distance_miles

logger = logging.getLogger(__name__)

CATEGORY_KEYWORD_MAP = {
    "gas": "gas",
    "gas station": "gas",
    "coffee": "coffee",
    "cafe": "coffee",
    "food": "food",
    "restaurant": "food",
    "restroom": "restroom",
    "toilet": "restroom",
    "hospital": "hospital",
    "parking": "parking",
    "atm": "atm",
}

def _normalize_string(s: str) -> str:
    if not s:
        return ""
    s = s.lower().strip()
    # Remove punctuation
    for char in ",.-'\"()[]{}":
        s = s.replace(char, "")
    
    # Normalize suffixes
    words = s.split()
    suffix_map = {
        "ave": "avenue",
        "av": "avenue",
        "st": "street",
        "rd": "road",
        "blvd": "boulevard",
        "dr": "drive",
        "n": "north",
        "s": "south",
        "e": "east",
        "w": "west",
    }
    words = [suffix_map.get(w, w) for w in words]
    return " ".join(words)


def _calculate_score(name: str, query: str, distance_meters: float | None) -> float:
    n_name = _normalize_string(name)
    n_query = _normalize_string(query)
    
    if not n_name or not n_query:
        return 0.0

    text_score = 0.0
    if n_name == n_query:
        text_score = 100.0
    elif n_name.startswith(n_query):
        text_score = 90.0
    else:
        name_words = n_name.split()
        if name_words and name_words[0].startswith(n_query):
            text_score = 80.0
        elif any(w.startswith(n_query) for w in name_words):
            text_score = 70.0
        elif n_query in n_name:
            text_score = 50.0

    distance_penalty = 0.0
    if distance_meters is not None:
        if distance_meters <= 1609:
            distance_penalty = 0.0
        elif distance_meters <= 8046:
            distance_penalty = 5.0
        elif distance_meters <= 40233:
            distance_penalty = 20.0
        else:
            distance_penalty = 50.0
            if text_score < 70:
                distance_penalty = 100.0  # heavily penalize far weak matches

    return (text_score * 1000) - distance_penalty


class PlaceAutocompleteService:
    @staticmethod
    async def autocomplete(
        db: AsyncSession,
        q: str,
        lat: float | None = None,
        lng: float | None = None,
        limit: int = 10,
        radius_meters: int = 25000,
    ) -> list[dict[str, Any]]:
        n_query = _normalize_string(q)
        if not n_query:
            return []

        # 1. Check if it's a category query
        if n_query in CATEGORY_KEYWORD_MAP and lat is not None and lng is not None:
            category_key = CATEGORY_KEYWORD_MAP[n_query]
            nearby_results = await PlacesNearbyService.search_nearby_places(
                category=category_key,
                lat=lat,
                lng=lng,
                radius_meters=min(radius_meters, 10000), # Cap category search radius
                limit=limit
            )
            # Map nearby results to autocomplete shape
            out = []
            for item in nearby_results:
                dist_m = item.get("distanceMiles", 0.0) * 1609.34
                dist_label = f"{round(item.get('distanceMiles', 0.0), 1)} mi" if item.get("distanceMiles", 0.0) > 0.1 else f"{round(dist_m)} m"
                out.append({
                    "id": item["id"],
                    "placeKey": item["placeKey"],
                    "name": item["name"],
                    "category": item["category"],
                    "address": item["address"],
                    "lat": item["lat"],
                    "lng": item["lng"],
                    "distanceMeters": dist_m,
                    "distanceLabel": dist_label,
                    "source": "rovvy_category",
                    "matchType": "category",
                    "score": 100000.0 - dist_m,
                    "tags": item.get("tags", {})
                })
            return out

        results_map = {}

        # 2. Search local PlaceRegistry
        stmt = select(PlaceRegistry).where(PlaceRegistry.name.ilike(f"%{q}%")).limit(20)
        local_places = (await db.execute(stmt)).scalars().all()
        for place in local_places:
            dist_m = None
            dist_label = None
            if lat is not None and lng is not None:
                dist_miles = calculate_distance_miles(lat, lng, place.lat, place.lng)
                dist_m = dist_miles * 1609.34
                dist_label = f"{round(dist_miles, 1)} mi" if dist_miles > 0.1 else f"{round(dist_m)} m"
            
            score = _calculate_score(place.name, q, dist_m)
            if score > 0:
                address_parts = [place.city, place.state, place.country]
                address = ", ".join(p for p in address_parts if p)
                
                results_map[place.place_key] = {
                    "id": place.place_key,
                    "placeKey": place.place_key,
                    "name": place.name,
                    "category": place.category or "Place",
                    "address": address or "Unknown location",
                    "lat": place.lat,
                    "lng": place.lng,
                    "distanceMeters": dist_m,
                    "distanceLabel": dist_label,
                    "source": "rovvy_db",
                    "matchType": "text",
                    "score": score,
                    "tags": {}
                }

        # 3. Fallback to Nominatim if we need more results
        if len(results_map) < limit:
            nominatim_results = await GeocodingService.search_address(q, lat, lng)
            for nom in nominatim_results:
                nom_lat = float(nom.get("lat", 0.0))
                nom_lng = float(nom.get("lon", 0.0))
                nom_name = nom.get("name") or nom.get("display_name", "").split(",")[0]
                nom_address = nom.get("display_name", "")
                osm_type = nom.get("osm_type", "node")
                osm_id = nom.get("osm_id", "")
                place_key = f"osm:{osm_type}:{osm_id}"
                
                if place_key in results_map:
                    continue

                dist_m = None
                dist_label = None
                if lat is not None and lng is not None:
                    dist_miles = calculate_distance_miles(lat, lng, nom_lat, nom_lng)
                    dist_m = dist_miles * 1609.34
                    dist_label = f"{round(dist_miles, 1)} mi" if dist_miles > 0.1 else f"{round(dist_m)} m"
                
                score = _calculate_score(nom_name, q, dist_m)
                # boost slightly if it matches city/state
                nom_type = nom.get("type", "")
                nom_class = nom.get("class", "")
                
                category = "Address"
                if nom_class != "place" and nom_class != "highway" and nom_class != "building":
                    category = nom_type.replace("_", " ").title() if nom_type else "Place"
                elif nom_class == "building":
                    category = "Building"
                elif nom_class == "highway":
                    category = "Street"
                
                if score > 0:
                    results_map[place_key] = {
                        "id": place_key,
                        "placeKey": place_key,
                        "name": nom_name,
                        "category": category,
                        "address": nom_address,
                        "lat": nom_lat,
                        "lng": nom_lng,
                        "distanceMeters": dist_m,
                        "distanceLabel": dist_label,
                        "source": "nominatim",
                        "matchType": "text",
                        "score": score,
                        "tags": {}
                    }

        # Convert to list and sort by score descending
        final_results = list(results_map.values())
        final_results.sort(key=lambda x: x["score"], reverse=True)
        
        return final_results[:limit]
