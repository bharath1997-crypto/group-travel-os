"""
app/services/places_nearby_service.py — Service to search nearby points of interest using OpenStreetMap/Overpass API.
"""
from __future__ import annotations

import logging
import math
import re
import time
from typing import Any

import httpx

from app.services.live_search_taxonomy_service import (
    category_osm_queries,
    get_category_by_key,
    resolve_category_from_query,
)

logger = logging.getLogger(__name__)

OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
HTTP_TIMEOUT_SECONDS = 12.0
OVERPASS_USER_AGENT = "Rovvy/1.0 (group-travel-os; contact@rovvy.app)"
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


def normalize_tags(tags: dict[str, Any]) -> str:
    """Helper to map OSM tags to standard capitalized category labels."""
    amenity = tags.get("amenity")
    shop = tags.get("shop")
    tourism = tags.get("tourism")
    leisure = tags.get("leisure")
    healthcare = tags.get("healthcare")
    highway = tags.get("highway")
    public_transport = tags.get("public_transport")

    if amenity:
        if amenity == "place_of_worship":
            religion = str(tags.get("religion") or "").lower()
            if religion == "christian":
                return "Church"
            elif religion == "muslim":
                return "Mosque"
            elif religion == "jewish":
                return "Synagogue"
            elif religion == "hindu":
                return "Temple"
            else:
                return "Place of worship"

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
            "school": "School",
            "college": "College",
            "university": "University",
            "library": "Library",
            "toilets": "Restroom",
            "ferry_terminal": "Ferry terminal",
            "cinema": "Cinema",
        }
        return amenity_map.get(amenity, amenity.replace("_", " ").title())

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
        return shop_map.get(shop, shop.replace("_", " ").title())

    elif tourism:
        tourism_map = {
            "hotel": "Hotel",
            "motel": "Motel",
            "attraction": "Attraction",
            "museum": "Museum",
            "gallery": "Gallery",
            "viewpoint": "Viewpoint",
            "artwork": "Artwork",
        }
        if tourism == "attraction" and "beach" in str(tags.get("name") or "").lower():
            return "Beach"
        return tourism_map.get(tourism, tourism.replace("_", " ").title())

    elif tags.get("historic"):
        historic = str(tags["historic"])
        historic_map = {
            "monument": "Monument",
            "memorial": "Memorial",
            "castle": "Castle",
            "ruins": "Ruins",
            "building": "Historic building",
        }
        return historic_map.get(historic, historic.replace("_", " ").title())

    elif leisure:
        leisure_map = {
            "park": "Park",
            "fitness_centre": "Fitness center",
            "sports_centre": "Sports center",
            "marina": "Marina",
            "beach_resort": "Beach",
        }
        return leisure_map.get(leisure, leisure.replace("_", " ").title())

    elif tags.get("landuse") == "port":
        return "Port"
    elif tags.get("harbour") == "yes" or tags.get("harbor") == "yes":
        return "Port"
    elif tags.get("industrial") == "port":
        return "Port"
    elif tags.get("man_made") == "pier":
        return "Port"
    elif tags.get("waterway") == "dock":
        return "Port"
    elif tags.get("aeroway") in {"aerodrome", "terminal"}:
        return "Airport"
    elif tags.get("aeroway") == "helipad":
        return "Helipad"

    elif healthcare:
        healthcare_map = {
            "hospital": "Hospital",
            "clinic": "Clinic",
            "pharmacy": "Pharmacy",
        }
        return healthcare_map.get(healthcare, healthcare.replace("_", " ").title())

    elif highway == "bus_stop":
        return "Bus stop"
    elif public_transport == "platform":
        return "Transit stop"
    elif tags.get("waterway"):
        return str(tags["waterway"]).replace("_", " ").title()
    elif tags.get("natural") == "beach":
        return "Beach"
    elif "natural" in tags:
        return tags["natural"].replace("_", " ").title()

    return "Place"


def format_address_from_osm_tags(
    tags: dict[str, Any],
    lat: float,
    lng: float,
) -> str:
    """Build a travel-friendly address from OSM addr:* tags."""
    addr_parts: list[str] = []
    street_number = tags.get("addr:housenumber")
    street_name = tags.get("addr:street")
    if street_number and street_name:
        addr_parts.append(f"{street_number} {street_name}")
    elif street_name:
        addr_parts.append(str(street_name))

    city = tags.get("addr:city")
    state = tags.get("addr:state")
    postcode = tags.get("addr:postcode")

    city_state = ""
    if city and state:
        city_state = f"{city}, {state}"
    elif city:
        city_state = str(city)
    elif state:
        city_state = str(state)

    if city_state:
        if postcode:
            addr_parts.append(f"{city_state} {postcode}")
        else:
            addr_parts.append(city_state)
    elif postcode:
        addr_parts.append(str(postcode))

    if not addr_parts:
        is_in = tags.get("is_in") or tags.get("addr:place") or tags.get("addr:suburb")
        if is_in:
            addr_parts.append(str(is_in))

    if addr_parts:
        return ", ".join(addr_parts)
    return f"Coordinates: {round(lat, 4)}, {round(lng, 4)}"


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
    has_useful_tag = any(
        k in tags
        for k in [
            "amenity",
            "shop",
            "leisure",
            "tourism",
            "natural",
            "healthcare",
            "landuse",
            "harbour",
            "harbor",
            "industrial",
            "man_made",
            "waterway",
            "aeroway",
        ]
    )
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
    category_str = normalize_tags(tags)
    if category_str == "Place":
        c = raw.get("class") or raw.get("category")
        if c and str(c).lower() not in ("node", "way", "relation"):
            category_str = str(c).replace("_", " ").title()

    # Address parsing from OSM tags
    address = format_address_from_osm_tags(tags, lat, lng)

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
        'node["shop"="alcohol"](around:{radius},{lat},{lng});',
        'way["shop"="alcohol"](around:{radius},{lat},{lng});',
    ],
    "liquor": [
        'node["shop"="alcohol"](around:{radius},{lat},{lng});',
        'way["shop"="alcohol"](around:{radius},{lat},{lng});',
        'node["shop"="beverages"](around:{radius},{lat},{lng});',
        'way["shop"="beverages"](around:{radius},{lat},{lng});',
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
        'node["amenity"="bar"](around:{radius},{lat},{lng});',
        'way["amenity"="bar"](around:{radius},{lat},{lng});',
        'node["amenity"="pub"](around:{radius},{lat},{lng});',
        'way["amenity"="pub"](around:{radius},{lat},{lng});',
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
    "waterfalls": [
        'node["natural"="waterfall"](around:{radius},{lat},{lng});',
        'way["natural"="waterfall"](around:{radius},{lat},{lng});',
        'node["waterway"="waterfall"](around:{radius},{lat},{lng});',
        'way["waterway"="waterfall"](around:{radius},{lat},{lng});',
    ],
    "hotel": [
        'node["tourism"="hotel"](around:{radius},{lat},{lng});',
        'way["tourism"="hotel"](around:{radius},{lat},{lng});',
        'node["tourism"="motel"](around:{radius},{lat},{lng});',
        'way["tourism"="motel"](around:{radius},{lat},{lng});',
    ],
    "all": [
        'node["amenity"~"fuel|cafe|restaurant|fast_food|toilets|hospital|clinic|pharmacy|atm|bank|parking|pub|bar|cinema|theatre|library|school|college|university|place_of_worship"](around:{radius},{lat},{lng});',
        'way["amenity"~"fuel|cafe|restaurant|fast_food|toilets|hospital|clinic|pharmacy|atm|bank|parking|pub|bar|cinema|theatre|library|school|college|university|place_of_worship"](around:{radius},{lat},{lng});',
        'node["shop"~"convenience|supermarket|bakery|mall|department_store|alcohol|beverages|clothes|mobile_phone|coffee|hardware|electronics|florist|gift|jewelry|books"](around:{radius},{lat},{lng});',
        'way["shop"~"convenience|supermarket|bakery|mall|department_store|alcohol|beverages|clothes|mobile_phone|coffee|hardware|electronics|florist|gift|jewelry|books"](around:{radius},{lat},{lng});',
        'node["leisure"~"park|playground|garden|sports_centre|fitness_centre|stadium"](around:{radius},{lat},{lng});',
        'way["leisure"~"park|playground|garden|sports_centre|fitness_centre|stadium"](around:{radius},{lat},{lng});',
        'node["tourism"~"attraction|museum|hotel|motel|viewpoint|artwork|gallery"](around:{radius},{lat},{lng});',
        'way["tourism"~"attraction|museum|hotel|motel|viewpoint|artwork|gallery"](around:{radius},{lat},{lng});',
    ],
    "click": [
        'node["amenity"~"fuel|cafe|restaurant|fast_food|toilets|hospital|clinic|pharmacy|atm|bank|parking|pub|bar|cinema|theatre|library|school|college|university|place_of_worship"](around:{radius},{lat},{lng});',
        'way["amenity"~"fuel|cafe|restaurant|fast_food|toilets|hospital|clinic|pharmacy|atm|bank|parking|pub|bar|cinema|theatre|library|school|college|university|place_of_worship"](around:{radius},{lat},{lng});',
        'node["shop"~"convenience|supermarket|bakery|mall|department_store|alcohol|beverages|clothes|mobile_phone|coffee|hardware|electronics|florist|gift|jewelry|books"](around:{radius},{lat},{lng});',
        'way["shop"~"convenience|supermarket|bakery|mall|department_store|alcohol|beverages|clothes|mobile_phone|coffee|hardware|electronics|florist|gift|jewelry|books"](around:{radius},{lat},{lng});',
        'node["leisure"~"park|playground|garden|sports_centre|fitness_centre|stadium"](around:{radius},{lat},{lng});',
        'way["leisure"~"park|playground|garden|sports_centre|fitness_centre|stadium"](around:{radius},{lat},{lng});',
        'node["tourism"~"attraction|museum|hotel|motel|viewpoint|artwork|gallery"](around:{radius},{lat},{lng});',
        'way["tourism"~"attraction|museum|hotel|motel|viewpoint|artwork|gallery"](around:{radius},{lat},{lng});',
    ],
}

# Merge taxonomy OSM queries (data/live_search_taxonomy.json) — single source of truth.
CATEGORY_TAG_QUERIES.update(category_osm_queries())


# ---------------------------------------------------------------------------
# Tile feature property → category inference
# ---------------------------------------------------------------------------
# MapLibre vector tiles encode POI type in several ways depending on the tile
# provider and layer.  When a click arrives WITHOUT explicit amenity=/shop=
# properties (e.g. the tile uses class="shop" + type="alcohol"), we do a
# best-effort inference so we can show something meaningful instead of "Address".

_CLASS_TYPE_TO_CATEGORY: dict[str, str] = {
    "fuel": "Gas station",
    "gas_station": "Gas station",
    "restaurant": "Restaurant",
    "fast_food": "Fast food",
    "cafe": "Cafe",
    "coffee": "Cafe",
    "bar": "Bar",
    "pub": "Pub",
    "cinema": "Cinema",
    "theatre": "Theatre",
    "hospital": "Hospital",
    "clinic": "Clinic",
    "pharmacy": "Pharmacy",
    "parking": "Parking",
    "bank": "Bank",
    "atm": "ATM",
    "place_of_worship": "Place of worship",
    "church": "Church",
    "mosque": "Mosque",
    "synagogue": "Synagogue",
    "temple": "Temple",
    "school": "School",
    "college": "College",
    "university": "University",
    "library": "Library",
    "toilets": "Restroom",
    "restroom": "Restroom",
    "hotel": "Hotel",
    "motel": "Motel",
    "attraction": "Attraction",
    "museum": "Museum",
    "gallery": "Gallery",
    "park": "Park",
    "stadium": "Stadium",
    "fitness_centre": "Fitness center",
    "fitness_center": "Fitness center",
    "sports_centre": "Sports center",
    "sports_center": "Sports center",
    "bus_stop": "Bus stop",
    "platform": "Transit stop",
    "alcohol": "Liquor store",
    "liquor": "Liquor store",
    "liquor_store": "Liquor store",
    "beverages": "Beverage store",
    "convenience": "Convenience store",
    "supermarket": "Supermarket",
    "grocery": "Supermarket",
    "mobile_phone": "Mobile phone store",
    "clothes": "Clothing store",
    "clothing": "Clothing store",
    "bakery": "Bakery",
    "coffee_shop": "Coffee shop",
    "shop": "Shop",
}

_MAKI_TO_CATEGORY: dict[str, str] = {
    "alcohol-shop": "Liquor store",
    "liquor-store": "Liquor store",
    "bar": "Bar",
    "beer": "Bar",
    "restaurant": "Restaurant",
    "fast-food": "Fast food",
    "cafe": "Cafe",
    "coffee": "Cafe",
    "fuel": "Gas station",
    "gas-station": "Gas station",
    "pharmacy": "Pharmacy",
    "hospital": "Hospital",
    "cinema": "Cinema",
    "theatre": "Theatre",
    "museum": "Museum",
    "park": "Park",
    "parking": "Parking",
    "bank": "Bank",
    "atm": "ATM",
    "bus": "Bus stop",
    "rail": "Train station",
    "airport": "Airport",
    "hotel": "Hotel",
    "lodging": "Hotel",
    "grocery": "Supermarket",
    "convenience": "Convenience store",
    "clothing-store": "Clothing store",
    "library": "Library",
    "school": "School",
    "college": "College",
    "religious-christian": "Church",
    "religious-jewish": "Synagogue",
    "religious-muslim": "Mosque",
    "place-of-worship": "Place of worship",
    "fitness-centre": "Fitness center",
    "sports-centre": "Sports center",
}


def _infer_category_from_props(props: dict[str, Any]) -> str | None:
    """
    Infer a human-readable category from MapLibre tile feature properties
    when explicit OSM amenity=/shop= keys are absent.
    Returns None if no inference can be made (caller should default to 'Address').
    """
    if not props:
        return None

    # 1. maki / icon — set by the tile renderer for the displayed symbol
    for icon_key in ("maki", "icon", "symbol", "marker-symbol"):
        icon_val = str(props.get(icon_key) or "").lower().strip()
        if icon_val and icon_val in _MAKI_TO_CATEGORY:
            return _MAKI_TO_CATEGORY[icon_val]

    # 2. class / type / category — common in OpenMapTiles and similar schemas
    for key in ("class", "type", "category", "subclass", "kind"):
        val = str(props.get(key) or "").lower().strip().replace("-", "_").replace(" ", "_")
        if val and val in _CLASS_TYPE_TO_CATEGORY:
            return _CLASS_TYPE_TO_CATEGORY[val]

    # 3. layer.id / sourceLayer — last resort, pull the dominant noun
    layer_id = str(props.get("layer.id") or props.get("sourceLayer") or "").lower()
    if "alcohol" in layer_id or "liquor" in layer_id:
        return "Liquor store"
    if "fuel" in layer_id or "gas" in layer_id:
        return "Gas station"
    if "restaurant" in layer_id or "food" in layer_id:
        return "Restaurant"
    if "cafe" in layer_id or "coffee" in layer_id:
        return "Cafe"
    if "bar" in layer_id or "pub" in layer_id:
        return "Bar"
    if "cinema" in layer_id or "theatre" in layer_id or "theater" in layer_id:
        return "Cinema"
    if "hospital" in layer_id or "clinic" in layer_id:
        return "Hospital"
    if "pharmacy" in layer_id:
        return "Pharmacy"
    if "worship" in layer_id or "church" in layer_id:
        return "Place of worship"
    if "park" in layer_id:
        return "Park"
    if "hotel" in layer_id or "lodging" in layer_id:
        return "Hotel"
    if "shop" in layer_id:
        return "Shop"

    return None


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

        matched_key: str | None = None
        taxonomy_cat = get_category_by_key(clean_cat) or resolve_category_from_query(clean_cat)
        if taxonomy_cat:
            matched_key = str(taxonomy_cat.get("key") or "")
        elif clean_cat in CATEGORY_TAG_QUERIES:
            matched_key = clean_cat
        elif "waterfall" in clean_cat or clean_cat.endswith(" falls"):
            matched_key = "waterfalls"
        else:
            for k in CATEGORY_TAG_QUERIES.keys():
                if k in clean_cat or clean_cat in k:
                    matched_key = k
                    break

        if not matched_key:
            logger.info("Unknown nearby category %r — no Overpass query", category)
            return []

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

        response = None
        last_exc: Exception | None = None
        try:
            async with httpx.AsyncClient() as client:
                for mirror_url in OVERPASS_MIRRORS:
                    try:
                        r = await client.post(
                            mirror_url,
                            data={"data": overpass_query},
                            timeout=HTTP_TIMEOUT_SECONDS,
                            headers={"User-Agent": OVERPASS_USER_AGENT},
                        )
                        if r.status_code == 200:
                            response = r
                            break
                        logger.warning(
                            "Overpass mirror %s returned %s for category=%s",
                            mirror_url, r.status_code, matched_key,
                        )
                    except Exception as mirror_exc:
                        logger.warning("Overpass mirror %s failed: %s", mirror_url, mirror_exc)
                        last_exc = mirror_exc
        except Exception as exc:
            last_exc = exc

        if response is None:
            logger.error("All Overpass mirrors failed. Last error: %s", last_exc)
            return []

        try:
            data = response.json()
            elements = data.get("elements", [])
        except Exception as exc:
            logger.error("Overpass API JSON parse failed: %s", exc)
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

    @staticmethod
    def _escape_overpass_regex(value: str) -> str:
        return re.sub(r'([.*+?^${}()|[\]\\])', r"\\\1", value.strip())

    @staticmethod
    async def search_places_by_text(
        query: str,
        lat: float,
        lng: float,
        radius_meters: int = 10000,
        limit: int = 8,
    ) -> list[dict[str, Any]]:
        """Search nearby named OSM POIs by name, brand, or operator within a radius."""
        clean_q = query.strip()
        if len(clean_q) < 2:
            return []

        pattern = PlacesNearbyService._escape_overpass_regex(clean_q)
        rounded_lat = round(lat, 3)
        rounded_lng = round(lng, 3)
        cache_key = ("text", pattern.lower(), rounded_lat, rounded_lng, radius_meters)

        now = time.time()
        cached = _nearby_cache.get(cache_key)
        if cached and cached[0] > now:
            return cached[1][:limit]

        overpass_query = f"""[out:json][timeout:15];
(
  node["name"~"{pattern}",i](around:{radius_meters},{lat},{lng});
  way["name"~"{pattern}",i](around:{radius_meters},{lat},{lng});
  node["brand"~"{pattern}",i](around:{radius_meters},{lat},{lng});
  way["brand"~"{pattern}",i](around:{radius_meters},{lat},{lng});
  node["operator"~"{pattern}",i](around:{radius_meters},{lat},{lng});
  way["operator"~"{pattern}",i](around:{radius_meters},{lat},{lng});
);
out center;"""

        response = None
        last_exc: Exception | None = None
        try:
            async with httpx.AsyncClient() as client:
                for mirror_url in OVERPASS_MIRRORS:
                    try:
                        r = await client.post(
                            mirror_url,
                            data={"data": overpass_query},
                            timeout=HTTP_TIMEOUT_SECONDS,
                            headers={"User-Agent": OVERPASS_USER_AGENT},
                        )
                        if r.status_code == 200:
                            response = r
                            break
                        logger.warning(
                            "Overpass mirror %s returned %s for text query=%s",
                            mirror_url,
                            r.status_code,
                            clean_q,
                        )
                    except Exception as mirror_exc:
                        logger.warning("Overpass mirror %s failed: %s", mirror_url, mirror_exc)
                        last_exc = mirror_exc
        except Exception as exc:
            last_exc = exc

        if response is None:
            logger.error("All Overpass mirrors failed for text search. Last error: %s", last_exc)
            return []

        try:
            data = response.json()
            elements = data.get("elements", [])
        except Exception as exc:
            logger.error("Overpass text search JSON parse failed: %s", exc)
            return []

        normalized_results: list[dict[str, Any]] = []
        for elem in elements:
            norm = normalize_poi_result(elem, lat, lng)
            if norm:
                normalized_results.append(norm)

        normalized_results.sort(key=lambda x: x["distanceMiles"])
        _nearby_cache[cache_key] = (now + CACHE_TTL_SECONDS, normalized_results[:50])
        _prune_cache()
        return normalized_results[:limit]

    @staticmethod
    def _score_candidate(candidate: dict[str, Any], clicked_name: str | None) -> float:
        score = 0.0
        cand_name = candidate.get("name")

        # 1. Name match
        if clicked_name and cand_name:
            c_clean = clicked_name.strip().lower()
            cand_clean = cand_name.strip().lower()
            if c_clean == cand_clean:
                score += 1000.0
            elif c_clean in cand_clean or cand_clean in c_clean:
                score += 500.0

        # 2. Prefer named POIs
        if cand_name and cand_name != "Unnamed Place":
            score += 200.0

        # 3. Prefer POI tags
        tags = candidate.get("tags") or {}
        has_poi_tag = any(k in tags for k in ["amenity", "shop", "tourism", "leisure", "healthcare", "highway", "public_transport"])
        if has_poi_tag:
            score += 100.0

        # 4. Closer is better (distance in miles converted to meters)
        dist_miles = candidate.get("distanceMiles", 0.0)
        dist_meters = dist_miles * 1609.344
        score -= dist_meters * 2.0

        return score

    @staticmethod
    async def resolve_click(
        lat: float,
        lng: float,
        clicked_name: str | None = None,
        feature_properties: dict[str, Any] | None = None,
        radius_meters: int = 75,
    ) -> dict[str, Any]:
        """Enrich a map click using vector feature properties or a nearby POI search."""
        radius_meters = max(10, min(150, radius_meters))

        props = feature_properties or {}
        # "Useful" means: either the classic OSM tags are present, OR the tile
        # includes class/type/maki which we can infer a category from.
        has_explicit_tags = any(
            k in props
            for k in ["amenity", "shop", "tourism", "leisure", "healthcare", "highway", "public_transport"]
        )
        inferred_category_from_props = _infer_category_from_props(props)
        has_useful_props = has_explicit_tags or (inferred_category_from_props is not None)

        name = props.get("name") or props.get("display_name") or props.get("title") or clicked_name

        # Step 1: If feature properties already contain a useful category
        if has_useful_props and name:
            if has_explicit_tags:
                category = normalize_tags(props)
            else:
                # class/type/maki based inference — no explicit OSM tag
                category = inferred_category_from_props  # type: ignore[assignment]
            address = (
                props.get("address")
                or props.get("addr:full")
                or format_address_from_osm_tags(props, lat, lng)
            )
            osm_id = str(props.get("osm_id") or props.get("id") or "")
            osm_type = str(props.get("osm_type") or "node")
            place_key = f"osm:{osm_type}:{osm_id}" if osm_id else f"map-feature:{round(lat, 5)},{round(lng, 5)}"

            place_data = {
                "id": place_key,
                "placeKey": place_key,
                "name": name,
                "category": category,
                "address": address,
                "lat": lat,
                "lng": lng,
                "distanceMeters": 0.0,
                "source": "map_feature",
                "tags": props,
            }
            return {
                "place": place_data,
                "candidates": [place_data],
            }

        # Step 2: Fetch nearby POIs to enrich
        nearby = await PlacesNearbyService.search_nearby_places(
            category="click",
            lat=lat,
            lng=lng,
            radius_meters=radius_meters,
            limit=20,
        )

        scored_candidates = []
        for cand in nearby:
            score = PlacesNearbyService._score_candidate(cand, name)
            scored_candidates.append((score, cand))

        # Sort by score descending
        scored_candidates.sort(key=lambda x: x[0], reverse=True)

        candidates_out = []
        for _, cand in scored_candidates:
            dist_meters = cand.get("distanceMiles", 0.0) * 1609.344
            candidates_out.append({
                "id": cand["id"],
                "placeKey": cand["placeKey"],
                "name": cand["name"],
                "category": cand["category"],
                "address": cand["address"],
                "lat": cand["lat"],
                "lng": cand["lng"],
                "distanceMeters": round(dist_meters, 2),
                "source": "osm_enriched",
                "tags": cand.get("tags") or {},
            })

        if candidates_out:
            best_candidate = candidates_out[0]
            best_candidate["source"] = "osm_enriched"
            return {
                "place": best_candidate,
                "candidates": candidates_out,
            }

        # Step 3: Fall back to reverse geocode
        from app.services.geocoding_service import GeocodingService
        from app.services.place_key_service import build_place_key

        geo_result = await GeocodingService.reverse_geocode(lat, lng)
        if geo_result:
            addr = geo_result.get("address", {})
            city = (
                addr.get("city")
                or addr.get("town")
                or addr.get("village")
                or addr.get("hamlet")
                or addr.get("suburb")
            )
            country = addr.get("country")

            # Prefer clicked_name (from vector tile) over the geocoded road name.
            # clicked_name is the name the user saw on the map — trust it.
            geo_name = (
                clicked_name
                or geo_result.get("name")
                or addr.get("road")
                or geo_result.get("display_name", "").split(",")[0]
                or "Location Address"
            )

            # Try to infer category from the feature properties (class/type/maki/icon).
            # This handles tile features that encode POI type via class= or type= rather
            # than explicit amenity=/shop= tags that are filtered by Overpass.
            geo_category = _infer_category_from_props(props) or "Address"

            address_str = geo_result.get("display_name")
            place_key = build_place_key(
                name=geo_name,
                lat=lat,
                lng=lng,
                city=city,
                country=country,
                osm_type=geo_result.get("osm_type"),
                osm_id=geo_result.get("osm_id"),
            )

            address_place = {
                "id": place_key,
                "placeKey": place_key,
                "name": geo_name,
                "category": geo_category,
                "address": address_str,
                "lat": lat,
                "lng": lng,
                "distanceMeters": 0.0,
                "source": "reverse_geocode",
                "tags": geo_result.get("extratags") or {},
            }
            return {
                "place": address_place,
                "candidates": [address_place],
            }

        # Step 4: Fall back to dropped pin
        dropped_pin_key = f"dropped-pin:{round(lat, 5)},{round(lng, 5)}"
        dropped_pin_place = {
            "id": dropped_pin_key,
            "placeKey": dropped_pin_key,
            "name": name or "Dropped pin",
            "category": "Dropped pin",
            "address": f"Coordinates: {round(lat, 5)}, {round(lng, 5)}",
            "lat": lat,
            "lng": lng,
            "distanceMeters": 0.0,
            "source": "dropped_pin",
            "tags": {},
        }
        return {
            "place": dropped_pin_place,
            "candidates": [dropped_pin_place],
        }

