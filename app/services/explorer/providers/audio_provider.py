import httpx
import logging
from typing import List

from app.core.api_limits import API_TIMEOUT_SECONDS
from app.schemas.explorer import ExplorerCard, create_explorer_card

logger = logging.getLogger(__name__)


class AudioProvider:
    """Provider for Audio (Radio Browser). 100% Free, no keys needed."""

    def __init__(self):
        # Radio Browser has multiple mirrors. This is a common base URL.
        self.url = "https://de1.api.radio-browser.info/json/stations/search"

    async def fetch_cards(
        self, lat: float, lon: float, radius: int
    ) -> List[ExplorerCard]:
        """Fetch radio stations and normalize to ExplorerCards."""
        # Radio Browser supports country code. Hardcoding 'US' for MVP as requested in sequence.
        params = {
            "countrycode": "US",
            "limit": 10,
            "order": "clickcount",
            "reverse": "true",
        }

        try:
            async with httpx.AsyncClient(
                timeout=API_TIMEOUT_SECONDS
            ) as client:
                r = await client.get(self.url, params=params)

            if r.status_code != 200:
                logger.warning("Radio Browser HTTP %s: %s", r.status_code, r.text[:200])
                return []

            data = r.json()
            if not isinstance(data, list):
                return []

            cards: List[ExplorerCard] = []
            for station in data:
                if not isinstance(station, dict):
                    continue

                name = str(station.get("name") or "")
                url = str(station.get("url_resolved") or station.get("url") or "")
                favicon = str(station.get("favicon") or "")
                tags = str(station.get("tags") or "")

                if not name or not url:
                    continue

                # Create card with automatic fingerprinting
                card = create_explorer_card(
                    source="radio_browser",
                    title=name,
                    item_type="audio",
                    venue_name="Live Radio",
                    city_name="",
                    id=url,  # Use stream URL as ID
                    links={"stream": url},
                    images=[favicon] if favicon else [],
                    metadata={"tags": tags},
                    category="audio"
                )

                cards.append(card)

            return cards

        except Exception as exc:
            logger.warning("Audio fetch failed: %s", exc)
            return []
