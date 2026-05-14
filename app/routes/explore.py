"""
app/routes/explore.py — Endpoints for generic explore content (News, Shorts)
"""
from __future__ import annotations

import logging
from typing import Any, Optional
from fastapi import APIRouter, Depends, Query, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.models.explore_content import ExploreContent
from app.models.location_hashtag import LocationHashtag
from app.models.user import User
from app.utils.auth import get_current_user, get_current_user_optional
from app.utils.exceptions import AppException

from app.services.explore_content_service import get_cached_explore_content
from app.services.explore_city_extended_service import (
    get_gnews_cached,
    get_hero_photo_cached,
    get_places_cached,
    get_ticketmaster_cached,
    get_travel_tips_cached,
    get_safety_cached,
    get_currency_cached,
    get_guide_cached,
    get_weather_cached,
    get_music_cached,
    get_podcasts_cached,
    get_radio_cached,
    get_transport_cached,
    get_city_scores_cached,
    get_wiki_summary_cached,
)
from app.services.external.universal_fallback_service import get_universal_fallback
from app.utils.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/explore")


@router.get("/debug-shorts", status_code=status.HTTP_200_OK)
def debug_shorts(city: str = "Chicago", tag: str | None = None):
    from app.services.external.youtube_provider import YouTubeProvider
    import traceback
    try:
        yt = YouTubeProvider()
        shorts = yt.fetch_shorts(city, tag=tag)
        return {"shorts": shorts}
    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}

@router.get("", status_code=status.HTTP_200_OK)
def get_explore_content(
    background_tasks: BackgroundTasks,
    city: str = Query("Chicago", max_length=120),
    tag: str | None = Query(None, max_length=80),
    db: Session = Depends(get_db),
    # Optional auth if you want to restrict it, using Depends(get_current_user)
) -> dict[str, Any]:
    """
    Concurrently fetches YouTube Shorts and DataForSEO News for a given city.
    Caches results in PostgreSQL with a 3-hour TTL (shorts cache skipped when ``tag`` is set).
    """
    city_strip = city.strip()
    tag_strip = tag.strip() if tag else None
    content = get_cached_explore_content(
        db, background_tasks, city_strip, tag=tag_strip
    )

    # Fetch imported shorts from database
    from app.models.imported_short import ImportedShort
    try:
        imported = db.query(ImportedShort).filter(ImportedShort.city == city_strip).all()
        imported_list = []
        for s in imported:
            imported_list.append({
                "id": str(s.id),
                "videoId": s.external_id,
                "title": s.title,
                "channelTitle": "Rovvy Contributor",
                "thumbnailUrl": s.thumbnail_url or f"https://i.ytimg.com/vi/{s.external_id}/hqdefault.jpg",
                "statistics": {"viewCount": str(s.likes_count)},  # Use likes as a proxy or fallback
                "snippet": {
                    "title": s.title,
                    "channelTitle": "Rovvy Contributor",
                    "publishedAt": s.created_at.isoformat(),
                },
                "source": "travello",
                "is_creator": True,
            })
        
        # Merge into the response
        if isinstance(content.get("shorts"), dict):
            recent = content["shorts"].get("recent", [])
            # Add imported ones to the top of recent
            content["shorts"]["recent"] = imported_list + recent
        elif isinstance(content.get("shorts"), list):
            content["shorts"] = imported_list + content["shorts"]
            
    except Exception as e:
        logger.error(f"Failed to fetch imported shorts: {e}")

    news_payload = content.get("news")
    if not isinstance(news_payload, list) or not news_payload:
        news_payload = get_gnews_cached(db, city_strip)

    return {
        "city": city_strip,
        "tag": tag_strip,
        "news": news_payload if isinstance(news_payload, list) else [],
        "shorts": content["shorts"],
    }


@router.get("/hashtags", status_code=status.HTTP_200_OK)
def get_city_hashtags(
    city: str = Query(..., max_length=120),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    city_strip = city.strip()
    location = (
        db.query(LocationHashtag)
        .filter(LocationHashtag.city.ilike(city_strip))
        .first()
    )
    if not location:
        AppException.not_found("City not found")
    return {"city": city_strip, "hashtags": list(location.hashtags or [])}


@router.get("/hero-photo", status_code=status.HTTP_200_OK)
def explore_hero_photo(
    city: str = Query("Chicago", max_length=120),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    city_strip = city.strip()
    rows = get_hero_photo_cached(db, city_strip)
    photo = rows[0] if rows else None
    return {"city": city_strip, "photo": photo}


@router.get("/ticketmaster", status_code=status.HTTP_200_OK)
def explore_ticketmaster(
    city: str = Query("Chicago", max_length=120),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    lat: Optional[float] = Query(None),
    lon: Optional[float] = Query(None),
    radius: int = Query(50),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    city_strip = city.strip()
    events = get_ticketmaster_cached(db, city_strip, start_date, end_date, lat, lon, radius)
    return {"city": city_strip, "events": events}


@router.get("/places", status_code=status.HTTP_200_OK)
def explore_places(
    city: str = Query("Chicago", max_length=120),
    category: str = Query("attractions", max_length=40),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    city_strip = city.strip()
    cat = category.strip().lower()
    if cat not in ("attractions", "restaurants"):
        return {"city": city_strip, "category": cat, "places": []}
    places = get_places_cached(db, city_strip, cat)
    return {"city": city_strip, "category": cat, "places": places}


@router.get("/gnews", status_code=status.HTTP_200_OK)
def explore_gnews(
    city: str = Query("Chicago", max_length=120),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    city_strip = city.strip()
    articles = get_gnews_cached(db, city_strip)
    return {"city": city_strip, "articles": articles}


@router.get("/tips", status_code=status.HTTP_200_OK)
def explore_tips(
    city: str = Query("Chicago", max_length=120),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    city_strip = city.strip()
    tips = get_travel_tips_cached(db, city_strip)
    return {"city": city_strip, "tips": tips}


@router.get("/safety", status_code=status.HTTP_200_OK)
def explore_safety(
    country: str = Query(..., max_length=10),
    city: str | None = Query(None, max_length=120),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    country_strip = country.strip().upper()
    city_strip = city.strip() if city else None
    safety = get_safety_cached(db, country_strip, city_hint=city_strip)
    return {"country": country_strip, "safety": safety[0] if safety else None}


@router.get("/currency", status_code=status.HTTP_200_OK)
def explore_currency(
    country: str = Query(..., max_length=10),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    country_strip = country.strip().upper()
    currency = get_currency_cached(db, country_strip)
    return {"country": country_strip, "currency": currency[0] if currency else None}


@router.get("/travel-info", status_code=status.HTTP_200_OK)
def explore_travel_info(
    city: str = Query(..., max_length=120),
    country_code: str = Query(..., max_length=10),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
) -> dict[str, Any]:
    from app.services.travel_info_service import get_travel_info_bundle
    return get_travel_info_bundle(db, city, country_code, current_user)


@router.get("/guide", status_code=status.HTTP_200_OK)
def explore_guide(
    city: str = Query(..., max_length=120),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    city_strip = city.strip()
    guide = get_guide_cached(db, city_strip)
    return {"city": city_strip, "guide": guide[0] if guide else None}


@router.get("/weather", status_code=status.HTTP_200_OK)
def explore_weather(
    city: str = Query(..., max_length=120),
    lat: float = Query(...),
    lon: float = Query(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    city_strip = city.strip()
    weather = get_weather_cached(db, city_strip, lat, lon)
    return {"city": city_strip, "weather": weather[0] if weather else None}


@router.get("/music", status_code=status.HTTP_200_OK)
def explore_music(
    city: str = Query(..., max_length=120),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    city_strip = city.strip()
    events = get_music_cached(db, city_strip)
    return {"city": city_strip, "events": events}


@router.get("/podcasts", status_code=status.HTTP_200_OK)
def explore_podcasts(
    city: str = Query(..., max_length=120),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    city_strip = city.strip()
    podcasts = get_podcasts_cached(db, city_strip)
    return {"city": city_strip, "podcasts": podcasts}


@router.get("/radio", status_code=status.HTTP_200_OK)
def explore_radio(
    country: str = Query(..., max_length=10),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    country_strip = country.strip().upper()
    stations = get_radio_cached(db, country_strip)
    return {"country": country_strip, "stations": stations}


@router.get("/google-events", status_code=status.HTTP_200_OK)
def explore_google_events(
    city: str = Query("Chicago", max_length=120),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
) -> dict[str, Any]:
    from app.services.serpapi_service import search_google_events
    city_strip = city.strip()
    
    # Map start_date to a rough SerpAPI date_filter
    date_filter = "today"
    if start_date:
        from datetime import datetime
        try:
            target = datetime.strptime(start_date, "%Y-%m-%d").date()
            today = datetime.now().date()
            diff = (target - today).days
            if diff <= 0: date_filter = "today"
            elif diff == 1: date_filter = "tomorrow"
            elif diff <= 7: date_filter = "this_week"
            else: date_filter = "this_month"
        except:
            pass

    # Search for a broad set of popular events - REMOVED redundant 'events' in query
    events = search_google_events(
        query="popular festivals and community attractions", 
        city=city_strip, 
        date_filter=date_filter
    )
    return {"city": city_strip, "events": events}


@router.get("/eventbrite", status_code=status.HTTP_200_OK)
def explore_eventbrite(
    city: str = Query(..., max_length=120),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Fetches localized Eventbrite events."""
    from app.services.explore_city_extended_service import get_eventbrite_cached
    city_strip = city.strip()
    events = get_eventbrite_cached(db, city_strip)
    return {"city": city_strip, "events": events}


@router.get("/seasonal-events-ai", status_code=status.HTTP_200_OK)
async def explore_seasonal_events_ai(
    city: str = Query(..., max_length=120),
) -> dict[str, Any]:
    """Generates AI-suggested seasonal events when live APIs are sparse."""
    from app.services.explore_city_extended_service import get_ai_seasonal_events
    events = await get_ai_seasonal_events(city.strip())
    return {"city": city.strip(), "events": events}


@router.get("/transport", status_code=status.HTTP_200_OK)
def explore_transport(
    city: str = Query(..., max_length=120),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    city_strip = city.strip()
    agencies = get_transport_cached(db, city_strip)
    return {"city": city_strip, "agencies": agencies}


@router.get("/fallback", status_code=status.HTTP_200_OK)
async def explore_fallback(
    lat: float = Query(...),
    lon: float = Query(...),
    city: str = Query(..., max_length=120),
    radius: int = Query(25000),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Universal location fallback for sparse areas."""
    fallback_data = await get_universal_fallback(db, lat, lon, city.strip(), radius)
    return {"city": city, "fallback": fallback_data}


@router.get("/city-scores", status_code=status.HTTP_200_OK)
def explore_city_scores(
    city: str = Query(..., max_length=120),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    city_strip = city.strip()
    scores = get_city_scores_cached(db, city_strip)
    return {"city": city_strip, "scores": scores}


@router.get("/wiki-summary", status_code=status.HTTP_200_OK)
def explore_wiki_summary(
    city: str = Query(..., max_length=120),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    city_strip = city.strip()
    summary = get_wiki_summary_cached(db, city_strip)
    return {"city": city_strip, "summary": summary[0] if summary else None}


@router.delete("/cache", status_code=status.HTTP_200_OK)
def clear_explore_cache(
    city: str = Query(..., max_length=120),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Remove cached explore rows (news/shorts payload) for a city. Admin only."""
    if not current_user.is_admin:
        AppException.forbidden("Unauthorized")
    city_strip = city.strip()
    db.query(ExploreContent).filter(
        ExploreContent.city.ilike(city_strip),
    ).delete(synchronize_session=False)
    db.commit()
    return {"message": f"Cache cleared for {city_strip}"}
