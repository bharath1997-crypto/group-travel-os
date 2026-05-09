import httpx
import logging
from datetime import datetime, timezone
from typing import Any, List, Optional

from app.core.api_limits import API_TIMEOUT_SECONDS
from app.schemas.explorer import ExplorerCard, create_explorer_card
from config import settings

logger = logging.getLogger(__name__)


class TicketmasterProvider:
    """Provider for Ticketmaster events."""

    def __init__(self):
        self.api_key = (settings.ticketmaster_api_key or "").strip()
        self.url = "https://app.ticketmaster.com/discovery/v2/events.json"

    async def fetch_cards(
        self, lat: float, lon: float, radius: int
    ) -> List[ExplorerCard]:
        """Fetch events from Ticketmaster and normalize to ExplorerCards."""
        if not self.api_key:
            logger.warning("Ticketmaster API key not configured.")
            return []

        # Convert radius from meters to miles as Ticketmaster expects miles or km
        # in the 'unit' param we set to 'miles'.
        # 1 meter = 0.000621371 miles.
        radius_miles = int(radius * 0.000621371)
        if radius_miles < 1:
            radius_miles = 1  # Minimum 1 mile

        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        start_dt = f"{now_str}T00:00:00Z"

        params: dict[str, Any] = {
            "apikey": self.api_key,
            "size": 50,
            "startDateTime": start_dt,
            "sort": "date,asc",
            "unit": "miles",
            "latlong": f"{lat},{lon}",
            "radius": radius_miles,
        }

        try:
            # Using AsyncClient as requested for the new architecture
            async with httpx.AsyncClient(
                timeout=API_TIMEOUT_SECONDS
            ) as client:
                r = await client.get(self.url, params=params)

            if r.status_code != 200:
                logger.warning("Ticketmaster HTTP %s", r.status_code)
                return []

            data = r.json()
            emb = data.get("_embedded")
            if not isinstance(emb, dict):
                return []
            evs = emb.get("events")
            if not isinstance(evs, list):
                return []

            cards: List[ExplorerCard] = []
            for raw in evs:
                if not isinstance(raw, dict):
                    continue

                # Extract data
                eid = str(raw.get("id") or "")
                title = str(raw.get("name") or "Event")
                url = str(raw.get("url") or "")

                # Images
                img_url = ""
                images = raw.get("images")
                if isinstance(images, list) and images:
                    best: tuple[int, str] | None = None
                    for im in images:
                        if not isinstance(im, dict):
                            continue
                        w = int(im.get("width") or 0)
                        u = im.get("url")
                        if isinstance(u, str) and (best is None or w > best[0]):
                            best = (w, u)
                    if best:
                        img_url = best[1]

                # Date
                dt_raw = (
                    raw.get("dates", {}).get("start", {}).get("localDate")
                    or ""
                )
                dt_time = (
                    raw.get("dates", {}).get("start", {}).get("localTime")
                    or ""
                )
                datetime_str = f"{dt_raw}T{dt_time}" if dt_time else dt_raw

                # Venue
                venue_name = ""
                ven_emb = raw.get("_embedded", {}).get("venues", [])
                if ven_emb and isinstance(ven_emb[0], dict):
                    venue_name = str(ven_emb[0].get("name") or "")

                # City/State/Country
                city_name = ""
                state_code = ""
                country_code = ""
                if ven_emb and isinstance(ven_emb[0], dict):
                    city_name = (
                        ven_emb[0].get("city", {}).get("name") or ""
                    )
                    state_code = (
                        ven_emb[0].get("state", {}).get("stateCode") or ""
                    )
                    country_code = (
                        ven_emb[0].get("country", {}).get("countryCode")
                        or ""
                    )

                # Create card with automatic fingerprinting
                card = create_explorer_card(
                    source="ticketmaster",
                    title=title,
                    item_type="event",
                    venue_name=venue_name,
                    city_name=city_name,
                    id=eid,
                    datetime=datetime_str,
                    images=[img_url] if img_url else [],
                    links={"tickets": url},
                    state=state_code,
                    country_code=country_code,
                )

                # Extract category from classifications
                classifications = raw.get("classifications")
                if isinstance(classifications, list) and classifications:
                    segment = classifications[0].get("segment", {})
                    if isinstance(segment, dict):
                        cat_name = segment.get("name")
                        if cat_name:
                            card.category = cat_name.lower()

                cards.append(card)

            return cards

        except Exception as exc:
            logger.warning("Ticketmaster fetch failed: %s", exc)
            return []
