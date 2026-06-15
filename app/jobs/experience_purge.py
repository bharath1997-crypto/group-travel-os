"""
app/jobs/experience_purge.py — TTL purge job for unified_experiences table
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models.unified_experience import UnifiedExperience
from app.services.scraper_framework import ScraperFramework
from app.utils.database import SessionLocal

logger = logging.getLogger(__name__)


def purge_expired_experiences(db: Session) -> int:
    """
    Deletes experiences where start_datetime is older than 2 days (now - 2 days).
    Logs the count of deleted rows to scraper_health and app logger.
    """
    logger.info("Starting TTL purge job for unified_experiences table...")
    # Calculate cutoff datetime: now() - 2 days (UTC)
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=2)

    stmt = delete(UnifiedExperience).where(UnifiedExperience.start_datetime < cutoff)
    result = db.execute(stmt)
    deleted_count = result.rowcount

    # Log count of deleted rows to scraper_health
    ScraperFramework.record_success(db, "purge", deleted_count)

    logger.info(
        "TTL purge job complete! Deleted %d expired experiences with start_datetime < %s",
        deleted_count,
        cutoff.isoformat(),
    )
    return deleted_count


def run_experience_purge() -> int:
    """
    Wrapper for scheduler execution that manages the DB session lifecycle.
    """
    db = SessionLocal()
    try:
        deleted = purge_expired_experiences(db)
        db.commit()
        return deleted
    except Exception as e:
        db.rollback()
        logger.exception("Error during expired experiences purge job: %s", e)
        try:
            ScraperFramework.record_failure(db, "purge", str(e))
            db.commit()
        except Exception as health_err:
            logger.error("Failed to record purge job failure to scraper_health: %s", health_err)
        raise
    finally:
        db.close()
