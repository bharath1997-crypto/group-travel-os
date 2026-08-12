"""Weather question sub-intents for Wayra local replies."""

from __future__ import annotations

import re
from datetime import date
from typing import Any, Literal

from app.services.wayra_intent import normalize_query

WeatherSubIntent = Literal[
    "weather_current",
    "weather_precipitation",
    "weather_alerts",
    "weather_forecast",
    "weather_clothing",
    "weather_comfort",
    "weather_season",
]

_SNOW_CODES = frozenset({71, 73, 75, 77, 85, 86})
_RAIN_CODES = frozenset({51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 99})

# Common home-city baselines for comfort comparisons (Open-Meteo, no key).
_HOME_CITY_COORDS: dict[str, tuple[float, float]] = {
    "chicago": (41.8781, -87.6298),
    "new york": (40.7128, -74.0060),
    "nyc": (40.7128, -74.0060),
    "los angeles": (34.0522, -118.2437),
    "la": (34.0522, -118.2437),
    "san francisco": (37.7749, -122.4194),
    "seattle": (47.6062, -122.3321),
    "miami": (25.7617, -80.1918),
    "houston": (29.7604, -95.3698),
    "dallas": (32.7767, -96.7970),
    "denver": (39.7392, -104.9903),
    "boston": (42.3601, -71.0589),
    "minneapolis": (44.9778, -93.2650),
    "toronto": (43.6532, -79.3832),
    "london": (51.5074, -0.1278),
    "paris": (48.8566, 2.3522),
    "tokyo": (35.6762, 139.6503),
    "mumbai": (19.0760, 72.8777),
    "delhi": (28.6139, 77.2090),
}


def classify_weather_sub_intent(message: str) -> WeatherSubIntent:
    q = normalize_query(message)
    if re.search(r"\b(warning|warnings|alert|alerts)\b", q):
        return "weather_alerts"
    if re.search(r"\b(snow|snowing|rain|raining|precipitation|rain a lot)\b", q):
        return "weather_precipitation"
    if re.search(
        r"\b("
        r"how (?:am i|will i|do i) (?:going to )?feel|"
        r"feel(?:s)? (?:like|for|to) (?:me|my)|"
        r"comfortable(?: for(?: my)? body)?|"
        r"too (?:harsh|difficult|extreme)|"
        r"hard on (?:my )?body|"
        r"acclimat(?:e|ize)|"
        r"compared to (?:home|chicago|my city)|"
        r"for (?:a |someone from )?(?:chicago|home)"
        r")\b",
        q,
    ):
        return "weather_comfort"
    if re.search(
        r"\b(umbrella|what (to|should i) wear|pack|coat|clothes|hot or cold|"
        r"jacket|layers?)\b",
        q,
    ):
        return "weather_clothing"
    if re.search(
        r"\b(best time of year|peak season|when should i avoid|when s peak|"
        r"good to visit right now|season is best)\b",
        q,
    ):
        return "weather_season"
    if re.search(r"\b(forecast|tomorrow|next week)\b", q):
        return "weather_forecast"
    return "weather_current"


def extract_home_city(message: str) -> str | None:
    """Pull a home/baseline city from phrasing like 'from my Chicago'."""
    q = normalize_query(message)
    for city in sorted(_HOME_CITY_COORDS.keys(), key=len, reverse=True):
        if re.search(
            rf"\b(?:from(?:\s+my)?|i(?:'m| am)\s+a|home|compared to|for a)\s+{re.escape(city)}\b",
            q,
        ) or re.search(rf"\b{re.escape(city)}\s+(?:person|people|native)\b", q):
            if city == "nyc":
                return "New York"
            if city == "la":
                return "Los Angeles"
            return city.title()
    return None


def _weather_code(body: dict[str, Any]) -> int | None:
    raw = body.get("weather_code")
    if raw is None:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _temp_line(body: dict[str, Any]) -> str:
    temp_c = body.get("temp_c")
    if not isinstance(temp_c, (int, float)):
        return ""
    temp_f = round(float(temp_c) * 9 / 5 + 32, 1)
    return f"about {temp_c:.0f}°C ({temp_f}°F)"


# Winter-hardened cities: ~10°C / 50°F reads mild (Gemini-style climate identity).
_COLD_WINTER_CITIES = frozenset(
    {
        "chicago",
        "minneapolis",
        "toronto",
        "boston",
        "denver",
        "new york",
        "nyc",
    }
)
_HOT_HUMID_CITIES = frozenset(
    {"miami", "houston", "dallas", "mumbai", "delhi"}
)
_MILD_COASTAL_CITIES = frozenset(
    {"san francisco", "seattle", "los angeles", "la", "london", "paris"}
)


def _home_climate(home_city: str | None) -> str:
    if not home_city:
        return "general"
    key = home_city.strip().lower()
    if key in _COLD_WINTER_CITIES:
        return "cold_winter"
    if key in _HOT_HUMID_CITIES:
        return "hot_humid"
    if key in _MILD_COASTAL_CITIES:
        return "mild_coastal"
    return "general"


def _comfort_band(
    temp_c: float,
    *,
    home_city: str | None = None,
) -> tuple[str, str, bool]:
    """Return (label, advice, difficult) — climate-aware when home_city is set."""
    climate = _home_climate(home_city)

    if climate == "cold_winter":
        # Chicago-style: 50°F is mild, not a body strain.
        if temp_c <= -10:
            return (
                "harsh cold",
                "Even for someone used to hard winters, this is difficult — heavy coat, hat, and gloves.",
                True,
            )
        if temp_c <= 2:
            return (
                "cold but familiar",
                "Cold, but within what a winter city body already handles — dress for winter, not panic.",
                False,
            )
        if temp_c <= 13:
            return (
                "mild and comfortable",
                "Not difficult for your body. This is light-jacket weather — closer to a Chicago spring or fall "
                "morning than a hard winter day.",
                False,
            )
        if temp_c <= 24:
            return (
                "comfortable",
                "Easy outdoors for you — lighter layers than you would need in a Chicago winter.",
                False,
            )
        return (
            "warm to hot",
            "Warmer than a typical cold-city winter baseline — light clothes and water if you are walking long.",
            False,
        )

    if climate == "hot_humid":
        if temp_c <= 8:
            return (
                "quite cold for you",
                "This will feel difficult compared with a hot-humid home — warm jacket, covered arms and legs.",
                True,
            )
        if temp_c <= 16:
            return (
                "cool",
                "Cooler than you are used to — a jacket will keep it comfortable, not harsh.",
                False,
            )
        if temp_c <= 28:
            return (
                "comfortable",
                "In a familiar warm range for your body.",
                False,
            )
        return (
            "hot and sticky",
            "This can feel hard in humidity — shade, water, slower pace.",
            True,
        )

    if climate == "mild_coastal":
        if temp_c <= 4:
            return (
                "cold",
                "Colder than a mild-coastal baseline — coat weather, not difficult if you layer.",
                False,
            )
        if temp_c <= 12:
            return (
                "cool",
                "Cool for you — light jacket or hoodie; not extreme.",
                False,
            )
        if temp_c <= 22:
            return (
                "comfortable",
                "Should feel easy for your body with light layers.",
                False,
            )
        return (
            "warm",
            "Warm for a mild-coastal body — light clothes and hydrate.",
            False,
        )

    # General / unknown home
    if temp_c <= 0:
        return (
            "harsh cold",
            "This will feel difficult outdoors without a heavy coat, hat, and gloves.",
            True,
        )
    if temp_c <= 8:
        return (
            "chilly",
            "Most people will want a warm jacket; short outdoor stretches are fine, long ones feel cold.",
            False,
        )
    if temp_c <= 14:
        return (
            "cool",
            "Comfortable with a light jacket or hoodie — not harsh, but cool for T-shirt-only.",
            False,
        )
    if temp_c <= 22:
        return (
            "comfortable",
            "This should feel easy for most bodies with light layers.",
            False,
        )
    if temp_c <= 28:
        return (
            "warm",
            "Comfortable to warm — light clothes, and hydrate if you are walking a lot.",
            False,
        )
    return (
        "hot",
        "This can feel hard on the body in direct sun — shade, water, and slower pacing help.",
        True,
    )


def _home_city_weather(home_city: str) -> dict[str, Any] | None:
    key = home_city.strip().lower()
    coords = _HOME_CITY_COORDS.get(key)
    if coords is None:
        for name, xy in _HOME_CITY_COORDS.items():
            if name in key or key in name:
                coords = xy
                break
    if coords is None:
        return None
    try:
        from app.services.weather_service import WeatherService

        return WeatherService.get_forecast(coords[0], coords[1], date.today())
    except Exception:  # noqa: BLE001
        return None


def build_weather_reply(
    *,
    sub_intent: WeatherSubIntent,
    place_label: str,
    body: dict[str, Any],
    home_city: str | None = None,
    home_body: dict[str, Any] | None = None,
) -> str:
    desc = str(body.get("description") or "unknown")
    temp_s = _temp_line(body)
    code = _weather_code(body)
    is_snow = code in _SNOW_CODES or "snow" in desc
    is_rain = code in _RAIN_CODES or "rain" in desc or "drizzle" in desc or "shower" in desc

    if sub_intent == "weather_precipitation":
        if is_snow:
            return (
                f"Yes — it is currently snowing or snow conditions are reported near {place_label} "
                f"({desc}, {temp_s})."
            )
        if is_rain:
            return (
                f"Yes — precipitation is reported near {place_label} "
                f"({desc}, {temp_s})."
            )
        return (
            f"No — it is not snowing or raining near {place_label} right now. "
            f"Current conditions: {desc}, {temp_s}."
        )

    if sub_intent == "weather_alerts":
        return (
            f"We do not have official weather alert feeds wired for {place_label} yet. "
            f"Current observed conditions: {desc}, {temp_s}. "
            "Check your national weather service for active warnings."
        )

    if sub_intent == "weather_clothing":
        temp_c = body.get("temp_c")
        if isinstance(temp_c, (int, float)) and float(temp_c) <= 5:
            wear = "Bring a warm coat, hat, gloves, and waterproof boots."
        elif isinstance(temp_c, (int, float)) and float(temp_c) >= 24:
            wear = "Light breathable layers and sun protection should be enough."
        else:
            wear = "Layer a light jacket you can remove if it warms up."
        return (
            f"For current conditions near {place_label} ({desc}, {temp_s}): {wear}"
        )

    if sub_intent == "weather_comfort":
        feels = body.get("feels_like_c")
        temp_c = body.get("temp_c")
        use_c = feels if isinstance(feels, (int, float)) else temp_c
        if not isinstance(use_c, (int, float)):
            return (
                f"I have conditions near {place_label} ({desc}, {temp_s}), "
                "but not enough temperature detail to judge comfort yet."
            )
        band, advice, difficult = _comfort_band(float(use_c), home_city=home_city)
        feels_bit = (
            f", feels like {float(feels):.0f}°C"
            if isinstance(feels, (int, float))
            else ""
        )
        temp_f = round(float(use_c) * 9 / 5 + 32)
        verdict = "difficult for your body" if difficult else "comfortable for your body — not difficult"
        if home_city:
            parts = [
                f"For someone from {home_city}: near {place_label} right now "
                f"({desc}, {temp_s}{feels_bit} / about {temp_f}°F), this is {band}.",
                f"Verdict: {verdict}.",
                advice,
            ]
            if isinstance(home_body, dict) and isinstance(home_body.get("temp_c"), (int, float)):
                home_c = float(home_body["temp_c"])
                home_f = round(home_c * 9 / 5 + 32)
                delta = float(use_c) - home_c
                if abs(delta) >= 3:
                    direction = "cooler" if delta < 0 else "warmer"
                    parts.append(
                        f"Live check: {home_city} is about {home_c:.0f}°C ({home_f}°F) right now — "
                        f"this pin is a bit {direction} than home today, but your climate baseline "
                        f"still drives how hard it feels."
                    )
            return " ".join(parts)

        return (
            f"Near {place_label} right now ({desc}, {temp_s}{feels_bit}): {band}. "
            f"{advice}"
        )

    if sub_intent == "weather_season":
        return (
            f"Based on climate patterns near {place_label}: late spring and early autumn "
            f"are often comfortable for sightseeing; winter can be cold and summer warm. "
            f"Right now it is {desc}, {temp_s}."
        )

    if sub_intent == "weather_forecast":
        return (
            f"Live forecast snapshot for {place_label}: {desc}, {temp_s}. "
            "Open-Meteo data covers the next few days — recheck closer to your travel date."
        )

    # weather_current
    feels = body.get("feels_like_c")
    humidity = body.get("humidity")
    wind = body.get("wind_kph")
    parts = [f"Current weather near {place_label}: {desc}, {temp_s}."]
    if isinstance(feels, (int, float)) and feels != body.get("temp_c"):
        parts.append(f"Feels like {feels:.0f}°C.")
    if isinstance(humidity, int) and humidity > 0:
        parts.append(f"Humidity {humidity}%.")
    if isinstance(wind, (int, float)):
        parts.append(f"Wind {wind:.0f} km/h.")
    return " ".join(parts)
