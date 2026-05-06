"""
app/routes/explore.py — Endpoints for generic explore content (News, Shorts)
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, Query, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.services.explore_content_service import get_cached_explore_content
from app.utils.auth import get_current_user
from app.utils.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/explore")

@router.get("/debug-shorts", status_code=status.HTTP_200_OK)
def debug_shorts(city: str = "Chicago"):
    from app.services.external.youtube_provider import YouTubeProvider
    import traceback
    try:
        yt = YouTubeProvider()
        shorts = yt.fetch_shorts(city)
        return {"shorts": shorts}
    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}

@router.get("", status_code=status.HTTP_200_OK)
def get_explore_content(
    background_tasks: BackgroundTasks,
    city: str = Query("Chicago", max_length=120),
    db: Session = Depends(get_db),
    # Optional auth if you want to restrict it, using Depends(get_current_user)
) -> dict[str, Any]:
    """
    Concurrently fetches YouTube Shorts and DataForSEO News for a given city.
    Caches results in PostgreSQL with a 3-hour TTL.
    """
    content = get_cached_explore_content(db, background_tasks, city.strip())
    
    return {
        "city": city,
        "news": content["news"],
        "shorts": content["shorts"],
    }
