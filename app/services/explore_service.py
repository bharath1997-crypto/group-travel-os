"""
app/services/explore_service.py — Core logic for reading from cache and refreshing.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import BackgroundTasks
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.explore_event import ExploreEvent
from app.services.explore_event_normalizer import normalize_dataforseo_event
from app.services.external.dataforseo_provider import DataForSEOProvider

logger = logging.getLogger(__name__)

CACHE_TTL_HOURS = 4


def _refresh_cache_for_city_task(db: Session, city: str, category: str):
    """
    Background task to fetch events and upsert into the database.
    """
    try:
        logger.info(f"Starting background refresh for {city} (category: {category})")
        provider = DataForSEOProvider()
        raw_events = provider.fetch_events(city=city, category=category)
        
        now = datetime.now(timezone.utc)
        
        for raw in raw_events:
            if not isinstance(raw, dict):
                continue
                
            norm_data = normalize_dataforseo_event(raw, city)
            
            # Upsert logic based on external_id
            stmt = select(ExploreEvent).where(ExploreEvent.external_id == norm_data["external_id"])
            existing = db.scalars(stmt).first()
            
            if existing:
                for k, v in norm_data.items():
                    setattr(existing, k, v)
                existing.fetched_at = now
            else:
                new_event = ExploreEvent(**norm_data)
                new_event.fetched_at = now
                db.add(new_event)
                
        db.commit()
        logger.info(f"Successfully refreshed {len(raw_events)} events for {city}")
    except Exception as exc:
        logger.error(f"Failed to refresh explore cache for {city}: {exc}")
        db.rollback()


def get_cached_events(db: Session, background_tasks: BackgroundTasks, city: str, category: str) -> list[ExploreEvent]:
    """
    Returns events from the DB cache. 
    Triggers a background refresh if the cache is stale or empty.
    """
    stmt = select(ExploreEvent).where(ExploreEvent.city.ilike(city))
    # Only filter by category if a specific one is requested
    if category and category.lower() != "events":
        stmt = stmt.where(ExploreEvent.category.ilike(category))
        
    events = list(db.scalars(stmt).all())
    
    needs_refresh = False
    now = datetime.now(timezone.utc)
    
    if not events:
        needs_refresh = True
    else:
        # Check staleness based on the most recently fetched event
        latest_fetch = max(e.fetched_at for e in events)
        # Ensure latest_fetch is timezone aware for comparison
        if latest_fetch.tzinfo is None:
            latest_fetch = latest_fetch.replace(tzinfo=timezone.utc)
            
        if now - latest_fetch > timedelta(hours=CACHE_TTL_HOURS):
            needs_refresh = True
            
    if needs_refresh:
        if not events:
            logger.info(f"Cache miss for {city}. Fetching synchronously.")
            _refresh_cache_for_city_task(db, city, category)
            # Re-query after synchronous fetch
            events = list(db.scalars(stmt).all())
        else:
            logger.info(f"Cache stale for {city}. Triggering background fetch.")
            background_tasks.add_task(_refresh_cache_for_city_task, db, city, category)
            
    return events
