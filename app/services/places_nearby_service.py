"""
app/services/places_nearby_service.py — Service to search nearby points of interest using OpenStreetMap/Overpass API.
"""
from __future__ import annotations

import logging
import math
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
HTTP_TIMEOUT_SECONDS = 15.0
CACHE_TTL_SECONDS = 600  # 10 minutes
MAX_CACHE_ENTRIES = 500

# Cache dictionary: {(category, rounded_lat, rounded_lng, radius): (expires_at, results)}
_nearby_cache: dict[tuple[str, float, float, int], tuple[float, list[dict[str, Any]]]] = {}


def _prune_cache() -> None:
    now = time.time()
    expired = [key for key, (expires_at, _) in _nearby_cache.items() if expires_at <= now]
    for key in expired:
        del _nearby_cache[key]

    overflow = len(_nearby_cache) - MAX_CACHE_ENTRIES
    if overflow <= 0:
        return

    oldest_keys = sorted(_nearby_cache.keys(), key=lambda k: _nearby_cache[k][0])[:overflow]
    for key in oldest_keys:
        del _nearby_cache[key]


def calculate_distance_miles(origin_lat: float, origin_lng: float, place_lat: float, place_lng: float) -> float:
    """Calculate distance in miles between two coordinates using Haversine formula."""
    r = 3958.8  # Earth radius in miles
    phi1 = math.radians(origin_lat)
    phi2 = math.radians(place_lat)
    d_phi = math.radians(place_lat - origin_lat)
    d_lambda = math.radians(place_lng - origin_lng)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(a))


def normalize_poi_result(raw: dict[str, Any], origin_lat: float, origin_lng: float) -> dict[str, Any] | None:
    """Normalize a raw Overpass element into standard Rovvy Place JSON schema."""
    tags = raw.get("tags") or {}

    lat = raw.get("lat")
    lng = raw.get("lon")
    if lat is None or lng is None:
        center = raw.get("center")
        if center and isinstance(center, dict):
            lat = center.get("lat")
            lng = center.get("lon") or center.get("lng")

    if lat is None or lng is None:
        return None

    try:
        lat = float(lat)
        lng = float(lng)
    except (ValueError, TypeError):
        return None

    # Skip if place has no name, unless it has a useful category/address
    name = tags.get("name")
    has_useful_tag = any(k in tags for k in ["amenity", "shop", "leisure", "tourism", "natural", "healthcare"])
    has_address = any(f"addr:{k}" in tags for k in ["street", "city", "postcode"])

    if not name and not (has_useful_tag or has_address):
        return None

    if not name:
        if "amenity" in tags:
            name = tags["amenity"].replace("_", " ").title()
        elif "shop" in tags:
            name = tags["shop"].replace("_", " ").title()
        elif "leisure" in tags:
            name = tags["leisure"].replace("_", " ").title()
        elif "tourism" in tags:
            name = tags["tourism"].replace("_", " ").title()
        else:
            name = "Unnamed Place"

    # Category normalization
    category_str = "Place"
    amenity = tags.get("amenity")
    shop = tags.get("shop")
    tourism = tags.get("tourism")
    leisure = tags.get("leisure")
    healthcare = tags.get("healthcare")
    highway = tags.get("highway")
    public_transport = tags.get("public_transport")

    if amenity:
        amenity_map = {
            "fuel": "Gas station",
            "restaurant": "Restaurant",
            "fast_food": "Fast food",
            "cafe": "Cafe",
            "bar": "Bar",
            "pub": "Pub",
            "cinema": "Cinema",
            "hospital": "Hospital",
            "clinic": "Clinic",
            "pharmacy": "Pharmacy",
            "parking": "Parking",
            "bank": "Bank",
            "atm": "ATM",
            "place_of_worship": "Place of worship",
            "school": "School",
            "college": "College",
            "university": "University",
            "library": "Library",
            "toilets": "Restroom",
        }
        category_str = amenity_map.get(amenity, amenity.replace("_", " ").title())
    elif shop:
        shop_map = {
            "alcohol": "Liquor store",
            "beverages": "Beverage store",
            "convenience": "Convenience store",
            "supermarket": "Supermarket",
            "mobile_phone": "Mobile phone store",
            "clothes": "Clothing store",
            "bakery": "Bakery",
            "coffee": "Coffee shop",
        }
        category_str = shop_map.get(shop, shop.replace("_", " ").title())
    elif tourism:
        tourism_map = {
            "hotel": "Hotel",
            "motel": "Motel",
            "attraction": "Attraction",
            "museum": "Museum",
            "gallery": "Gallery",
        }
        category_str = tourism_map.get(tourism, tourism.replace("_", " ").title())
    elif leisure:
        leisure_map = {
            "park": "Park",
            "fitness_centre": "Fitness center",
            "sports_centre": "Sports center",
        }
        category_str = leisure_map.get(leisure, leisure.replace("_", " ").title())
    elif healthcare:
        healthcare_map = {
            "hospital": "Hospital",
            "clinic": "Clinic",
            "pharmacy": "Pharmacy",
        }
        category_str = healthcare_map.get(healthcare, healthcare.replace("_", " ").title())
    elif highway == "bus_stop":
        category_str = "Bus stop"
    elif public_transport == "platform":
        category_str = "Transit stop"
    elif "natural" in tags:
        category_str = tags["natural"].replace("_", " ").title()
    else:
        c = raw.get("class") or raw.get("type") or raw.get("category")
        if c:
            category_str = str(c).replace("_", " ").title()

    # Address parsing from OSM tags
    addr_parts = []
    street_number = tags.get("addr:housenumber")
    street_name = tags.get("addr:street")
    if street_number and street_name:
        addr_parts.append(f"{street_number} {street_name}")
    elif street_name:
        addr_parts.append(street_name)

    city = tags.get("addr:city")
    state = tags.get("addr:state")
    postcode = tags.get("addr:postcode")

    city_state = ""
    if city and state:
        city_state = f"{city}, {state}"
    elif city:
        city_state = city
    elif state:
        city_state = state

    if city_state:
        if postcode:
            addr_parts.append(f"{city_state} {postcode}")
        else:
            addr_parts.append(city_state)
    elif postcode:
        addr_parts.append(postcode)

    address = ", ".join(addr_parts) if addr_parts else f"Coordinates: {round(lat, 4)}, {round(lng, 4)}"

    osm_id = str(raw.get("id"))
    osm_type = str(raw.get("type", "node"))
    place_key = f"osm:{osm_type}:{osm_id}"

    distance = calculate_distance_miles(origin_lat, origin_lng, lat, lng)

    return {
        "id": place_key,
        "placeKey": place_key,
        "name": name,
        "category": category_str,
        "address": address,
        "lat": lat,
        "lng": lng,
        "distanceMiles": round(distance, 2),
        "source": "osm",
        "osmType": osm_type,
        "osmId": osm_id,
        "tags": tags,
    }


CATEGORY_TAG_QUERIES: dict[str, list[str]] = {
    "gas": [
        'node["amenity"="fuel"](around:{radius},{lat},{lng});',
        'way["amenity"="fuel"](around:{radius},{lat},{lng});',
    ],
    "coffee": [
        'node["amenity"="cafe"](around:{radius},{lat},{lng});',
        'way["amenity"="cafe"](around:{radius},{lat},{lng});',
        'node["shop"="coffee"](around:{radius},{lat},{lng});',
        'way["shop"="coffee"](around:{radius},{lat},{lng});',
    ],
    "food": [
        'node["amenity"="restaurant"](around:{radius},{lat},{lng});',
        'way["amenity"="restaurant"](around:{radius},{lat},{lng});',
        'node["amenity"="fast_food"](around:{radius},{lat},{lng});',
        'way["amenity"="fast_food"](around:{radius},{lat},{lng});',
        'node["amenity"="food_court"](around:{radius},{lat},{lng});',
        'way["amenity"="food_court"](around:{radius},{lat},{lng});',
    ],
    "restroom": [
        'node["amenity"="toilets"](around:{radius},{lat},{lng});',
        'way["amenity"="toilets"](around:{radius},{lat},{lng});',
    ],
    "hospital": [
        'node["amenity"="hospital"](around:{radius},{lat},{lng});',
        'way["amenity"="hospital"](around:{radius},{lat},{lng});',
        'node["amenity"="clinic"](around:{radius},{lat},{lng});',
        'way["amenity"="clinic"](around:{radius},{lat},{lng});',
        'node["healthcare"="hospital"](around:{radius},{lat},{lng});',
        'way["healthcare"="hospital"](around:{radius},{lat},{lng});',
        'node["healthcare"="clinic"](around:{radius},{lat},{lng});',
        'way["healthcare"="clinic"](around:{radius},{lat},{lng});',
    ],
    "atm": [
        'node["amenity"="atm"](around:{radius},{lat},{lng});',
        'way["amenity"="atm"](around:{radius},{lat},{lng});',
        'node["amenity"="bank"](around:{radius},{lat},{lng});',
        'way["amenity"="bank"](around:{radius},{lat},{lng});',
    ],
    "parks": [
        'node["leisure"="park"](around:{radius},{lat},{lng});',
        'way["leisure"="park"](around:{radius},{lat},{lng});',
        'relation["leisure"="park"](around:{radius},{lat},{lng});',
        'node["tourism"="attraction"](around:{radius},{lat},{lng});',
        'way["tourism"="attraction"](around:{radius},{lat},{lng});',
        'node["natural"="wood"](around:{radius},{lat},{lng});',
        'way["natural"="wood"](around:{radius},{lat},{lng});',
    ],
    "parking": [
        'node["amenity"="parking"](around:{radius},{lat},{lng});',
        'way["amenity"="parking"](around:{radius},{lat},{lng});',
    ],
    "all": [
        'node["amenity"~"fuel|cafe|restaurant|fast_food|toilets|hospital|clinic|atm|bank|parking|pub|bar|theme_park"](around:{radius},{lat},{lng});',
        'way["amenity"~"fuel|cafe|restaurant|fast_food|toilets|hospital|clinic|atm|bank|parking|pub|bar|theme_park"](around:{radius},{lat},{lng});',
        'node["shop"~"convenience|supermarket|bakery|mall|department_store"](around:{radius},{lat},{lng});',
        'way["shop"~"convenience|supermarket|bakery|mall|department_store"](around:{radius},{lat},{lng});',
        'node["leisure"~"park|playground|garden|sports_centre"](around:{radius},{lat},{lng});',
        'way["leisure"~"park|playground|garden|sports_centre"](around:{radius},{lat},{lng});',
        'node["tourism"~"attraction|museum|hotel|viewpoint|artwork"](around:{radius},{lat},{lng});',
        'way["tourism"~"attraction|museum|hotel|viewpoint|artwork"](around:{radius},{lat},{lng});',
    ],
    "click": [
        'node["amenity"~"fuel|cafe|restaurant|fast_food|toilets|hospital|clinic|atm|bank|parking|pub|bar|theme_park"](around:{radius},{lat},{lng});',
        'way["amenity"~"fuel|cafe|restaurant|fast_food|toilets|hospital|clinic|atm|bank|parking|pub|bar|theme_park"](around:{radius},{lat},{lng});',
        'node["shop"~"convenience|supermarket|bakery|mall|department_store"](around:{radius},{lat},{lng});',
        'way["shop"~"convenience|supermarket|bakery|mall|department_store"](around:{radius},{lat},{lng});',
        'node["leisure"~"park|playground|garden|sports_centre"](around:{radius},{lat},{lng});',
        'way["leisure"~"park|playground|garden|sports_centre"](around:{radius},{lat},{lng});',
        'node["tourism"~"attraction|museum|hotel|viewpoint|artwork"](around:{radius},{lat},{lng});',
        'way["tourism"~"attraction|museum|hotel|viewpoint|artwork"](around:{radius},{lat},{lng});',
    ],
}


class PlacesNearbyService:
    @staticmethod
    async def search_nearby_places(
        category: str,
        lat: float,
        lng: float,
        radius_meters: int = 5000,
        limit: int = 15,
    ) -> list[dict[str, Any]]:
        """Search nearby POIs using Overpass interpreter with cache."""
        clean_cat = category.strip().lower()

        # Simple category fallback matching
        matched_key = None
        if clean_cat in CATEGORY_TAG_QUERIES:
            matched_key = clean_cat
        else:
            for k in CATEGORY_TAG_QUERIES.keys():
                if k in clean_cat or clean_cat in k:
                    matched_key = k
                    break

        if not matched_key:
            # Fallback if no category matches
            matched_key = "gas"

        rounded_lat = round(lat, 3)
        rounded_lng = round(lng, 3)
        cache_key = (matched_key, rounded_lat, rounded_lng, radius_meters)

        now = time.time()
        cached = _nearby_cache.get(cache_key)
        if cached and cached[0] > now:
            logger.info("Nearby cache HIT for key %s", cache_key)
            return cached[1][:limit]

        # Construct Overpass QL query
        queries = CATEGORY_TAG_QUERIES[matched_key]
        subqueries_str = "\n".join([q.format(radius=radius_meters, lat=lat, lng=lng) for q in queries])

        overpass_query = f"""[out:json][timeout:15];
(
{subqueries_str}
);
out center;"""

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    OVERPASS_URL,
                    content=overpass_query,
                    timeout=HTTP_TIMEOUT_SECONDS,
                )
            if response.status_code != 200:
                logger.warning(
                    "Overpass API returned status code %s for category=%s lat=%s lng=%s",
                    response.status_code,
                    matched_key,
                    lat,
                    lng,
                )
                return []

            data = response.json()
            elements = data.get("elements", [])
        except Exception as exc:
            logger.error("Overpass API request failed: %s", exc)
            return []

        # Normalize and sort results
        normalized_results = []
        for elem in elements:
            norm = normalize_poi_result(elem, lat, lng)
            if norm:
                normalized_results.append(norm)

        # Sort by distance Miles ascending
        normalized_results.sort(key=lambda x: x["distanceMiles"])

        # Cache results (limit cache size, but save full list up to 50 items so slicing works for limits)
        _nearby_cache[cache_key] = (now + CACHE_TTL_SECONDS, normalized_results[:50])
        _prune_cache()

        return normalized_results[:limit]
