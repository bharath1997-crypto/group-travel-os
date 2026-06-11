"""Enrich unified experiences with StubHub and SeatGeek prices."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta

from sqlalchemy import and_, exists, not_, or_, select
from sqlalchemy.orm import Session

from app.models.event_provider import EventProvider
from app.models.unified_experience import UnifiedExperience
from app.services.event_dedup_service import EventDedupService
from app.services.providers.seatgeek_scraper import scrape_seatgeek_prices
from app.services.providers.stubhub_scraper import scrape_stubhub_prices
from app.services.scraper_framework import ScraperFramework
from app.utils.database import SessionLocal

logger = logging.getLogger(__name__)


def get_events_needing_prices(
    db: Session,
    limit: int = 100,
) -> list:
    """Events in the next 14 days (US) missing StubHub or SeatGeek prices."""
    cutoff = datetime.utcnow() + timedelta(days=14)

    has_stubhub = exists().where(
        and_(
            EventProvider.event_id == UnifiedExperience.id,
            EventProvider.provider == "stubhub",
        )
    )
    has_seatgeek = exists().where(
        and_(
            EventProvider.event_id == UnifiedExperience.id,
            EventProvider.provider == "seatgeek",
        )
    )

    stmt = (
        select(UnifiedExperience)
        .where(
            and_(
                UnifiedExperience.start_datetime >= datetime.utcnow(),
                UnifiedExperience.start_datetime <= cutoff,
                UnifiedExperience.status != "cancelled",
                UnifiedExperience.country_code == "US",
                or_(not_(has_stubhub), not_(has_seatgeek)),
            )
        )
        .order_by(UnifiedExperience.start_datetime.asc())
        .limit(limit)
    )

    return db.execute(stmt).scalars().all()


async def run_price_enrichment() -> dict:
    db = SessionLocal()
    stubhub_added = 0
    seatgeek_added = 0
    errors = 0

    try:
        stubhub_ok = ScraperFramework.is_provider_available(db, "stubhub")
        seatgeek_ok = ScraperFramework.is_provider_available(db, "seatgeek")

        events = get_events_needing_prices(db, limit=100)

        for event in events:
            await asyncio.sleep(2)

            if stubhub_ok:
                try:
                    if event.start_datetime is None:
                        raise ValueError("missing start_datetime")
                    result = await scrape_stubhub_prices(
                        event.title,
                        event.city or "",
                        event.start_datetime.date(),
                    )
                    if result:
                        EventDedupService.add_or_update_provider(
                            db=db,
                            event_id=event.id,
                            provider="stubhub",
                            provider_event_id=f"sh_{event.id}",
                            provider_url=result["provider_url"],
                            min_price=result["min_price"],
                            availability="available",
                        )
                        stubhub_added += 1
                        ScraperFramework.record_success(db, "stubhub", 1)
                except Exception as e:
                    ScraperFramework.record_failure(db, "stubhub", str(e))
                    errors += 1

            if seatgeek_ok:
                try:
                    if event.start_datetime is None:
                        raise ValueError("missing start_datetime")
                    result = await scrape_seatgeek_prices(
                        event.title,
                        event.city or "",
                        event.start_datetime.date(),
                    )
                    if result:
                        EventDedupService.add_or_update_provider(
                            db=db,
                            event_id=event.id,
                            provider="seatgeek",
                            provider_event_id=f"sg_{event.id}",
                            provider_url=result["provider_url"],
                            min_price=result["min_price"],
                            availability="available",
                        )
                        seatgeek_added += 1
                        ScraperFramework.record_success(db, "seatgeek", 1)
                except Exception as e:
                    ScraperFramework.record_failure(db, "seatgeek", str(e))
                    errors += 1

            db.commit()

        return {
            "events_processed": len(events),
            "stubhub_prices_added": stubhub_added,
            "seatgeek_prices_added": seatgeek_added,
            "errors": errors,
        }
    finally:
        db.close()


def run_price_enrichment_sync() -> dict:
    return asyncio.run(run_price_enrichment())
