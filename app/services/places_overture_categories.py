"""Overture basic_category buckets for Explore places (mirrors scripts/places_categories.py)."""

from __future__ import annotations

# Food, drink, and cafe — Explore "restaurants" bucket
RESTAURANT_BASIC_CATEGORIES: frozenset[str] = frozenset(
    {
        "restaurant",
        "mexican_restaurant",
        "pizza_restaurant",
        "american_restaurant",
        "chinese_restaurant",
        "italian_restaurant",
        "japanese_restaurant",
        "thai_restaurant",
        "indian_restaurant",
        "korean_restaurant",
        "vietnamese_restaurant",
        "greek_restaurant",
        "french_restaurant",
        "spanish_restaurant",
        "mediterranean_restaurant",
        "middle_eastern_restaurant",
        "seafood_restaurant",
        "steakhouse",
        "bbq_restaurant",
        "sushi_restaurant",
        "ramen_restaurant",
        "tapas_restaurant",
        "diner",
        "breakfast_and_brunch",
        "bar",
        "cocktail_bar",
        "wine_bar",
        "sports_bar",
        "dive_bar",
        "beer_bar",
        "pub",
        "brewery",
        "brewpub",
        "winery",
        "distillery",
        "night_club",
        "speakeasy",
        "cafe",
        "coffee_shop",
        "tea_room",
        "bakery",
        "dessert_shop",
        "ice_cream_shop",
    }
)

# Culture, activity, outdoor — Explore "attractions" bucket
ATTRACTION_BASIC_CATEGORIES: frozenset[str] = frozenset(
    {
        "museum",
        "art_gallery",
        "theatre",
        "performing_arts_venue",
        "music_venue",
        "concert_hall",
        "opera_house",
        "cinema",
        "bowling_alley",
        "karaoke_bar",
        "arcade",
        "mini_golf",
        "pool_hall",
        "escape_room",
        "axe_throwing",
        "comedy_club",
        "climbing_gym",
        "park",
        "botanical_garden",
        "beach",
        "zoo",
        "aquarium",
        "garden",
    }
)


def category_bucket(category: str) -> str | None:
    slug = (category or "").strip().lower()
    if not slug:
        return None
    if slug in RESTAURANT_BASIC_CATEGORIES:
        return "restaurants"
    if slug in ATTRACTION_BASIC_CATEGORIES:
        return "attractions"
    return None
