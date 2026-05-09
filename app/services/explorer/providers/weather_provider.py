import httpx
import logging
from typing import List

from app.core.api_limits import API_TIMEOUT_SECONDS
from app.schemas.explorer import ExplorerCard, create_explorer_card

logger = logging.getLogger(__name__)


class WeatherProvider:
    """Provider for Open-Meteo weather. 100% Free, no keys needed."""

    def __init__(self):
        self.url = "https://api.open-meteo.com/v1/forecast"

    async def fetch_cards(
        self, lat: float, lon: float, radius: int
    ) -> List[ExplorerCard]:
        """Fetch current weather and return as an ExplorerCard."""
        params = {
            "latitude": lat,
            "longitude": lon,
            "current_weather": "true",
        }

        try:
            async with httpx.AsyncClient(
                timeout=API_TIMEOUT_SECONDS
            ) as client:
                r = await client.get(self.url, params=params)

            if r.status_code != 200:
                logger.warning("Open-Meteo HTTP %s: %s", r.status_code, r.text[:200])
                return []

            data = r.json()
            current = data.get("current_weather", {})
            if not current:
                return []

            temp = current.get("temperature")
            code = current.get("weathercode")

            # Map weather code to description
            desc = self._get_weather_desc(code)

            # Create card with automatic fingerprinting
            card = create_explorer_card(
                source="open_meteo",
                title=f"Currently {temp}°C and {desc}",
                item_type="weather",
                venue_name="Live Weather",
                city_name="",
                id=f"weather_{lat}_{lon}",
                metadata={
                    "temperature": temp, 
                    "description": desc, 
                    "weather_code": code
                },
                category="weather"
            )

            return [card]

        except Exception as exc:
            logger.warning("Weather fetch failed: %s", exc)
            return []

    def _get_weather_desc(self, code: int) -> str:
        """Map WMO weather codes to friendly descriptions."""
        # Reference: https://open-meteo.com/en/docs
        mapping = {
            0: "Clear sky",
            1: "Mainly clear",
            2: "Partly cloudy",
            3: "Overcast",
            45: "Fog",
            48: "Depositing rime fog",
            51: "Light drizzle",
            53: "Moderate drizzle",
            55: "Dense drizzle",
            61: "Slight rain",
            63: "Moderate rain",
            65: "Heavy rain",
            71: "Slight snow fall",
            73: "Moderate snow fall",
            75: "Heavy snow fall",
            95: "Thunderstorm",
        }
        return mapping.get(code, "Clear")
