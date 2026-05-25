import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.models.explorer_cache import (
    ExplorerCache,
    get_geo_bucket,
    get_radius_bucket,
)
from app.schemas.explorer import ExplorerCard
from app.services.explorer.country_template_service import (
    country_template_service,
)
from app.services.explorer.deduplicator import deduplicator
from app.services.explorer.providers.foursquare_provider import (
    FoursquareProvider,
)
from app.services.explorer.providers.geoapify_provider import GeoapifyProvider
from app.services.explorer.providers.ticketmaster_provider import (
    TicketmasterProvider,
)
from app.services.explorer.providers.unipride_provider import UniprideProvider
from app.services.explorer.providers.gnews_provider import GNewsProvider
from app.services.explorer.providers.audio_provider import AudioProvider
from app.services.explorer.providers.weather_provider import WeatherProvider
from app.services.explorer.ai_ranker import gemini_ranker

logger = logging.getLogger(__name__)


class ExplorerService:
    """Orchestrates the Explorer feed flow: 
    Template -> Providers -> Normalization -> Deduplication -> AI Ranking -> Cache.
    """

    def __init__(self):
        # Initialize providers
        self.providers = {
            "ticketmaster": TicketmasterProvider(),
            "unipride": UniprideProvider(),
            "geoapify": GeoapifyProvider(),
            "foursquare": FoursquareProvider(),
            "gnews": GNewsProvider(),
            "radio_browser": AudioProvider(),
            "open_meteo": WeatherProvider(),
        }

    async def _resolve_country_code(self, lat: float, lon: float) -> str:
        """Resolve country code dynamically using fast boundary box checks or OpenStreetMap reverse geocoding."""
        # A. Fast bounding box check to avoid network requests for common regions
        # US
        if 24.3963 <= lat <= 49.3844 and -125.0 <= lon <= -66.9346:
            return "US"
        # UK (GB)
        if 49.8824 <= lat <= 60.8622 and -8.6497 <= lon <= 1.7629:
            return "GB"
        # France (FR)
        if 41.3388 <= lat <= 51.0891 and -5.1412 <= lon <= 9.5601:
            return "FR"
        # Germany (DE)
        if 47.2701 <= lat <= 55.0581 and 5.8663 <= lon <= 15.0419:
            return "DE"
        # Spain (ES)
        if 35.1706 <= lat <= 43.7914 and -9.3015 <= lon <= 3.3222:
            return "ES"
        # Italy (IT)
        if 35.4929 <= lat <= 47.0921 and 6.6266 <= lon <= 18.5204:
            return "IT"

        # B. Fallback to reverse geocoding (OpenStreetMap Nominatim API)
        import httpx
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(
                    "https://nominatim.openstreetmap.org/reverse",
                    params={"lat": lat, "lon": lon, "format": "json"},
                    headers={"User-Agent": "Rovvy/1.0"}
                )
                if r.status_code == 200:
                    data = r.json()
                    address = data.get("address", {})
                    cc = address.get("country_code", "")
                    if cc:
                        return cc.upper()
        except Exception as e:
            logger.warning(f"Reverse geocode for country resolution failed: {e}")

        # Default fallback
        return "US"

    async def get_feed(
        self, lat: float, lon: float, radius: int, db: Session
    ) -> List[Dict[str, Any]]:
        """Get the live destination feed for a location."""
        # 1. Resolve country dynamically (Supports US and European countries)
        country_code = await self._resolve_country_code(lat, lon)

        # 2. Get template
        template = country_template_service.get_template(country_code)
        
        # 3. Compute buckets to prevent fragmentation
        radius_bucket = get_radius_bucket(radius)
        geo_bucket = get_geo_bucket(lat, lon)
        
        # For MVP, we use a static slug if we haven't implemented city resolution yet
        city_slug = "gps_location" 

        # 4. Check Cache for the entire feed to avoid any API/AI calls on hit
        cache_key_module = "full_feed"
        cached_feed = self._get_from_cache(
            db, country_code, city_slug, cache_key_module, radius_bucket, geo_bucket
        )
        if cached_feed:
            logger.info("Explorer cache hit for full feed.")
            return cached_feed

        logger.info("Explorer cache miss. Fetching from providers.")

        # 5. Fetch from providers concurrently
        tasks = []
        for module in template.get("modules", []):
            for provider_name in module["providers"]:
                provider = self.providers.get(provider_name)
                if provider:
                    tasks.append(provider.fetch_cards(lat, lon, radius))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        all_cards: List[ExplorerCard] = []
        for res in results:
            if isinstance(res, list):
                all_cards.extend(res)
            elif isinstance(res, Exception):
                logger.error(f"Provider fetch error: {res}")

        # 6. Deduplicate
        deduped_cards = deduplicator.deduplicate(all_cards)

        # Extract weather for AI context if available
        weather_desc = "clear"
        for card in all_cards:
            if card.type == "weather" and isinstance(card.metadata, dict):
                weather_desc = str(card.metadata.get("description", "clear"))
                break

        # 7. AI Ranking
        # Pass a default context for MVP. In production, this would come from user state/weather service.
        context = {"time": "evening", "group_size": 4, "weather": weather_desc}
        ranked_cards = await self._rank_cards(deduped_cards, context)

        # Convert to dicts for storage and response
        response_data = [card.model_dump() for card in ranked_cards]

        # 8. Save to Cache
        self._save_to_cache(
            db,
            country_code,
            city_slug,
            cache_key_module,
            radius_bucket,
            geo_bucket,
            response_data,
        )

        return response_data

    async def _rank_cards(self, cards: List[ExplorerCard], context: Dict[str, Any]) -> List[ExplorerCard]:
        """Rank cards using Gemini Flash."""
        return await gemini_ranker.rank_cards(cards, context)

    def _get_from_cache(
        self,
        db: Session,
        country_code: str,
        city_slug: str,
        module: str,
        radius_bucket: str,
        geo_bucket: str,
        ttl_hours: float = 3.0
    ) -> List[Dict[str, Any]] | None:
        """Helper to get data from ExplorerCache."""
        row = (
            db.query(ExplorerCache)
            .filter(
                ExplorerCache.country_code == country_code,
                ExplorerCache.city_slug == city_slug,
                ExplorerCache.module == module,
                ExplorerCache.radius_bucket == radius_bucket,
                ExplorerCache.geo_bucket == geo_bucket,
            )
            .first()
        )

        if row:
            # Check TTL
            if (datetime.now(timezone.utc) - row.fetched_at) < timedelta(hours=ttl_hours):
                return row.data
        return None

    def _save_to_cache(
        self,
        db: Session,
        country_code: str,
        city_slug: str,
        module: str,
        radius_bucket: str,
        geo_bucket: str,
        data: List[Dict[str, Any]],
    ):
        """Helper to save data to ExplorerCache."""
        row = (
            db.query(ExplorerCache)
            .filter(
                ExplorerCache.country_code == country_code,
                ExplorerCache.city_slug == city_slug,
                ExplorerCache.module == module,
                ExplorerCache.radius_bucket == radius_bucket,
                ExplorerCache.geo_bucket == geo_bucket,
            )
            .first()
        )

        if row:
            row.data = data
            row.fetched_at = datetime.now(timezone.utc)
        else:
            row = ExplorerCache(
                country_code=country_code,
                city_slug=city_slug,
                module=module,
                radius_bucket=radius_bucket,
                geo_bucket=geo_bucket,
                data=data,
                fetched_at=datetime.now(timezone.utc),
            )
            db.add(row)
        db.commit()


# Singleton instance
explorer_service = ExplorerService()
