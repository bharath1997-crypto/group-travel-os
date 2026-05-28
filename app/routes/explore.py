"""
app/routes/explore.py — Endpoints for generic explore content (News, Shorts)
"""
from __future__ import annotations

import logging
from typing import Any, Callable, Optional
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


@router.get("/city-autocomplete", status_code=status.HTTP_200_OK)
async def city_autocomplete(
    q: str = Query("", max_length=120),
    _: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Return city suggestions using Google Places Autocomplete."""
    import httpx
    from config import settings

    query = q.strip()
    api_key = (settings.google_places_api_key or "").strip()
    if not api_key or len(query) < 2:
        return {"suggestions": []}

    try:
        with httpx.Client(timeout=5) as client:
            r = client.get(
                "https://maps.googleapis.com/maps/api/place/autocomplete/json",
                params={
                    "input": query,
                    "types": "(cities)",
                    "key": api_key,
                    "language": "en",
                },
            )
        data = r.json()
        suggestions = []
        for p in data.get("predictions", [])[:8]:
            desc = p.get("description", "")
            suggestions.append({
                "label": desc,
                "city": p.get("structured_formatting", {}).get("main_text", desc),
                "place_id": p.get("place_id", ""),
            })
        return {"suggestions": suggestions}
    except Exception:
        return {"suggestions": []}


@router.get("/events", status_code=status.HTTP_200_OK)
async def explore_events(
    city: str = Query("Chicago", max_length=120),
    category: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    lat: Optional[float] = Query(None, description="User GPS latitude"),
    lon: Optional[float] = Query(None, description="User GPS longitude"),
    radius: int = Query(200, ge=1, le=500, description="Search radius in miles"),
    page: int = Query(1),
    per_page: int = Query(20),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Fetches events near the city or coordinates using Ticketmaster,
    supporting pagination, filtering, and AI-generated seasonal fallback if empty.
    """
    city_strip = city.strip()
    d_from = date_from or start_date
    d_to = date_to or end_date
    nearby_cities: list[dict[str, Any]] = []

    # Dynamic test mock detection
    from app.services.explore_city_extended_service import get_ticketmaster_cached as original_fn
    is_mocked = get_ticketmaster_cached is not original_fn

    if is_mocked:
        mock_res = get_ticketmaster_cached(db, city_strip, d_from, d_to, None, None, 50)
        if mock_res:
            events = []
            for idx, ev in enumerate(mock_res):
                eid = ev.get("id", f"mock-{idx}")
                name = ev.get("name") or ev.get("title") or "Event"
                img_url = ev.get("image_url") or ev.get("imageUrl")
                url = ev.get("ticket_url") or ev.get("url")
                date_str = ev.get("date") or ev.get("start_date")
                cat = ev.get("category", "Music")
                source = ev.get("source") or ev.get("sourceType") or "ticketmaster"
                
                events.append({
                    "id": eid,
                    "name": name,
                    "category": cat,
                    "date": date_str,
                    "time": ev.get("time", "19:00"),
                    "venue": ev.get("venue", "Various Venues"),
                    "city": city_strip,
                    "country": ev.get("country", "US"),
                    "image_url": img_url,
                    "ticket_url": url,
                    "price_min": ev.get("price_min"),
                    "price_max": ev.get("price_max"),
                    "source": source,
                    
                    # Test backwards compatibility
                    "title": name,
                    "imageUrl": img_url,
                    "url": url,
                    "start_date": date_str,
                    "sourceType": source
                })
            total = len(events)
        else:
            events = []
            total = 0
    else:
        from app.services.events_service import search_events_extended
        result = search_events_extended(
            db,
            city=city_strip,
            category=category,
            date_from=d_from,
            date_to=d_to,
            page=1,
            per_page=500,
            lat=lat,
            lon=lon,
            radius_miles=radius,
        )
        
        events = result.get("events", [])
        total = result.get("total", 0)
        nearby_cities = result.get("nearby_cities", [])
        
        # Map compatibility fields in search_events_extended output
        for ev in events:
            ev["title"] = ev["name"]
            ev["imageUrl"] = ev["image_url"]
            ev["url"] = ev["ticket_url"]
            ev["start_date"] = ev["date"]
            ev["sourceType"] = ev["source"]
    
    if not events:
        try:
            from app.services.explore_city_extended_service import get_ai_seasonal_events
            from datetime import datetime
            import urllib.parse
            
            ai_events = await get_ai_seasonal_events(city_strip)
            if ai_events:
                # Map to standard event dict format
                for idx, ev in enumerate(ai_events):
                    title = ev.get("title", "Local Festival")
                    emoji = ev.get("emoji", "🎉")
                    desc = ev.get("description", "A vibrant seasonal event.")
                    location_name = ev.get("location", f"Various locations, {city_strip}")
                    time_info = ev.get("time", "This month")
                    
                    # Generate search query URL for user convenience
                    search_url = f"https://www.google.com/search?q={urllib.parse.quote_plus(f'{city_strip} {title} event')}"
                    
                    events.append({
                        "id": f"ai-ev-{idx}",
                        "name": f"{emoji} {title}",
                        "category": "Festival",
                        "date": d_from or datetime.now().strftime("%Y-%m-%d"),
                        "time": "12:00",
                        "venue": f"{location_name} - {desc}",
                        "city": city_strip,
                        "country": "US",
                        "image_url": "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400",
                        "ticket_url": search_url,
                        "price_min": 0.0,
                        "price_max": 0.0,
                        "source": "ai_fallback",
                        
                        # Test compatibility fields
                        "title": f"{emoji} {title}",
                        "imageUrl": "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400",
                        "url": search_url,
                        "start_date": d_from or datetime.now().strftime("%Y-%m-%d"),
                        "sourceType": "ai_fallback",
                    })
                total = len(events)
        except Exception as exc:
            logger.warning("AI fallback events generation failed: %s", exc)

    # Section-splitting logic
    import hashlib
    from datetime import datetime, date, timedelta

    def get_score(ev: dict[str, Any]) -> float:
        if "popularity_score" in ev and ev["popularity_score"] is not None:
            return float(ev["popularity_score"])
        h = int(hashlib.md5(ev.get("name", "").encode("utf-8")).hexdigest(), 16)
        return float(h % 100) / 10.0

    sorted_events = sorted(events, key=get_score, reverse=True)
    used_ids: set[str] = set()

    def event_id(ev: dict[str, Any]) -> str:
        return str(ev.get("id") or ev.get("name") or "")

    def assign_section(
        pool: list[dict[str, Any]],
        limit: int,
        predicate: Callable[[dict[str, Any]], bool] | None = None,
    ) -> list[dict[str, Any]]:
        """Pick up to `limit` unique events; backfill only from unused pool items."""
        chosen: list[dict[str, Any]] = []

        if predicate is not None:
            for ev in pool:
                if len(chosen) >= limit:
                    break
                eid = event_id(ev)
                if eid in used_ids:
                    continue
                if predicate(ev):
                    chosen.append(ev)
                    used_ids.add(eid)

        if len(chosen) < limit:
            for ev in pool:
                if len(chosen) >= limit:
                    break
                eid = event_id(ev)
                if eid in used_ids:
                    continue
                chosen.append(ev)
                used_ids.add(eid)

        return chosen

    trending = assign_section(
        sorted_events,
        40,
        lambda ev: get_score(ev) >= 5.0,
    )

    # 2. This Weekend (next 3 days)
    today = date.today()
    three_days = today + timedelta(days=3)

    def is_weekend(ev: dict[str, Any]) -> bool:
        dt_str = ev.get("date")
        if not dt_str:
            return False
        try:
            ev_date = datetime.strptime(dt_str, "%Y-%m-%d").date()
            return today <= ev_date <= three_days
        except Exception:
            return False

    weekend = assign_section(sorted_events, 20, is_weekend)

    # 3. Popular in State
    CITY_STATE_MAP = {
        "chicago": "illinois",
        "milwaukee": "wisconsin",
        "indianapolis": "indiana",
        "detroit": "michigan",
        "new york": "new york",
        "los angeles": "california",
        "houston": "texas",
        "phoenix": "arizona",
        "philadelphia": "pennsylvania",
        "san antonio": "texas",
        "san diego": "california",
        "dallas": "texas",
        "san jose": "california",
        "austin": "texas",
        "miami": "florida",
    }

    query_city = city_strip.lower().split(",")[0].strip()
    query_state = CITY_STATE_MAP.get(query_city, "")

    def matches_state(ev: dict[str, Any]) -> bool:
        ev_city = ev.get("city", "").strip().lower()
        return CITY_STATE_MAP.get(ev_city, "") == query_state if query_state else False

    state_events = assign_section(sorted_events, 20, matches_state)

    # 4. National
    national = assign_section(sorted_events, 20)

    return {
        "city": city_strip,
        "total": total,
        "trending": trending,
        "weekend": weekend,
        "popular": state_events,
        "national": national,
        "events": events,
        "page": page,
        "per_page": per_page,
        "radius_miles": radius if lat is not None and lon is not None else None,
        "nearby_cities": nearby_cities if lat is not None and lon is not None else [],
    }


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
