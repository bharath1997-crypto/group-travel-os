"""Weather question sub-intents for Wayra local replies."""

from __future__ import annotations

import re
from typing import Any, Literal

from app.services.wayra_intent import normalize_query

WeatherSubIntent = Literal[
    "weather_current",
    "weather_precipitation",
    "weather_alerts",
    "weather_forecast",
    "weather_clothing",
    "weather_season",
]

_SNOW_CODES = frozenset({71, 73, 75, 77, 85, 86})
_RAIN_CODES = frozenset({51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 99})


def classify_weather_sub_intent(message: str) -> WeatherSubIntent:
    q = normalize_query(message)
    if re.search(r"\b(warning|warnings|alert|alerts)\b", q):
        return "weather_alerts"
    if re.search(r"\b(snow|snowing|rain|raining|precipitation|rain a lot)\b", q):
        return "weather_precipitation"
    if re.search(r"\b(umbrella|what (to|should i) wear|pack|coat|clothes|hot or cold)\b", q):
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


def build_weather_reply(
    *,
    sub_intent: WeatherSubIntent,
    place_label: str,
    body: dict[str, Any],
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
