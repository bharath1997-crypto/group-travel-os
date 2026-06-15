"""Sync Eventbrite scraped events into unified_experiences + event_providers."""
from __future__ import annotations

import asyncio
import logging

from app.services.event_dedup_service import EventDedupService
from app.services.providers.eventbrite_scraper import scrape_eventbrite_events
from app.services.scraper_framework import ScraperFramework
from app.utils.database import SessionLocal

logger = logging.getLogger(__name__)

EVENTBRITE_CITIES = [
    {"city": "New York", "slug": "new-york--ny"},
    {"city": "Los Angeles", "slug": "los-angeles--ca"},
    {"city": "Chicago", "slug": "chicago--il"},
    {"city": "Las Vegas", "slug": "las-vegas--nv"},
    {"city": "Miami", "slug": "miami--fl"},
    {"city": "San Francisco", "slug": "san-francisco--ca"},
    {"city": "New Orleans", "slug": "new-orleans--la"},
    {"city": "Washington", "slug": "washington--dc"},
    {"city": "Boston", "slug": "boston--ma"},
    {"city": "Seattle", "slug": "seattle--wa"},
    {"city": "Nashville", "slug": "nashville--tn"},
    {"city": "Orlando", "slug": "orlando--fl"},
    {"city": "San Diego", "slug": "san-diego--ca"},
    {"city": "Denver", "slug": "denver--co"},
    {"city": "Austin", "slug": "austin--tx"},
]


async def run_eventbrite_sync() -> dict:
    db = SessionLocal()
    inserted = 0
    updated = 0
    errors = 0

    try:
        if not ScraperFramework.is_provider_available(db, "eventbrite"):
            return {"error": "eventbrite blocked or disabled"}

        for city_data in EVENTBRITE_CITIES:
            try:
                events = await scrape_eventbrite_events(
                    city=city_data["city"],
                    city_slug=city_data["slug"],
                    limit=50,
                )

                for ev in events:
                    venue_city = ev.get("venue_city") or city_data["city"]
                    price_min = ev.get("price_min")
                    price_max = ev.get("price_max")

                    event, created = EventDedupService.find_or_create_event(
                        db=db,
                        title=ev["title"],
                        city=venue_city,
                        country_code="US",
                        start_datetime=ev.get("start_datetime"),
                        venue_name=ev.get("venue_name"),
                        category=ev.get("category") or "event",
                        image_url=ev.get("image_url"),
                        min_price=price_min,
                        max_price=price_max,
                        currency=ev.get("currency") or "USD",
                        is_free=price_min == 0 if price_min is not None else False,
                    )

                    price_label = None
                    if price_min is not None and price_max is not None:
                        if price_min == price_max:
                            price_label = f"${price_min:.0f}"
                        else:
                            price_label = f"${price_min:.0f} – ${price_max:.0f}"
                    elif price_min is not None:
                        price_label = f"From ${price_min:.0f}"

                    EventDedupService.add_or_update_provider(
                        db=db,
                        event_id=event.id,
                        provider="eventbrite",
                        provider_event_id=ev["provider_event_id"],
                        provider_url=ev["url"],
                        min_price=price_min,
                        max_price=price_max,
                        currency=ev.get("currency") or "USD",
                        availability="available",
                        price_label=price_label,
                    )

                    if created:
                        inserted += 1
                    else:
                        updated += 1

                db.commit()
                await asyncio.sleep(2)

            except Exception as exc:
                errors += 1
                db.rollback()
                logger.error(
                    "Eventbrite sync error %s: %s",
                    city_data["city"],
                    exc,
                )
                continue

        return {
            "cities_processed": len(EVENTBRITE_CITIES),
            "inserted": inserted,
            "updated": updated,
            "errors": errors,
        }
    finally:
        db.close()


def run_eventbrite_sync_sync() -> dict:
    return asyncio.run(run_eventbrite_sync())
