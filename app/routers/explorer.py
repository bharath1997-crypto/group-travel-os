"""
app/routers/explorer.py — Explorer and Wayra endpoints.
"""
from __future__ import annotations

import logging
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
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    message = body.message.strip()
    lowered = message.lower()
    context = f"city={body.city}; trip_context={body.trip_context}".strip()
    logger.info("Wayra demo chat user=%s %s", current_user.id, context)

    if "food" in lowered:
        response_text = (
            f"In {body.city}, I would start with food tours, local markets, "
            "and a casual dinner spot that works for groups."
        )
    elif "music" in lowered or "jazz" in lowered:
        response_text = (
            f"{body.city} is a good fit for live music tonight. Look for jazz, "
            "small venues, and late evening shows near your stay."
        )
    elif "free" in lowered:
        response_text = (
            f"I can prioritize free events in {body.city}: parks, galleries, "
            "community festivals, and outdoor performances."
        )
    else:
        response_text = (
            f"I can help your group find events, places, and easy plans in {body.city}. "
            "Tell me your mood, budget, and timing."
        )

    return {"response": response_text, "city": body.city}


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
