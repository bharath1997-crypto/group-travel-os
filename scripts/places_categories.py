"""Exact Overture going-out category lists for the data-spine filter."""

GOING_OUT_CATEGORIES: tuple[str, ...] = (
    # food
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
    # drink
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
    # cafe
    "cafe",
    "coffee_shop",
    "tea_room",
    "bakery",
    "dessert_shop",
    "ice_cream_shop",
    # culture
    "museum",
    "art_gallery",
    "theatre",
    "performing_arts_venue",
    "music_venue",
    "concert_hall",
    "opera_house",
    "cinema",
    # activity
    "bowling_alley",
    "karaoke_bar",
    "arcade",
    "mini_golf",
    "pool_hall",
    "escape_room",
    "axe_throwing",
    "comedy_club",
    "climbing_gym",
    # outdoor
    "park",
    "botanical_garden",
    "beach",
    "zoo",
    "aquarium",
    "garden",
)

EXCLUDE_CATEGORIES: tuple[str, ...] = (
    "fast_food_restaurant",
    "barber",
    "parking",
    "hair_salon",
    "nail_salon",
    "public_health_clinic",
    "gas_station",
    "convenience_store",
    "pharmacy",
)


def sql_string_list(values: tuple[str, ...] | list[str]) -> str:
    escaped = [v.replace("'", "''") for v in values]
    return ", ".join(f"'{v}'" for v in escaped)
