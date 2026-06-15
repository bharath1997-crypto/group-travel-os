import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.models.explorer_cache import ExplorerCache
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

DEFAULT_CACHE_TTL_SECONDS = 3 * 3600


class ExplorerService:
    """Orchestrates the Explorer feed flow:
    Template -> Providers -> Normalization -> Deduplication -> AI Ranking -> Cache.
    """

    def __init__(self):
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
        if 24.3963 <= lat <= 49.3844 and -125.0 <= lon <= -66.9346:
            return "US"
        if 49.8824 <= lat <= 60.8622 and -8.6497 <= lon <= 1.7629:
            return "GB"
        if 41.3388 <= lat <= 51.0891 and -5.1412 <= lon <= 9.5601:
            return "FR"
        if 47.2701 <= lat <= 55.0581 and 5.8663 <= lon <= 15.0419:
            return "DE"
        if 35.1706 <= lat <= 43.7914 and -9.3015 <= lon <= 3.3222:
            return "ES"
        if 35.4929 <= lat <= 47.0921 and 6.6266 <= lon <= 18.5204:
            return "IT"

        import httpx
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(
                    "https://nominatim.openstreetmap.org/reverse",
                    params={"lat": lat, "lon": lon, "format": "json"},
                    headers={"User-Agent": "Rovvy/1.0"},
                )
                if r.status_code == 200:
                    data = r.json()
                    address = data.get("address", {})
                    cc = address.get("country_code", "")
                    if cc:
                        return cc.upper()
        except Exception as e:
            logger.warning(f"Reverse geocode for country resolution failed: {e}")

        return "US"

    def _build_cache_key(self, lat: float, lon: float, radius: int) -> str:
        return f"feed:{round(lat, 2)},{round(lon, 2)}:{radius}"

    def _build_bbox(self, lat: float, lon: float, radius: int) -> dict[str, float]:
        # Approximate bounding box from center point and radius in meters
        lat_delta = radius / 111_000
        lon_delta = radius / (111_000 * max(abs(lat), 1.0) / 90.0)
        return {
            "min_lat": lat - lat_delta,
            "max_lat": lat + lat_delta,
            "min_lon": lon - lon_delta,
            "max_lon": lon + lon_delta,
        }

    def get_cache(self, db: Session, cache_key: str) -> list | None:
        """Return cached result_ids when cache_key exists and has not expired."""
        row = (
            db.query(ExplorerCache)
            .filter(ExplorerCache.cache_key == cache_key)
            .first()
        )
        if row:
            expires = row.expires_at
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            if expires > datetime.now(timezone.utc):
                return row.result_ids
        return None

    def set_cache(
        self,
        db: Session,
        cache_key: str,
        bbox: dict,
        result_ids: list,
        ttl_seconds: int,
    ) -> None:
        """Upsert cache entry with TTL."""
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(seconds=ttl_seconds)
        row = (
            db.query(ExplorerCache)
            .filter(ExplorerCache.cache_key == cache_key)
            .first()
        )
        if row:
            row.bbox = bbox
            row.result_ids = result_ids
            row.fetched_at = now
            row.expires_at = expires_at
        else:
            row = ExplorerCache(
                cache_key=cache_key,
                bbox=bbox,
                result_ids=result_ids,
                fetched_at=now,
                expires_at=expires_at,
            )
            db.add(row)
        db.commit()

    def invalidate_expired(self, db: Session) -> int:
        """Delete all cache rows past their expiry."""
        deleted = (
            db.query(ExplorerCache)
            .filter(ExplorerCache.expires_at < datetime.now(timezone.utc))
            .delete(synchronize_session=False)
        )
        db.commit()
        return deleted

    async def get_feed(
        self, lat: float, lon: float, radius: int, db: Session
    ) -> List[Dict[str, Any]]:
        """Get the live destination feed for a location."""
        country_code = await self._resolve_country_code(lat, lon)
        template = country_template_service.get_template(country_code)

        cache_key = self._build_cache_key(lat, lon, radius)
        bbox = self._build_bbox(lat, lon, radius)

        cached_feed = self.get_cache(db, cache_key)
        if cached_feed is not None:
            logger.info("Explorer cache hit for full feed.")
            return cached_feed

        logger.info("Explorer cache miss. Fetching from providers.")

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

        deduped_cards = deduplicator.deduplicate(all_cards)

        weather_desc = "clear"
        for card in all_cards:
            if card.type == "weather" and isinstance(card.metadata, dict):
                weather_desc = str(card.metadata.get("description", "clear"))
                break

        context = {"time": "evening", "group_size": 4, "weather": weather_desc}
        ranked_cards = await self._rank_cards(deduped_cards, context)

        response_data = [card.model_dump() for card in ranked_cards]

        ttl_seconds = int(
            template.get("modules", [{}])[0].get(
                "cache_ttl_hours", DEFAULT_CACHE_TTL_SECONDS / 3600
            ) * 3600
        )
        self.set_cache(db, cache_key, bbox, response_data, ttl_seconds)

        return response_data

    async def _rank_cards(
        self, cards: List[ExplorerCard], context: Dict[str, Any]
    ) -> List[ExplorerCard]:
        """Rank cards using Gemini Flash."""
        return await gemini_ranker.rank_cards(cards, context)


explorer_service = ExplorerService()
