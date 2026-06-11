"""Sync SeatGeek scraped events into unified_experiences + event_providers."""
from __future__ import annotations

import asyncio
import logging

from app.services.event_dedup_service import EventDedupService
from app.services.providers.seatgeek_scraper import scrape_seatgeek_events
from app.services.scraper_framework import ScraperFramework
from app.utils.database import SessionLocal

logger = logging.getLogger(__name__)

SEATGEEK_CITIES = [
    {"city": "New York", "slug": "cities/new-york"},
    {"city": "Los Angeles", "slug": "cities/los-angeles"},
    {"city": "Chicago", "slug": "cities/chicago"},
    {"city": "Las Vegas", "slug": "cities/las-vegas"},
    {"city": "Miami", "slug": "cities/miami"},
    {"city": "San Francisco", "slug": "cities/san-francisco"},
    {"city": "New Orleans", "slug": "cities/new-orleans"},
    {"city": "Washington", "slug": "cities/washington"},
    {"city": "Boston", "slug": "cities/boston"},
    {"city": "Seattle", "slug": "cities/seattle"},
    {"city": "Nashville", "slug": "cities/nashville"},
    {"city": "Orlando", "slug": "cities/orlando"},
    {"city": "San Diego", "slug": "cities/san-diego"},
    {"city": "Denver", "slug": "cities/denver"},
    {"city": "Austin", "slug": "cities/austin"},
]


async def run_seatgeek_sync() -> dict:
    db = SessionLocal()
    inserted = 0
    updated = 0
    errors = 0

    try:
        if not ScraperFramework.is_provider_available(db, "seatgeek"):
            return {"error": "seatgeek blocked or disabled"}

        for city_data in SEATGEEK_CITIES:
            try:
                events = await scrape_seatgeek_events(
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
                        provider="seatgeek",
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
                    "SeatGeek sync error %s: %s",
                    city_data["city"],
                    exc,
                )
                continue

        return {
            "cities_processed": len(SEATGEEK_CITIES),
            "inserted": inserted,
            "updated": updated,
            "errors": errors,
        }
    finally:
        db.close()


def run_seatgeek_sync_sync() -> dict:
    return asyncio.run(run_seatgeek_sync())
