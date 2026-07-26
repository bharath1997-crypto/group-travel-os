"""Classify Wayra questions for open-source + hybrid LLM routing."""

from __future__ import annotations

import re

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
    (r"\bfood\b", "food"),
    (r"\bparking\b", "parking"),
    (r"\bhotels?\b", "hotel"),
    (r"\battractions?\b", "attraction"),
    (r"\bmuseums?\b", "museum"),
    (r"\bbeaches\b", "beach"),
    (r"\bchurches?\b", "church"),
]

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
    ]
]


def nearby_category_from_message(message: str) -> str | None:
    q = normalize_query(message)
    for pattern, category in _NEARBY_KEYWORDS:
        if re.search(pattern, q):
            return category
    if re.search(r"\bnear( me|by)?\b", q) and re.search(
        r"\b(find|any|where|open|list|show)\b", q
    ):
        return "all"
    return None


def classify_wayra_answer_tier(message: str, ctx: dict | None) -> WayraAnswerTier:
    q = normalize_query(message)
    if not q:
        return "discovery"

    if nearby_category_from_message(message):
        return "nearby"

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
        return {
            "name": attached.get("label") or "Selected location",
            "lat": float(attached["lat"]),
            "lng": float(attached["lng"]),
            "category": None,
            "city": None,
            "state": None,
            "country": None,
        }
    for key in ("selectedPlace", "activeMapPin"):
        selected = ctx.get(key)
        if isinstance(selected, dict) and selected.get("lat") is not None:
            return {
                "name": selected.get("name") or "Selected location",
                "lat": float(selected["lat"]),
                "lng": float(selected["lng"]),
                "category": selected.get("category"),
                "city": selected.get("city"),
                "state": selected.get("state"),
                "country": selected.get("country"),
            }
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
