"""
app/services/explore_content_service.py — Caching logic for News and Shorts.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import BackgroundTasks
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.explore_content import ExploreContent
from app.services.external.dataforseo_provider import DataForSEOProvider
from app.services.external.youtube_provider import YouTubeProvider

logger = logging.getLogger(__name__)

CACHE_TTL_HOURS = 3


def _refresh_cache_for_content_task(db: Session, city: str):
    """
    Background task to concurrently fetch News and Shorts and upsert into the DB.
    """
    try:
        logger.info(f"Starting background refresh of Explore content for {city}")
        
        # Concurrently fetching using simple thread-based or sequential fetch (since requests is sync)
        # We can just fetch sequentially if we don't want to use thread pool, but let's do sequential for simplicity and safety within db sessions.
        dataforseo = DataForSEOProvider()
        youtube = YouTubeProvider()
        
        raw_news = dataforseo.fetch_news(city=city)
        raw_shorts = youtube.fetch_shorts(city=city)
        
        now = datetime.now(timezone.utc)
        
        # Upsert News
        stmt_news = select(ExploreContent).where(
            ExploreContent.city.ilike(city),
            ExploreContent.content_type == "news"
        )
        existing_news = db.scalars(stmt_news).first()
        if existing_news:
            existing_news.data = raw_news
            existing_news.fetched_at = now
        else:
            new_news = ExploreContent(city=city, content_type="news", data=raw_news, fetched_at=now)
            db.add(new_news)
            
        # Upsert Shorts
        stmt_shorts = select(ExploreContent).where(
            ExploreContent.city.ilike(city),
            ExploreContent.content_type == "shorts"
        )
        existing_shorts = db.scalars(stmt_shorts).first()
        if existing_shorts:
            existing_shorts.data = raw_shorts
            existing_shorts.fetched_at = now
        else:
            new_shorts = ExploreContent(city=city, content_type="shorts", data=raw_shorts, fetched_at=now)
            db.add(new_shorts)
            
        db.commit()
        logger.info(f"Successfully refreshed explore content for {city}")
    except Exception as exc:
        logger.error(f"Failed to refresh explore content for {city}: {exc}")
        db.rollback()


def get_cached_explore_content(db: Session, background_tasks: BackgroundTasks, city: str) -> dict[str, list]:
    """
    Returns News and Shorts from the DB cache. 
    Triggers a background refresh if the cache is stale or empty.
    """
    stmt = select(ExploreContent).where(ExploreContent.city.ilike(city))
    contents = list(db.scalars(stmt).all())
    
    needs_refresh = False
    now = datetime.now(timezone.utc)
    
    news_data = []
    shorts_data = []
    
    if not contents:
        needs_refresh = True
    else:
        # Check staleness based on the most recently fetched content
        latest_fetch = max(c.fetched_at for c in contents)
        if latest_fetch.tzinfo is None:
            latest_fetch = latest_fetch.replace(tzinfo=timezone.utc)
            
        if now - latest_fetch > timedelta(hours=CACHE_TTL_HOURS):
            needs_refresh = True
            
        for c in contents:
            if c.content_type == "news":
                news_data = c.data
            elif c.content_type == "shorts":
                shorts_data = c.data
                
    if needs_refresh:
        if not contents:
            logger.info(f"Explore content cache miss for {city}. Fetching synchronously.")
            _refresh_cache_for_content_task(db, city)
            # Re-query
            contents = list(db.scalars(stmt).all())
            for c in contents:
                if c.content_type == "news":
                    news_data = c.data
                elif c.content_type == "shorts":
                    shorts_data = c.data
        else:
            logger.info(f"Explore content cache stale for {city}. Triggering background fetch.")
            background_tasks.add_task(_refresh_cache_for_content_task, db, city)
            
    return {
        "news": news_data,
        "shorts": shorts_data,
    }
