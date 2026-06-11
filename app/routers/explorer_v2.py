"""
app/routers/explorer_v2.py — PostGIS-backed Explorer places API (v2).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.explorer_v2 import ExploreNearbyResponse, ExploreViewportResponse
from app.services.explorer.explorer_v2_service import explorer_v2_service
from app.utils.auth import get_current_user
from app.utils.database import get_db
from app.utils.exceptions import AppException

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
