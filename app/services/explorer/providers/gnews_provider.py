import httpx
import logging
from typing import List

from app.core.api_limits import API_TIMEOUT_SECONDS
from app.schemas.explorer import ExplorerCard, create_explorer_card
from config import settings

logger = logging.getLogger(__name__)


class GNewsProvider:
    """Provider for GNews (Buzz section)."""

    def __init__(self):
        self.api_key = (settings.gnews_api_key or "").strip()
        self.url = "https://gnews.io/api/v4/search"

    async def fetch_cards(
        self, lat: float, lon: float, radius: int
    ) -> List[ExplorerCard]:
        """Fetch news from GNews and normalize to ExplorerCards."""
        if not self.api_key:
            logger.warning("GNews API key not configured.")
            return []

        # GNews requires a query 'q'.
        # Since the ExplorerProvider interface only provides lat/lon, we use a 
        # generic query for travel/events. In a full implementation, we would 
        # resolve the city name first or pass it in context.
        query = "travel"

        params = {
            "q": query,
            "token": self.api_key,
            "lang": "en",
            "max": 10,
        }

        try:
            async with httpx.AsyncClient(
                timeout=API_TIMEOUT_SECONDS
            ) as client:
                r = await client.get(self.url, params=params)

            if r.status_code != 200:
                logger.warning("GNews HTTP %s: %s", r.status_code, r.text[:200])
                return []

            data = r.json()
            articles = data.get("articles", [])
            if not isinstance(articles, list):
                return []

            cards: List[ExplorerCard] = []
            for a in articles:
                if not isinstance(a, dict):
                    continue

                title = str(a.get("title") or "")
                url = str(a.get("url") or "")
                desc = str(a.get("description") or "")
                src = (
                    a.get("source", {}).get("name")
                    if isinstance(a.get("source"), dict)
                    else "News"
                )

                if not title or not url:
                    continue

                # Create card with automatic fingerprinting
                card = create_explorer_card(
                    source="gnews",
                    title=title,
                    item_type="news",
                    venue_name=str(src),
                    city_name="",  # Unknown without resolution
                    id=url,        # Use URL as ID
                    links={"article": url},
                    metadata={"description": desc},
                    category="buzz"
                )

                cards.append(card)

            return cards

        except Exception as exc:
            logger.warning("GNews fetch failed: %s", exc)
            return []
