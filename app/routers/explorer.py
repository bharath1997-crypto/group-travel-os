"""
app/routers/explorer.py — Explorer and Wayra endpoints.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.explorer import ExplorerResultItem, ExplorerSearchResponse
from app.services.explorer_service import explorer_response_to_wire
from app.utils.auth import get_current_user
from app.utils.database import get_db
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)


# Optional SerpAPI-backed search — keep router import-safe when optional deps/network fail.
try:
    from app.services import serpapi_service as _serpapi_svc
except ImportError:  # pragma: no cover - defensive for CI/minimal installs
    _serpapi_svc = None


def search_google_events(query: str, city: str) -> list[dict[str, Any]]:
    if _serpapi_svc is None:
        return []
    try:
        fn = getattr(_serpapi_svc, "search_google_events", None)
        if not callable(fn):
            return []
        result = fn(query, city)
        return result if isinstance(result, list) else []
    except Exception:
        return []


def search_google_places(query: str, city: str) -> list[dict[str, Any]]:
    if _serpapi_svc is None:
        return []
    try:
        fn = getattr(_serpapi_svc, "search_google_places", None)
        if not callable(fn):
            return []
        result = fn(query, city)
        return result if isinstance(result, list) else []
    except Exception:
        return []


def search_google_web(query: str, city: str) -> list[dict[str, Any]]:
    if _serpapi_svc is None:
        return []
    try:
        fn = getattr(_serpapi_svc, "search_google_web", None)
        if not callable(fn):
            return []
        result = fn(query, city)
        return result if isinstance(result, list) else []
    except Exception:
        return []


def _safe_float_opt(val: Any) -> float | None:
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _search_internal_db(db: Session, q: str, city: str) -> list[dict[str, Any]]:
    """Tier-1 Explorer catalog lookup (targets tests / monkeypatch)."""
    try:
        from app.services import explorer_service as explorer_service_module

        rows = explorer_service_module._internal_db(db, q.strip(), (city.strip() or "Chicago"))
        return [item.model_dump(mode="json") for item in rows]
    except Exception:
        return []


def _explorer_item_from_tier_row(
    row: dict[str, Any],
    *,
    tier_source: str,
    location: str,
) -> ExplorerResultItem:
    """Map SerpAPI or internal dict rows onto ``ExplorerResultItem``."""
    src = "internal_db" if tier_source == "internal_db" else tier_source

    raw_type = row.get("type")
    if raw_type in ("event", "place", "video"):
        inferred = raw_type
    elif tier_source == "google_places" or row.get("category") == "place":
        inferred = "place"
    else:
        inferred = "event"

    merged = dict(row)
    merged["source"] = src
    merged.setdefault("source_type", src)
    merged.setdefault("city", location)
    merged.setdefault("venue", "")
    merged.setdefault("title", merged.get("title") or "Result")

    tid = merged.get("id")
    merged["id"] = str(tid) if tid not in (None, "") else str(merged["title"]).strip()[:160]

    ext = merged.get("external_url") or merged.get("source_url") or merged.get("url")
    merged["external_url"] = str(ext).strip() if ext else None
    merged["image_url"] = (str(merged.get("image_url")).strip() if merged.get("image_url") else None) or None
    merged["description"] = merged.get("description") if merged.get("description") not in (None, "") else None
    merged["price_from"] = _safe_float_opt(merged.get("price_from"))
    merged["type"] = inferred

    try:
        return ExplorerResultItem.model_validate(merged)
    except Exception:
        return ExplorerResultItem(
            source=src,
            type=inferred,  # type: ignore[arg-type]
            title=str(merged.get("title") or "Result"),
            description=(
                str(merged.get("description") or "") if merged.get("description") is not None else None
            ),
            image_url=merged["image_url"],
            external_url=merged["external_url"],
            price=merged["price_from"],
            id=str(merged.get("id", "")),
            source_type=str(merged.get("source_type") or src),
            venue=str(merged.get("venue") or ""),
            city=str(merged.get("city") or location),
            is_free=bool(merged.get("is_free", False)),
        )


def _run_tiered_explorer_search(db: Session, location: str, query: str) -> ExplorerSearchResponse:
    WAYRA_EMPTY_HINT = (
        f"I couldn't find '{query}' — "
        f"try events, restaurants, or activities near {location}, "
        f"and add Explorer API keys in `.env`."
    )
    loc = location.strip() or "Chicago"
    q = query.strip()

    internal = _search_internal_db(db, q, loc)
    if internal:
        items = [
            _explorer_item_from_tier_row(blob, tier_source="internal_db", location=loc) for blob in internal
        ]
        return ExplorerSearchResponse(
            location=loc,
            query=q,
            city=loc,
            results=items,
            total=len(items),
            source="internal_db",
            wayra_suggestion=None,
        )

    g_events = search_google_events(q, loc)
    if g_events:
        items = [_explorer_item_from_tier_row(d, tier_source="google_events", location=loc) for d in g_events]
        return ExplorerSearchResponse(
            location=loc,
            query=q,
            city=loc,
            results=items,
            total=len(items),
            source="google_events",
            wayra_suggestion=None,
        )

    g_places = search_google_places(q, loc)
    if g_places:
        items = [_explorer_item_from_tier_row(d, tier_source="google_places", location=loc) for d in g_places]
        return ExplorerSearchResponse(
            location=loc,
            query=q,
            city=loc,
            results=items,
            total=len(items),
            source="google_places",
            wayra_suggestion=None,
        )

    web_hits = search_google_web(q, loc)
    if web_hits:
        items = [_explorer_item_from_tier_row(d, tier_source="google_web", location=loc) for d in web_hits]
        return ExplorerSearchResponse(
            location=loc,
            query=q,
            city=loc,
            results=items,
            total=len(items),
            source="google_web",
            wayra_suggestion=None,
        )

    return ExplorerSearchResponse(
        location=loc,
        query=q,
        city=loc,
        results=[],
        total=0,
        source="none",
        wayra_suggestion=WAYRA_EMPTY_HINT,
    )


router = APIRouter(prefix="/explorer")
wayra_router = APIRouter(prefix="/wayra")


class ExplorerSaveRequest(BaseModel):
    trip_id: str = Field(..., min_length=1)


class ExplorerVoteRequest(BaseModel):
    trip_id: str = Field(..., min_length=1)
    vote: str = Field(..., min_length=1)


class ShortImportRequest(BaseModel):
    url: str = Field(..., min_length=1)
    city: str = Field(..., min_length=1)
    title: str | None = None
    thumbnail_url: str | None = None
    hashtags: list[str] | None = None


class WayraChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    city: str = "Chicago"
    trip_context: str = ""


@router.get("/feed", status_code=status.HTTP_200_OK)
def get_explorer_feed(
    background_tasks: BackgroundTasks,
    city: str = Query("Chicago", max_length=120),
    category: str = Query("", max_length=120),
    date_filter: str = Query("today", max_length=40),
    q: str = Query("", max_length=200),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    from app.services.explore_service import get_cached_events
    from app.schemas.explore import ExploreEventResponse
    
    query_str = q.strip() or category.strip() or "events"
    events_models = get_cached_events(db, background_tasks, city.strip() or "Chicago", query_str)
    
    # Manually serialize to dicts to match the existing UI signature quickly
    events_dicts = []
    for e in events_models:
        events_dicts.append({
            "id": str(e.id),
            "external_id": e.external_id,
            "title": e.title,
            "description": e.description or "",
            "category": e.category,
            "source_type": e.source_name,
            "source_url": e.booking_url or "",
            "booking_type": "external_link",
            "image_url": e.image_url or "",
            "venue": e.venue_name or "",
            "city": e.city,
            "date_str": e.start_time.isoformat() if e.start_time else "",
            "price_from": e.price_from,
            "is_free": e.is_free,
            "ticket_url": e.booking_url or "",
        })
        
    return {
        "events": events_dicts,
        "total": len(events_dicts),
        "city": city,
        "source": "database_cache",
    }


@router.get("/search", status_code=status.HTTP_200_OK)
def explorer_unified_search(
    q: str | None = Query(None, max_length=200),
    query: str | None = Query(None, max_length=200),
    city: str | None = Query(None, max_length=120),
    location: str | None = Query(None, max_length=120),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Combined Explorer search (`q`/`city` and `query`/`location` aliases).

    Tier order: internal catalog → Google Events → Places → organic web SerpAPI.
    Returns normalized Explorer items plus compatibility fields for Rovvy Explorer UI.
    """
    clean_query = (query or q or "").strip()
    clean_location = (location or city or "Chicago").strip()
    if len(clean_query) < 2:
        AppException.bad_request("Search query too short")

    tiered = _run_tiered_explorer_search(db, clean_location, clean_query)
    return explorer_response_to_wire(tiered)


@router.post("/items/{item_id}/save", status_code=status.HTTP_200_OK)
def save_explorer_item(
    item_id: str,
    body: ExplorerSaveRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    logger.info(
        "Explorer save intent user=%s item=%s trip=%s",
        current_user.id,
        item_id,
        body.trip_id,
    )
    return {"status": "saved", "item_id": item_id, "trip_id": body.trip_id}


@router.post("/items/{item_id}/vote", status_code=status.HTTP_200_OK)
def vote_explorer_item(
    item_id: str,
    body: ExplorerVoteRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    logger.info(
        "Explorer vote intent user=%s item=%s trip=%s vote=%s",
        current_user.id,
        item_id,
        body.trip_id,
        body.vote,
    )
    return {"status": "voted", "item_id": item_id, "vote": body.vote}


@wayra_router.post("/chat", status_code=status.HTTP_200_OK)
def chat_with_wayra(
    body: WayraChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.wayra_personal_service import WayraPersonalService
    res = WayraPersonalService.chat(current_user.id, body.message, db)
    return res


_live_context_cache: dict[uuid.UUID, tuple[float, str | None]] = {}


@wayra_router.get("/live-context/{trip_id}", status_code=status.HTTP_200_OK)
def get_wayra_live_context(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import time
    import json
    import httpx
    from sqlalchemy import select
    from app.services.timer_service import TimerService
    from app.utils.firebase import get_rtdb
    from app.models.trip_plan import TripPlan
    from app.services.wayra_service import _gemini_key, _GEMINI_URL
    from app.core.api_limits import API_TIMEOUT_SECONDS

    TimerService._verify_membership(db, current_user.id, trip_id)

    now = time.time()
    if trip_id in _live_context_cache:
        cached_time, cached_alert = _live_context_cache[trip_id]
        if now - cached_time < 60:
            return {"alert": cached_alert}

    locations = get_rtdb(f"trips/{trip_id}/locations") or {}
    plan = db.execute(select(TripPlan).where(TripPlan.trip_id == trip_id)).scalar_one_or_none()
    plan_data = plan.plan_json if plan else {"days": []}

    key = _gemini_key()
    if not key:
        return {"alert": None}

    try:
        instruction = (
            "You are Wayra, Rovvy's proactive group travel coordinator assistant. "
            "Analyze the current group members' live locations and the trip plan to identify coordination issues, delays, or helpful suggestions. "
            "If everything looks perfectly on track, return nothing (an empty string). "
            "Otherwise, write a very short, proactive warning or tip (maximum 1 sentence, under 15 words) for the group. "
            "Examples: '3 members are 2km behind', 'Leave now to reach destination on time', 'Traffic delay: plan departure 10 mins early'. "
            "Keep it highly relevant and concise. No conversational fluff, just the warning/suggestion."
        )
        context_data = {
            "locations": locations,
            "trip_plan": plan_data,
        }
        body = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": f"{instruction}\n\nContext Data (JSON):\n{json.dumps(context_data)}\n\nOutput:"
                        }
                    ],
                }
            ],
            "generationConfig": {
                "temperature": 0.4,
                "maxOutputTokens": 60,
            },
        }

        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            r = client.post(_GEMINI_URL, params={"key": key}, json=body)

        alert_text = None
        if r.status_code == 200:
            data = r.json()
            candidates = data.get("candidates")
            if isinstance(candidates, list) and candidates:
                first = candidates[0]
                if isinstance(first, dict):
                    content = first.get("content")
                    if isinstance(content, dict):
                        parts = content.get("parts")
                        if isinstance(parts, list):
                            chunks = []
                            for p in parts:
                                if isinstance(p, dict) and isinstance(p.get("text"), str):
                                    chunks.append(p["text"])
                            txt = "".join(chunks).strip()
                            if txt:
                                alert_text = txt

        _live_context_cache[trip_id] = (now, alert_text)
        return {"alert": alert_text}
    except Exception as exc:
        logger.warning("Failed to fetch Wayra live-context alert: %s", exc)
        return {"alert": None}


_nearby_picks_cache: dict[uuid.UUID, tuple[float, list[dict]]] = {}


@wayra_router.get("/nearby/{trip_id}", status_code=status.HTTP_200_OK)
def get_wayra_nearby_picks(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import time
    import json
    import math
    import httpx
    from sqlalchemy import text
    from app.services.timer_service import TimerService
    from app.utils.firebase import get_rtdb
    from app.services.wayra_service import _gemini_key, _GEMINI_URL
    from app.core.api_limits import API_TIMEOUT_SECONDS

    TimerService._verify_membership(db, current_user.id, trip_id)

    now = time.time()
    if trip_id in _nearby_picks_cache:
        cached_time, cached_picks = _nearby_picks_cache[trip_id]
        if now - cached_time < 300:
            return {"picks": cached_picks}

    locations = get_rtdb(f"trips/{trip_id}/locations") or {}
    valid_coords = []
    for uid, loc in locations.items():
        lat = loc.get("lat") or loc.get("latitude")
        lng = loc.get("lng") or loc.get("longitude")
        if lat is not None and lng is not None:
            valid_coords.append((float(lat), float(lng)))

    if valid_coords:
        centroid_lat = sum(c[0] for c in valid_coords) / len(valid_coords)
        centroid_lng = sum(c[1] for c in valid_coords) / len(valid_coords)
    else:
        centroid_lat, centroid_lng = 41.8781, -87.6298

    poi_list = []
    try:
        lat_delta = 10.0 / 69.0
        lon_delta = 10.0 / (69.0 * max(abs(math.cos(math.radians(centroid_lat))), 1e-6))
        query_str = """
            SELECT title, category, venue_name, venue_lat, venue_lon,
              (3959 * acos(
                cos(radians(:lat)) * cos(radians(venue_lat)) *
                cos(radians(venue_lon) - radians(:lon)) +
                sin(radians(:lat)) * sin(radians(venue_lat))
              )) AS distance_miles
            FROM explore_contents
            WHERE content_type = 'osm_place'
              AND venue_lat IS NOT NULL
              AND venue_lon IS NOT NULL
              AND venue_lat BETWEEN :lat_min AND :lat_max
              AND venue_lon BETWEEN :lon_min AND :lon_max
        """
        params = {
            "lat": centroid_lat,
            "lon": centroid_lng,
            "lat_min": centroid_lat - lat_delta,
            "lat_max": centroid_lat + lat_delta,
            "lon_min": centroid_lng - lon_delta,
            "lon_max": centroid_lng + lon_delta,
            "radius": 10.0,
        }
        full_sql = f"""
            SELECT * FROM (
                {query_str}
            ) AS subq
            WHERE distance_miles <= :radius
            ORDER BY distance_miles ASC
            LIMIT 20
        """
        rows = db.execute(text(full_sql), params).all()
        for r in rows:
            poi_list.append({
                "name": r.title or r.venue_name or "POI",
                "type": r.category or "point of interest",
                "distance": round(float(r.distance_miles), 2),
                "description": ""
            })
    except Exception as exc:
        logger.warning("Failed to query database for nearby POIs: %s", exc)

    if not poi_list:
        poi_list = [
            {"name": "Starved Rock State Park", "type": "park", "distance": 1.2, "description": "Beautiful regional park with hiking routes."},
            {"name": "Matthiessen State Park", "type": "park", "distance": 3.4, "description": "Quiet park with scenic canyons and waterfalls."},
        ]

    key = _gemini_key()
    if not key:
        picks = poi_list[:2]
        _nearby_picks_cache[trip_id] = (now, picks)
        return {"picks": picks}

    try:
        instruction = (
            "You are Wayra, Rovvy's proactive group travel coordinator assistant. "
            "Below is a list of nearby Points of Interest (POIs). "
            "Analyze them and pick the top 2 recommendations for the group. "
            "For each recommendation, output a JSON array of 2 objects containing: "
            "'name' (str), 'type' (str), 'distance' (float, in miles), and 'description' (str, a very short, catchy 1-sentence tip on why to visit). "
            "Respond ONLY with the JSON array. Do NOT wrap it in ```json blocks or any formatting."
        )
        body = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": f"{instruction}\n\nNearby POIs:\n{json.dumps(poi_list)}\n\nOutput:"
                        }
                    ],
                }
            ],
            "generationConfig": {
                "temperature": 0.4,
                "maxOutputTokens": 300,
            },
        }

        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            r = client.post(_GEMINI_URL, params={"key": key}, json=body)

        picks = []
        if r.status_code == 200:
            data = r.json()
            candidates = data.get("candidates")
            if isinstance(candidates, list) and candidates:
                first = candidates[0]
                if isinstance(first, dict):
                    content = first.get("content")
                    if isinstance(content, dict):
                        parts = content.get("parts")
                        if isinstance(parts, list):
                            chunks = []
                            for p in parts:
                                if isinstance(p, dict) and isinstance(p.get("text"), str):
                                    chunks.append(p["text"])
                            txt = "".join(chunks).strip()
                            try:
                                parsed = json.loads(txt)
                                if isinstance(parsed, list):
                                    for item in parsed:
                                        if isinstance(item, dict) and "name" in item:
                                            picks.append({
                                                "name": item.get("name"),
                                                "type": item.get("type", "POI"),
                                                "distance": item.get("distance", 0.0),
                                                "description": item.get("description", "")
                                            })
                            except Exception:
                                pass

        if not picks:
            picks = poi_list[:2]

        _nearby_picks_cache[trip_id] = (now, picks)
        return {"picks": picks}
    except Exception as exc:
        logger.warning("Failed to fetch Wayra nearby picks: %s", exc)
        return {"picks": poi_list[:2]}


@router.post("/shorts/import", status_code=status.HTTP_201_CREATED)
def import_short(
    body: ShortImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.imported_short_service import create_imported_short
    
    try:
        short = create_imported_short(
            db=db,
            city=body.city,
            url=body.url,
            title=body.title,
            thumbnail_url=body.thumbnail_url,
            hashtags=body.hashtags,
        )
        return {"status": "success", "id": str(short.id), "video_id": short.external_id}
    except ValueError as e:
        AppException.bad_request(str(e))
    except Exception as e:
        AppException.internal_error(f"Failed to import short: {e}")


@router.get("/shorts/{short_id}")
def get_short(
    short_id: str,
    db: Session = Depends(get_db),
):
    from app.models.imported_short import ImportedShort
    import uuid
    
    try:
        short_uuid = uuid.UUID(short_id)
    except ValueError:
        AppException.bad_request("Invalid short ID format")
        
    short = db.query(ImportedShort).filter(ImportedShort.id == short_uuid).first()
    if not short:
        AppException.not_found("Short not found")
        
    return {
        "id": short.id,
        "likes_count": short.likes_count,
        "reaction_counts": short.reaction_counts,
        "comments": short.comments if hasattr(short, "comments") else []
    }


@router.post("/shorts/{short_id}/react")
def react_to_short(
    short_id: str,
    reaction_type: str,  # "love", "helpful", "list", or "like"
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.imported_short import ImportedShort
    import uuid
    from sqlalchemy.orm.attributes import flag_modified
    
    try:
        short_uuid = uuid.UUID(short_id)
    except ValueError:
        AppException.bad_request("Invalid short ID format")
        
    short = db.query(ImportedShort).filter(ImportedShort.id == short_uuid).first()
    if not short:
        AppException.bad_request("Short not found")
        
    if reaction_type == "like":
        short.likes_count += 1
    elif reaction_type in ["love", "helpful", "list"]:
        if not short.reaction_counts:
            short.reaction_counts = {"love": 0, "helpful": 0, "list": 0}
        
        # Create a new dict to ensure SQLAlchemy detects the change or use flag_modified
        counts = dict(short.reaction_counts)
        counts[reaction_type] = counts.get(reaction_type, 0) + 1
        short.reaction_counts = counts
        flag_modified(short, "reaction_counts")
    else:
        AppException.bad_request("Invalid reaction type")
        
    db.commit()
    return {"status": "success", "likes": short.likes_count, "reactions": short.reaction_counts}


# ── New Wayra Dual System Endpoints ───────────────────────────────────────────

class WayraToggleRequest(BaseModel):
    enabled: bool

class WayraMentionRequest(BaseModel):
    message: str
    chat_id: str

class WayraDetectUrlRequest(BaseModel):
    message: str

class WayraExtractLocationRequest(BaseModel):
    url: str

@wayra_router.get("/context", status_code=status.HTTP_200_OK)
def get_wayra_personal_context(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.wayra_personal_service import WayraPersonalService
    return WayraPersonalService.get_user_context(current_user.id, db)

@wayra_router.get("/group/{id_or_group_id}/status", status_code=status.HTTP_200_OK)
def get_wayra_group_status(
    id_or_group_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check by group first
    settings_row = db.execute(
        select(WayraGroupSettings).where(WayraGroupSettings.group_id == id_or_group_id)
    ).scalar_one_or_none()
    
    if settings_row:
        return {
            "enabled": settings_row.wayra_enabled,
            "off_since": settings_row.turned_off_at.isoformat() if settings_row.turned_off_at else None
        }
        
    # Check by chat_id
    from app.models.lounge import LoungeChat
    chat = db.execute(
        select(LoungeChat).where(LoungeChat.id == id_or_group_id)
    ).scalar_one_or_none()
    
    if chat:
        if chat.trip_id:
            from app.models.trip import Trip
            trip = db.execute(
                select(Trip).where(Trip.id == chat.trip_id)
            ).scalar_one_or_none()
            if trip:
                settings_row = db.execute(
                    select(WayraGroupSettings).where(WayraGroupSettings.group_id == trip.group_id)
                ).scalar_one_or_none()
                if settings_row:
                    return {
                        "enabled": settings_row.wayra_enabled,
                        "off_since": settings_row.turned_off_at.isoformat() if settings_row.turned_off_at else None
                    }
        return {
            "enabled": chat.wayra_enabled,
            "off_since": chat.wayra_off_since.isoformat() if chat.wayra_off_since else None
        }
        
    return {
        "enabled": True,
        "off_since": None
    }

@wayra_router.post("/group/{group_id}/toggle", status_code=status.HTTP_200_OK)
def toggle_wayra_group(
    group_id: uuid.UUID,
    body: WayraToggleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.group_service import GroupService
    from app.models.wayra import WayraGroupSettings
    from app.models.lounge import LoungeChat
    from app.models.trip import Trip
    from app.models.group import Group
    from datetime import datetime, timezone
    import time
    
    # Resolve group_id if it's a chat_id
    group_exists = db.execute(select(Group).where(Group.id == group_id)).scalar_one_or_none()
    if not group_exists:
        chat = db.execute(select(LoungeChat).where(LoungeChat.id == group_id)).scalar_one_or_none()
        if chat:
            if chat.trip_id:
                trip = db.execute(select(Trip).where(Trip.id == chat.trip_id)).scalar_one_or_none()
                if trip:
                    group_id = trip.group_id
            else:
                g = db.execute(select(Group).where(Group.name == chat.name)).scalar_one_or_none()
                if g:
                    group_id = g.id
                    
    GroupService.require_admin(db, group_id, current_user.id)
    
    settings_row = db.execute(
        select(WayraGroupSettings).where(WayraGroupSettings.group_id == group_id)
    ).scalar_one_or_none()
    
    if not settings_row:
        settings_row = WayraGroupSettings(group_id=group_id, wayra_enabled=True)
        db.add(settings_row)
        db.flush()
        
    enabled = body.enabled
    now_dt = datetime.now(timezone.utc)
    
    settings_row.wayra_enabled = enabled
    if enabled:
        settings_row.turned_on_at = now_dt
        settings_row.turned_on_by = current_user.id
        settings_row.turned_off_at = None
        settings_row.turned_off_by = None
        msg_text = "Wayra joined the group (Admin turned on)"
    else:
        settings_row.turned_off_at = now_dt
        settings_row.turned_off_by = current_user.id
        settings_row.turned_on_at = None
        settings_row.turned_on_by = None
        msg_text = "Wayra left the group (Admin turned off)"
        
    trip_ids_stmt = select(Trip.id).where(Trip.group_id == group_id)
    chats = db.execute(
        select(LoungeChat).where(
            (LoungeChat.trip_id.in_(trip_ids_stmt)) | 
            ((LoungeChat.type == "group") & (LoungeChat.name == select(Group.name).where(Group.id == group_id).scalar_subquery()))
        )
    ).scalars().all()
    
    for chat in chats:
        chat.wayra_enabled = enabled
        chat.wayra_off_since = None if enabled else now_dt
        
    db.commit()
    
    for chat in chats:
        try:
            from app.utils.firebase import get_rtdb_ref
            ref = get_rtdb_ref(f"chats/{chat.id}/messages")
            ref.push({
                "sender_id": "system",
                "sender_name": "System",
                "message": msg_text,
                "text": msg_text,
                "timestamp": int(time.time() * 1000),
                "type": "system",
                "wayra_visible": True
            })
        except Exception as e:
            logger.error("Failed to post system message to Firebase: %s", e)
            
        if chat.trip_id:
            try:
                from app.utils.firebase import get_rtdb_ref
                ref = get_rtdb_ref(f"trips/{chat.trip_id}/chat")
                ref.push({
                    "sender_id": "system",
                    "sender_name": "System",
                    "message": msg_text,
                    "text": msg_text,
                    "timestamp": int(time.time() * 1000),
                    "type": "system",
                    "wayra_visible": True
                })
            except Exception as e:
                logger.error("Failed to post system message to Firebase trip: %s", e)
                
    return {"status": "success", "enabled": enabled}

@wayra_router.post("/group/{group_id}/mention", status_code=status.HTTP_200_OK)
def mention_wayra_group(
    group_id: uuid.UUID,
    body: WayraMentionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.wayra_group_service import WayraGroupService
    import time
    
    response_text = WayraGroupService.respond_to_mention(
        group_id=group_id,
        message=body.message,
        sender_name=current_user.full_name or "Traveler",
        db=db
    )
    
    if not response_text:
        return {"response": None}
        
    try:
        from app.utils.firebase import get_rtdb_ref
        ref = get_rtdb_ref(f"chats/{body.chat_id}/messages")
        ref.push({
            "sender_id": "wayra_ai",
            "sender_name": "Wayra AI",
            "sender_avatar": "wayra",
            "message": response_text,
            "text": response_text,
            "timestamp": int(time.time() * 1000),
            "type": "wayra",
            "wayra_visible": True
        })
        
        from app.models.lounge import LoungeChat
        chat = db.execute(select(LoungeChat).where(LoungeChat.id == uuid.UUID(body.chat_id))).scalar_one_or_none()
        if chat and chat.trip_id:
            trip_ref = get_rtdb_ref(f"trips/{chat.trip_id}/chat")
            trip_ref.push({
                "sender_id": "wayra_ai",
                "sender_name": "Wayra AI",
                "sender_avatar": "wayra",
                "message": response_text,
                "text": response_text,
                "timestamp": int(time.time() * 1000),
                "type": "wayra",
                "wayra_visible": True
            })
    except Exception as e:
        logger.error("Failed to post Wayra group response: %s", e)
        
    return {"response": response_text}

@wayra_router.post("/group/detect-url", status_code=status.HTTP_200_OK)
def detect_wayra_url(
    body: WayraDetectUrlRequest,
    current_user: User = Depends(get_current_user),
):
    from app.services.wayra_group_service import WayraGroupService
    return WayraGroupService.detect_travel_url(body.message)

@wayra_router.post("/group/extract-location", status_code=status.HTTP_200_OK)
async def extract_wayra_location(
    body: WayraExtractLocationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.wayra_group_service import WayraGroupService
    res = await WayraGroupService.extract_url_location(body.url, db)
    return res
