import httpx
import logging
from typing import Any, List, Optional

from app.core.api_limits import API_TIMEOUT_SECONDS
from app.schemas.explorer import ExplorerCard, create_explorer_card
from config import settings

logger = logging.getLogger(__name__)


class FoursquareProvider:
    """Provider for Foursquare Places."""

    def __init__(self):
        self.api_key = (settings.foursquare_api_key or "").strip()
        self.url = "https://api.foursquare.com/v3/places/search"

    async def fetch_cards(
        self, lat: float, lon: float, radius: int
    ) -> List[ExplorerCard]:
        """Fetch places from Foursquare and normalize to ExplorerCards."""
        if not self.api_key:
            logger.warning("Foursquare API key not configured.")
            return []

        # Foursquare supports 'll' (lat,lon) and 'radius' in meters
        params: dict[str, Any] = {
            "ll": f"{lat},{lon}",
            "radius": radius,
            "limit": 20,
            # Categories: Food (13000), Arts & Entertainment (10000), Nightlife (13032)
            "categories": "13000,10000,13032",
        }

        headers = {
            "Authorization": self.api_key, 
            "Accept": "application/json"
        }

        try:
            async with httpx.AsyncClient(
                timeout=API_TIMEOUT_SECONDS
            ) as client:
                r = await client.get(self.url, params=params, headers=headers)

            if r.status_code != 200:
                logger.warning("Foursquare HTTP %s: %s", r.status_code, r.text[:200])
                return []

            payload = r.json()
            results = payload.get("results")
            if not isinstance(results, list):
                return []

            cards: List[ExplorerCard] = []
            for p in results:
                if not isinstance(p, dict):
                    continue

                pid = str(p.get("fsq_id") or "")
                title = str(p.get("name") or "Place")
                venue_name = title

                # Address & Location
                address = ""
                city_name = ""
                state_code = ""
                country_code = ""
                
                loc = p.get("location")
                if isinstance(loc, dict):
                    address = str(
                        loc.get("formatted_address")
                        or loc.get("address")
                        or ""
                    )
                    city_name = str(loc.get("city") or "")
                    state_code = str(loc.get("state") or "")
                    country_code = str(loc.get("country") or "")

                # Category
                cat_label = "place"
                cats = p.get("categories")
                if isinstance(cats, list) and cats and isinstance(cats[0], dict):
                    cat_label = str(cats[0].get("name") or "place").lower()

                # Coordinates
                p_lat = None
                p_lon = None
                geo = p.get("geocodes")
                if isinstance(geo, dict):
                    main = geo.get("main")
                    if isinstance(main, dict):
                        p_lat = main.get("latitude")
                        p_lon = main.get("longitude")

                # Create card with automatic fingerprinting
                card = create_explorer_card(
                    source="foursquare",
                    title=title,
                    item_type="place",
                    venue_name=venue_name,
                    city_name=city_name,
                    id=pid,
                    location={"name": venue_name, "lat": p_lat, "lon": p_lon},
                    metadata={"address": address},
                    state=state_code,
                    country_code=country_code,
                    category=cat_label,
                )

                cards.append(card)

            return cards

        except Exception as exc:
            logger.warning("Foursquare fetch failed: %s", exc)
            return []
