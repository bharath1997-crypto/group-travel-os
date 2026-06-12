"""
app/routers/explorer_v2.py — PostGIS-backed Explorer places API (v2).
"""
from __future__ import annotations

from datetime import datetime, timezone
import logging
import httpx
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.explorer_v2 import ExploreNearbyResponse, ExploreViewportResponse, EventResult
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

