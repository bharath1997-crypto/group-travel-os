"""Sync Viator experiences into unified_events + event_providers."""
from __future__ import annotations

import asyncio
import logging

from app.services.event_dedup_service import EventDedupService
from app.services.providers.viator_provider import search_viator_experiences
from app.utils.database import SessionLocal
from config import settings

logger = logging.getLogger(__name__)

VIATOR_CITIES = [
    {"city": "New York", "lat": 40.7128, "lng": -74.0060},
    {"city": "Los Angeles", "lat": 34.0522, "lng": -118.2437},
    {"city": "Chicago", "lat": 41.8781, "lng": -87.6298},
    {"city": "Las Vegas", "lat": 36.1699, "lng": -115.1398},
    {"city": "Miami", "lat": 25.7617, "lng": -80.1918},
    {"city": "San Francisco", "lat": 37.7749, "lng": -122.4194},
    {"city": "New Orleans", "lat": 29.9511, "lng": -90.0715},
    {"city": "Washington DC", "lat": 38.9072, "lng": -77.0369},
    {"city": "Boston", "lat": 42.3601, "lng": -71.0589},
    {"city": "Seattle", "lat": 47.6062, "lng": -122.3321},
    {"city": "Nashville", "lat": 36.1627, "lng": -86.7816},
    {"city": "Orlando", "lat": 28.5383, "lng": -81.3792},
    {"city": "San Diego", "lat": 32.7157, "lng": -117.1611},
    {"city": "Denver", "lat": 39.7392, "lng": -104.9903},
    {"city": "Austin", "lat": 30.2672, "lng": -97.7431},
]


async def run_viator_sync() -> dict:
    if not settings.viator_api_key:
        return {"error": "No Viator API key"}

    db = SessionLocal()
    inserted = 0
    updated = 0
    errors = 0

    try:
        for city_data in VIATOR_CITIES:
            try:
                experiences = await search_viator_experiences(
                    location=city_data["city"],
                    lat=city_data["lat"],
                    lng=city_data["lng"],
                    limit=20,
                )

                for exp in experiences:
                    event, created = EventDedupService.find_or_create_event(
                        db=db,
                        title=exp["title"],
                        city=city_data["city"],
                        country_code="US",
                        start_datetime=None,
                        lat=exp["lat"],
                        lng=exp["lng"],
                        category="activity",
                        image_url=exp["image_url"],
                        description=exp["description"],
                        min_price=exp["price_from"],
                        currency=exp["currency"],
                    )

                    EventDedupService.add_or_update_provider(
                        db=db,
                        event_id=event.id,
                        provider="viator",
                        provider_event_id=exp["product_code"],
                        provider_url=exp["booking_url"],
                        affiliate_url=exp["booking_url"],
                        min_price=exp["price_from"],
                        currency=exp["currency"],
                        availability="available",
                        price_label=f"From ${exp['price_from']:.0f}",
                    )

                    if created:
                        inserted += 1
                    else:
                        updated += 1

                db.commit()
                await asyncio.sleep(1)

            except Exception as e:
                errors += 1
                db.rollback()
                logger.error(
                    "Viator sync error %s: %s",
                    city_data["city"],
                    e,
                )
                continue

        return {
            "cities_processed": len(VIATOR_CITIES),
            "inserted": inserted,
            "updated": updated,
            "errors": errors,
        }
    finally:
        db.close()


def run_viator_sync_sync() -> dict:
    return asyncio.run(run_viator_sync())
