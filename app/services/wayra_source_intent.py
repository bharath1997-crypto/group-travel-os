"""Classify Wayra questions for open-source + hybrid LLM routing."""

from __future__ import annotations

import re

from app.services.wayra_behavior_hints import (
    is_composite_whats_here_question,
    is_polar_day_night_question,
)
from app.services.wayra_intent import _is_live_page, normalize_query

WayraAnswerTier = str  # nearby | discovery | location_hard

_NEARBY_KEYWORDS: list[tuple[str, str]] = [
    (r"\bpharmacies?\b", "pharmacy"),
    (r"\bhospitals?\b", "hospital"),
    (r"\bclinics?\b", "clinic"),
    (r"\batms?\b", "atm"),
    (r"\bbanks?\b", "bank"),
    (r"\bgas stations?\b", "gas"),
    (r"\bfuel\b", "gas"),
    (r"\bcoffee\b", "coffee"),
    (r"\bcafes?\b", "coffee"),
    (r"\brestaurants?\b", "food"),
    (r"\bfood spots?\b", "food"),
    (r"\bnearby food\b", "food"),
    (r"\bplaces to eat\b", "food"),
    (r"\beat near\b", "food"),
    (r"\bparking\b", "parking"),
    (r"\bhotels?\b", "hotel"),
    (r"\battractions?\b", "attraction"),
    (r"\bmuseums?\b", "museum"),
    (r"\bbeaches\b", "beach"),
    (r"\bchurches?\b", "church"),
]

# Must-try food / culture / activities → discovery (Wikipedia + region), not OSM nearby search.
_DISCOVERY_FIRST_RE = re.compile(
    r"\b(must try|must-try|must try food|local specialty|locals eat|street food|food culture|cuisine|"
    r"local culture|culture like|cultural event|cultural events|what can i do|things to do|activities|"
    r"what s special|anything fun|worth the trip|what kind of (clothes|food)|clothes should i|"
    r"what (to|should i) wear|pack for|vegetarian|vegan|dietary|pepperoni|beef|chicken|"
    r"how is the food|restrictions?|entry (fee|fees)|visa|safety|"
    r"famous food|markets?|food over|what is the famous|prime.*food|"
    r"interesting things|what should i know about)\b",
    re.I,
)

_FOOD_DISCOVERY_RE = _DISCOVERY_FIRST_RE

_NEARBY_SPOT_RE = re.compile(
    r"\b("
    r"near this|near here|near the pin|near this exact|near that spot|"
    r"what s near|what is near|what's near|whats near|nearby here|around here|"
    r"near me at this|at this exact spot|near this location"
    r")\b",
    re.I,
)

_LOCATION_HARD_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.I)
    for p in [
        r"\bborder\b",
        r"\blast mile\b",
        r"\broute warning\b",
        r"\bnavigate\b",
        r"\breroute\b",
        r"\bhow far is\b",
        r"\bhow long is the drive\b",
        r"\bbest route\b",
        r"\btraffic to\b",
        r"\bcrossing\b",
        r"\bprepare for this trip\b",
        r"\bwhat should i prepare\b",
        r"\bplan(?:ning)?(?:\s+a\s+trip)?\b",
        r"\bitinerary\b",
        r"\bwhat do you say\b",
        r"\bwhat should i do(?: here| at this)?\b",
        r"\bhelp me plan\b",
        r"\btrip plan\b",
        r"\bvisit plan\b",
        r"\bfrom my (?:house|home)\b",
        r"\bfor that location from my (?:house|home)\b",
        r"\bfrom my location to\b",
        r"\bcall from my location to\b",
        r"\bhow to reach\b",
        r"\bway to reach\b",
        r"\bhow do i get there\b",
        r"\bget over there\b",
        r"\bwhat flight\b",
        r"\bwhich flight\b",
        r"\bwhen should i (?:go|visit|plan|travel|leave)\b",
        r"\bhow many days\b",
        r"\b\d+\s*(?:k|000)?\s*(?:dollars|\$|usd|budget)\b",
        r"\bbudget\b",
        r"\bwhat should i plan\b",
    ]
]

_TRIP_LOGISTICS_RE = re.compile(
    r"\b("
    r"how to reach|way to reach|how do i get there|get over there|"
    r"what flight|which flight|fly from|when should i (?:go|visit|plan|travel|leave)|"
    r"how many days|what day|what should i plan|help me plan|"
    r"\$\d|\d+\s*(?:k|000)\s*(?:dollars|usd|budget)|budget of|\bon my hand\b"
    r")\b",
    re.I,
)


_PLAN_OR_BUDGET_RE = re.compile(
    r"\b("
    r"budget|itinerary|luxur|plan an|plan a \d|cost breakdown|\$\d|"
    r"\d+\s*(?:k|000)\s*(?:dollars|usd)|insanely|michelin|5-star|five star|private jet"
    r")\b",
    re.I,
)


def is_plan_or_budget_question(message: str) -> bool:
    return bool(_PLAN_OR_BUDGET_RE.search(normalize_query(message)))


def nearby_category_from_message(message: str) -> str | None:
    q = normalize_query(message)
    if is_plan_or_budget_question(message):
        return None
    if is_polar_day_night_question(message):
        return None
    prefer_discovery = bool(_FOOD_DISCOVERY_RE.search(q))
    if prefer_discovery:
        return None
    matched: list[str] = []
    for pattern, category in _NEARBY_KEYWORDS:
        if re.search(pattern, q):
            if category not in matched:
                matched.append(category)
    if len(matched) >= 2:
        return "all"
    if matched:
        return matched[0]
    if _NEARBY_SPOT_RE.search(q) and re.search(
        r"\b(restaurants?|cafes?|coffee|food|attractions?|museums?|hotels?|pharmacies?|"
        r"places|spots|things)\b",
        q,
    ):
        return "all"
    if re.search(r"\bnear( me|by)?\b", q) and re.search(
        r"\b(find|any|where|open|list|show)\b", q
    ):
        return "all"
    if is_structured_nearby_list_request(message) and re.search(r"\brestaurants?\b", q):
        return "food"
    return None


def is_nearby_poi_question(message: str) -> bool:
    return nearby_category_from_message(message) is not None


_LIST_REQUEST_RE = re.compile(
    r"\b(list of|give me a list|give me|show me|find me)\b|"
    r"\b\d+\s*-\s*\d+\s+restaurants?\b|"
    r"\blist of\s+\d+",
    re.I,
)


def is_structured_nearby_list_request(message: str) -> bool:
    q = normalize_query(message)
    if not q:
        return False
    if _LIST_REQUEST_RE.search(q):
        return True
    return bool(re.search(r"\b\d+\s*-\s*\d+\b", q) and re.search(r"\brestaurants?\b", q))


def nearby_result_limit(message: str) -> int:
    if not is_structured_nearby_list_request(message):
        return 8
    q = normalize_query(message)
    range_m = re.search(r"\b(\d+)\s*-\s*(\d+)\b", q)
    if range_m:
        return min(20, max(int(range_m.group(1)), int(range_m.group(2))))
    num_m = re.search(r"\b(\d+)\s+restaurants?\b", q)
    if num_m:
        return min(20, int(num_m.group(1)))
    return 20


def nearby_search_radius_m(category: str, message: str) -> int:
    from app.services.wayra_sources_service import _DEFAULT_NEARBY_RADIUS_M, _NEARBY_RADIUS_M

    base = _NEARBY_RADIUS_M.get(category, _DEFAULT_NEARBY_RADIUS_M)
    if is_structured_nearby_list_request(message) and category in {"food", "all"}:
        return max(base, 80_000)
    return base


def is_distance_from_me_question(message: str) -> bool:
    q = normalize_query(message)
    if not q:
        return False
    return bool(
        re.search(
            r"\bhow far\b.*\b(from me|from my location|from here|to me|from my house|from my home)\b",
            q,
        )
        or re.search(r"\bhow far is (it|this|that)\b", q)
        or re.search(
            r"\b(from my (?:house|home)|for that location from my (?:house|home)|"
            r"from my location to (?:their|this|that|the) location|call from my location to)\b",
            q,
        )
    )


def is_trip_logistics_question(message: str) -> bool:
    q = normalize_query(message)
    return bool(q and _TRIP_LOGISTICS_RE.search(q))


def is_planning_from_home(ctx: dict | None) -> bool:
    """True when user GPS and map pin are far apart — answers should be home → destination."""
    if not ctx:
        return False
    user = ctx.get("userLocation")
    place = extract_place_from_context(ctx)
    if not isinstance(user, dict) or not place:
        return False
    u_lat, u_lng = user.get("lat"), user.get("lng")
    p_lat, p_lng = place.get("lat"), place.get("lng")
    if not all(isinstance(v, (int, float)) for v in (u_lat, u_lng, p_lat, p_lng)):
        return False
    from app.services.places_nearby_service import calculate_distance_miles

    miles = calculate_distance_miles(float(u_lat), float(u_lng), float(p_lat), float(p_lng))
    return miles > 200


def classify_wayra_answer_tier(message: str, ctx: dict | None) -> WayraAnswerTier:
    q = normalize_query(message)
    if not q:
        return "discovery"

    if is_trip_logistics_question(message) and is_planning_from_home(ctx):
        return "location_hard"

    if is_plan_or_budget_question(message):
        return "location_hard"

    if is_composite_whats_here_question(message):
        return "discovery"

    if is_polar_day_night_question(message):
        return "discovery"

    if nearby_category_from_message(message):
        return "nearby"

    if _DISCOVERY_FIRST_RE.search(q):
        return "discovery"

    for pat in _LOCATION_HARD_PATTERNS:
        if pat.search(q):
            return "location_hard"

    if _is_live_page("", ctx or {}):
        selected = (ctx or {}).get("selectedPlace")
        if isinstance(selected, dict):
            return "discovery"

    return "discovery"


def extract_place_from_context(ctx: dict | None) -> dict | None:
    if not ctx:
        return None
    attached = ctx.get("chatAttachedLocation")
    if isinstance(attached, dict) and attached.get("lat") is not None:
        place = {
            "name": attached.get("label") or "Selected location",
            "lat": float(attached["lat"]),
            "lng": float(attached["lng"]),
            "category": None,
            "city": None,
            "state": None,
            "country": None,
        }
        selected = ctx.get("selectedPlace")
        if isinstance(selected, dict):
            for key in ("city", "state", "country", "address", "category"):
                if not place.get(key) and selected.get(key):
                    place[key] = selected[key]
        region = ctx.get("resolvedMapRegion")
        if isinstance(region, str) and region.strip():
            from app.services.wayra_place_context import is_generic_place_name

            if is_generic_place_name(str(place.get("name") or "")):
                place["name"] = region.strip()
        return place
    for key in ("selectedPlace", "activeMapPin"):
        selected = ctx.get(key)
        if isinstance(selected, dict) and selected.get("lat") is not None:
            place = {
                "name": selected.get("name") or "Selected location",
                "lat": float(selected["lat"]),
                "lng": float(selected["lng"]),
                "category": selected.get("category"),
                "city": selected.get("city"),
                "state": selected.get("state"),
                "country": selected.get("country"),
            }
            break
    else:
        place = None

    if place:
        region = ctx.get("resolvedMapRegion")
        if isinstance(region, str) and region.strip():
            from app.services.wayra_place_context import is_generic_place_name

            if is_generic_place_name(str(place.get("name") or "")):
                place["name"] = region.strip()
        return place

    user_loc = ctx.get("userLocation")
    if isinstance(user_loc, dict) and user_loc.get("lat") is not None:
        return {
            "name": "Your location",
            "lat": float(user_loc["lat"]),
            "lng": float(user_loc["lng"]),
            "category": None,
            "city": user_loc.get("city"),
            "state": user_loc.get("state"),
            "country": user_loc.get("country"),
        }
    return None
