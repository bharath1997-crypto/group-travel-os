import os
import httpx
import logging
from typing import List

from app.core.api_limits import API_TIMEOUT_SECONDS
from app.schemas.explorer import ExplorerCard, create_explorer_card

logger = logging.getLogger(__name__)


class GeoapifyProvider:
    """Provider for Geoapify Places discovery."""

    def __init__(self):
        from config import settings

        self.api_key = (
            (settings.geoapify_api_key or os.environ.get("GEOAPIFY_API_KEY", "")).strip()
        )
        self.url = "https://api.geoapify.com/v2/places"

    async def fetch_cards(
        self, lat: float, lon: float, radius: int
    ) -> List[ExplorerCard]:
        """Fetch places from Geoapify and normalize to ExplorerCards."""
        if not self.api_key:
            logger.warning("GEOAPIFY_API_KEY not found in environment.")
            return []

        # Geoapify categories: catering (food/drink), entertainment, leisure, tourism
        categories = "catering,entertainment,leisure,tourism"

        params = {
            "categories": categories,
            "filter": f"circle:{lon},{lat},{radius}",
            "bias": f"proximity:{lon},{lat}",
            "limit": 20,
            "apiKey": self.api_key,
        }

        try:
            async with httpx.AsyncClient(
                timeout=API_TIMEOUT_SECONDS
            ) as client:
                r = await client.get(self.url, params=params)

            if r.status_code != 200:
                logger.warning("Geoapify HTTP %s: %s", r.status_code, r.text[:200])
                return []

            data = r.json()
            features = data.get("features", [])
            if not isinstance(features, list):
                return []

            cards: List[ExplorerCard] = []
            for feature in features:
                if not isinstance(feature, dict):
                    continue

                props = feature.get("properties", {})
                if not isinstance(props, dict):
                    continue

                # Skip places without a name (e.g. random buildings or roads)
                title = props.get("name")
                if not title:
                    continue

                place_id = str(props.get("place_id") or "")
                venue_name = str(title)
                
                # Location
                p_lat = props.get("lat")
                p_lon = props.get("lon")
                
                # Address & Region
                address = str(props.get("formatted") or "")
                city_name = str(props.get("city") or "")
                state_code = str(props.get("state_code") or "")
                country_code = str(props.get("country_code") or "")

                # Category mapping (take the first specific category if available)
                cat_list = props.get("categories", [])
                category = "place"
                if cat_list:
                    # Filter out broad categories like 'building' if possible, or just take the first
                    category = cat_list[0]

                # Create card with automatic fingerprinting
                card = create_explorer_card(
                    source="geoapify",
                    title=str(title),
                    item_type="place",
                    venue_name=venue_name,
                    city_name=city_name,
                    id=place_id,
                    location={"name": venue_name, "lat": p_lat, "lon": p_lon},
                    metadata={"address": address},
                    state=state_code,
                    country_code=country_code,
                    category=category
                )

                cards.append(card)

            return cards

        except Exception as exc:
            logger.warning("Geoapify fetch failed: %s", exc)
            return []
