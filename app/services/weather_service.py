"""
app/services/weather_service.py — Open-Meteo forecast (no API key)

In-memory TTL cache (6h), synchronous httpx. No Redis/Celery.
"""
from __future__ import annotations

import time
from datetime import date, datetime, timezone

import httpx

from app.utils.exceptions import AppException

TTL_SECONDS = 21_600  # 6 hours

_WMO_CODES: dict[int, str] = {
    0: "clear sky",
    1: "mainly clear",
    2: "partly cloudy",
    3: "overcast",
    45: "fog",
    48: "icy fog",
    51: "light drizzle",
    53: "moderate drizzle",
    55: "dense drizzle",
    61: "slight rain",
    63: "moderate rain",
    65: "heavy rain",
    71: "slight snow",
    73: "moderate snow",
    75: "heavy snow",
    80: "slight showers",
    81: "moderate showers",
    82: "violent showers",
    95: "thunderstorm",
    99: "thunderstorm with hail",
}

# Cache: key (lat, lng, date_str) -> (unix_expiry, payload without "cached")
_forecast_cache: dict[tuple[float, float, str], tuple[float, dict[str, object]]] = {}

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def _cache_key(lat: float, lng: float, d: date) -> tuple[float, float, str]:
    return (round(lat, 6), round(lng, 6), d.isoformat())


def _utc_today() -> date:
    return datetime.now(timezone.utc).date()


def _wmo_description(code: object | None) -> str:
    if code is None:
        return "unknown"
    try:
        c = int(code)
    except (TypeError, ValueError):
        return "unknown"
    return _WMO_CODES.get(c, "unknown")


class WeatherService:
    @staticmethod
    def get_forecast(lat: float, lng: float, target_date: date) -> dict:
        ck = _cache_key(lat, lng, target_date)
        now = time.time()
        if ck in _forecast_cache:
            expires_at, body = _forecast_cache[ck]
            if now < expires_at:
                return {**body, "cached": True}

        today = _utc_today()
        delta = (target_date - today).days
        if delta < 0:
            AppException.bad_request("Forecast date must be today or in the future")
        if delta > 5:
            AppException.bad_request("Forecast only available up to 5 days ahead")

        params = {
            "latitude": lat,
            "longitude": lng,
            "current": "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code",
            "daily": "temperature_2m_max,temperature_2m_min,weather_code,wind_speed_10m_max",
            "timezone": "UTC",
            "forecast_days": 6,
        }
        timeout = httpx.Timeout(15.0)

        try:
            with httpx.Client(timeout=timeout) as client:
                resp = client.get(OPEN_METEO_URL, params=params)
        except httpx.HTTPError:
            AppException.bad_gateway("Weather service unavailable")

        if resp.status_code != 200:
            AppException.bad_gateway("Weather service unavailable")

        payload = resp.json()

        if delta == 0:
            current = payload.get("current") or {}
            if not current:
                AppException.bad_gateway("Weather service unavailable")
            temp_c = float(current["temperature_2m"])
            feels_like_c = float(current["apparent_temperature"])
            humidity = int(round(float(current["relative_humidity_2m"])))
            wind_kph = float(current["wind_speed_10m"])
            description = _wmo_description(current.get("weather_code"))
            body = {
                "temp_c": temp_c,
                "feels_like_c": feels_like_c,
                "description": description,
                "humidity": humidity,
                "wind_kph": wind_kph,
            }
        else:
            daily = payload.get("daily") or {}
            times = daily.get("time") or []
            tmax = daily.get("temperature_2m_max") or []
            tmin = daily.get("temperature_2m_min") or []
            wcodes = daily.get("weather_code") or []
            wmax = daily.get("wind_speed_10m_max") or []

            target_str = target_date.isoformat()
            try:
                idx = list(times).index(target_str)
            except ValueError:
                AppException.bad_gateway("Weather service unavailable")

            hi = float(tmax[idx])
            lo = float(tmin[idx])
            temp_c = (hi + lo) / 2.0
            feels_like_c = temp_c
            humidity = 0
            wind_kph = float(wmax[idx])
            description = _wmo_description(wcodes[idx] if idx < len(wcodes) else None)
            body = {
                "temp_c": temp_c,
                "feels_like_c": feels_like_c,
                "description": description,
                "humidity": humidity,
                "wind_kph": wind_kph,
            }

        expires_at = time.time() + TTL_SECONDS
        _forecast_cache[ck] = (expires_at, body)
        return {**body, "cached": False}
