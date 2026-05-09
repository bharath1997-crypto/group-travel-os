"""
app/services/imported_short_service.py — Service for managing imported shorts/reels.
"""
from __future__ import annotations

import logging
import re
from sqlalchemy.orm import Session

from app.models.imported_short import ImportedShort

logger = logging.getLogger(__name__)


def extract_youtube_id(url: str) -> str | None:
    """
    Extracts YouTube video ID from various YouTube URL formats.
    """
    # Match shorts/VIDEO_ID
    match = re.search(r"shorts/([a-zA-Z0-9_-]{11})", url)
    if match:
        return match.group(1)
    # Match watch?v=VIDEO_ID
    match = re.search(r"v=([a-zA-Z0-9_-]{11})", url)
    if match:
        return match.group(1)
    # Match youtu.be/VIDEO_ID
    match = re.search(r"youtu\.be/([a-zA-Z0-9_-]{11})", url)
    if match:
        return match.group(1)
    return None


def create_imported_short(
    db: Session,
    city: str,
    url: str,
    external_id: str | None = None,
    title: str | None = None,
    thumbnail_url: str | None = None,
    hashtags: list[str] | None = None,
    source: str = "youtube",
) -> ImportedShort:
    """
    Creates a new imported short record in the database.
    """
    if not external_id:
        external_id = extract_youtube_id(url)
        if not external_id:
            raise ValueError("Could not extract YouTube ID from URL")

    try:
        short = ImportedShort(
            city=city,
            source=source,
            external_id=external_id,
            url=url,
            title=title,
            thumbnail_url=thumbnail_url,
            hashtags=hashtags,
        )
        db.add(short)
        db.commit()
        db.refresh(short)
        logger.info(f"Created imported short {short.id} for city {city}")
        return short
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create imported short: {e}")
        raise e

