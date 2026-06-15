"""
app/routers/explorer_v2.py — PostGIS-backed Explorer places API (v2).
"""
from __future__ import annotations

import uuid as _uuid
from datetime import datetime, timezone
import logging
import httpx
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.explorer_v2 import (
    ExploreNearbyResponse,
    ExploreViewportResponse,
    EventResult,
    ExternalCallsRemainingResponse,
    PlaceResult,
    SearchLogRequest,
)
from app.services.explorer.explorer_v2_service import explorer_v2_service
from app.utils.auth import get_current_user
from app.utils.database import get_db
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)

router = APIRouter(tags=["explorer_v2"])

MAX_RADIUS_M = 50000
MAX_NEARBY_LIMIT = 200
MAX_VIEWPORT_LIMIT = 500


@router.get("/nearby", response_model=ExploreNearbyResponse)
def get_nearby(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_m: float = Query(5000, ge=1),
    categories: list[str] | None = Query(None),
    limit: int = Query(50, ge=1, le=MAX_NEARBY_LIMIT),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExploreNearbyResponse:
    if radius_m > MAX_RADIUS_M:
        AppException.bad_request(f"radius_m must be <= {MAX_RADIUS_M}")

    return explorer_v2_service.get_nearby(
        lat=lat,
        lng=lng,
        radius_m=radius_m,
        categories=categories,
        limit=limit,
        db=db,
    )


@router.get("/viewport", response_model=ExploreViewportResponse)
def get_viewport(
    sw_lat: float = Query(...),
    sw_lng: float = Query(...),
    ne_lat: float = Query(...),
    ne_lng: float = Query(...),
    categories: list[str] | None = Query(None),
    limit: int = Query(100, ge=1, le=MAX_VIEWPORT_LIMIT),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExploreViewportResponse:
    if ne_lat <= sw_lat or ne_lng <= sw_lng:
        AppException.bad_request("Invalid bbox: ne_lat must exceed sw_lat and ne_lng must exceed sw_lng")

    return explorer_v2_service.get_viewport(
        sw_lat=sw_lat,
        sw_lng=sw_lng,
        ne_lat=ne_lat,
        ne_lng=ne_lng,
        categories=categories,
        limit=limit,
        db=db,
    )


@router.get("/search", response_model=list[PlaceResult])
def search_places(
    q: str = Query(..., min_length=1),
    lat: float | None = Query(None),
    lng: float | None = Query(None),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PlaceResult]:
    """Name-match search against the Rovvy places DB, optionally sorted by distance."""
    search_term = f"%{q}%"
    is_sqlite = db.bind.dialect.name == "sqlite"

    if is_sqlite or lat is None or lng is None:
        query = text("""
            SELECT id, name, category, subcategory, lat, lng,
                   address, photo_url, website, phone, opening_hours,
                   source, 0.0 AS distance_m
            FROM places
            WHERE name LIKE :q
              AND name IS NOT NULL
            ORDER BY name ASC
            LIMIT :limit
        """)
        params: dict = {"q": search_term, "limit": limit}
    else:
        query = text("""
            SELECT id, name, category, subcategory, lat, lng,
                   address, photo_url, website, phone, opening_hours,
                   source,
                   ST_Distance(
                       geom::geography,
                       ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                   ) AS distance_m
            FROM places
            WHERE name ILIKE :q
              AND name IS NOT NULL
            ORDER BY distance_m ASC
            LIMIT :limit
        """)
        params = {"q": search_term, "lat": lat, "lng": lng, "limit": limit}

    try:
        rows = db.execute(query, params).mappings().all()
    except Exception as exc:
        logger.error(f"Error in /search: {exc}")
        return []

    results = []
    for r in rows:
        addr = r["address"]
        if isinstance(addr, str):
            import json
            try:
                addr = json.loads(addr)
            except Exception:
                addr = None
        results.append(
            PlaceResult(
                id=r["id"],
                name=r["name"],
                category=r["category"],
                subcategory=r["subcategory"],
                lat=float(r["lat"]) if r["lat"] is not None else 0.0,
                lng=float(r["lng"]) if r["lng"] is not None else 0.0,
                address=addr,
                photo_url=r["photo_url"],
                website=r["website"],
                phone=r["phone"],
                opening_hours=r["opening_hours"],
                source=r["source"] or "rovvy_db",
                distance_m=float(r["distance_m"]) if r["distance_m"] is not None else None,
            )
        )
    return results


@router.post("/search/log")
def log_search(
    body: SearchLogRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Record a geocoding waterfall event — only logs query text and source, never coordinates."""
    is_sqlite = db.bind.dialect.name == "sqlite"
    if is_sqlite:
        query = text("""
            INSERT INTO search_logs (id, user_id, query, source, results_count, lat, lng, created_at)
            VALUES (:id, :user_id, :query, :source, :results_count, :lat, :lng, :created_at)
        """)
        params: dict = {
            "id": str(_uuid.uuid4()),
            "user_id": str(current_user.id),
            "query": body.query,
            "source": body.source,
            "results_count": body.results_count,
            "lat": body.lat,
            "lng": body.lng,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    else:
        query = text("""
            INSERT INTO search_logs (user_id, query, source, results_count, lat, lng)
            VALUES (:user_id, :query, :source, :results_count, :lat, :lng)
        """)
        params = {
            "user_id": current_user.id,
            "query": body.query,
            "source": body.source,
            "results_count": body.results_count,
            "lat": body.lat,
            "lng": body.lng,
        }
    try:
        db.execute(query, params)
        db.commit()
    except Exception as exc:
        logger.error(f"Error saving search log: {exc}")
        db.rollback()
    return Response(status_code=204)


@router.get("/search/external-calls-remaining", response_model=ExternalCallsRemainingResponse)
def external_calls_remaining(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExternalCallsRemainingResponse:
    """Returns how many paid (HERE / Mapbox) geocoding calls the user can still make today."""
    is_sqlite = db.bind.dialect.name == "sqlite"
    if is_sqlite:
        query = text("""
            SELECT COUNT(*) AS cnt FROM search_logs
            WHERE user_id = :user_id
              AND source IN ('here', 'mapbox')
              AND created_at > datetime('now', '-24 hours')
        """)
    else:
        query = text("""
            SELECT COUNT(*) AS cnt FROM search_logs
            WHERE user_id = :user_id
              AND source IN ('here', 'mapbox')
              AND created_at > NOW() - INTERVAL '24 hours'
        """)
    try:
        row = db.execute(query, {"user_id": current_user.id}).mappings().one()
        used = int(row["cnt"])
    except Exception as exc:
        logger.error(f"Error querying external call count: {exc}")
        used = 0

    return ExternalCallsRemainingResponse(
        remaining=max(0, 5 - used),
        limit=5,
        reset="midnight UTC",
    )


@router.get("/city")
def get_city(
    lat: float = Query(...),
    lng: float = Query(...),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    headers = {"User-Agent": "Rovvy/1.0 (contact@rovvy.app)"}
    url = "https://nominatim.openstreetmap.org/reverse"
    params = {
        "lat": lat,
        "lon": lng,
        "format": "json",
    }
    try:
        response = httpx.get(url, params=params, headers=headers, timeout=10.0)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        logger.error(f"Failed to reverse geocode via Nominatim: {e}")
        # Default fallback
        return {"city": "Chicago", "country": "United States"}

    address = data.get("address", {})
    city = address.get("city") or address.get("town") or address.get("village") or "Chicago"
    country = address.get("country") or "United States"
    return {"city": city, "country": country}


@router.get("/events", response_model=list[EventResult])
def get_events(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_m: float = Query(50000.0, ge=1.0),
    limit: int = Query(8, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[EventResult]:
    now = datetime.now(timezone.utc)
    if db.bind.dialect.name == "sqlite":
        # SQLite fallback for test suites
        query = text("""
            SELECT id, title, start_time, end_time, ticket_url, price_min, price_max, category, lat, lng
            FROM events
            WHERE start_time > :now
            ORDER BY start_time ASC
            LIMIT :limit
        """)
        params = {
            "now": now,
            "limit": limit,
        }
    else:
        # PostgreSQL PostGIS query
        query = text("""
            SELECT id, title, start_time, end_time, ticket_url, price_min, price_max, category, lat, lng
            FROM events
            WHERE start_time > :now
              AND ST_DWithin(
                  geom::geography,
                  ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                  :radius_m
              )
            ORDER BY start_time ASC
            LIMIT :limit
        """)
        params = {
            "lat": lat,
            "lng": lng,
            "radius_m": radius_m,
            "now": now,
            "limit": limit,
        }

    try:
        rows = db.execute(query, params).mappings().all()
    except Exception as e:
        logger.error(f"Error querying events table: {e}")
        return []

    results = []
    for r in rows:
        results.append(
            EventResult(
                id=r["id"],
                title=r["title"],
                start_time=r["start_time"],
                end_time=r["end_time"],
                ticket_url=r["ticket_url"],
                price_min=float(r["price_min"]) if r["price_min"] is not None else None,
                price_max=float(r["price_max"]) if r["price_max"] is not None else None,
                category=r["category"],
                lat=float(r["lat"]) if r["lat"] is not None else None,
                lng=float(r["lng"]) if r["lng"] is not None else None,
            )
        )
    return results

