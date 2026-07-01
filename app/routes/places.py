"""
app/routes/places.py — Endpoint for searching nearby points of interest.
"""
from fastapi import APIRouter, Query

from app.services.places_nearby_service import PlacesNearbyService
from app.utils.exceptions import AppException

router = APIRouter(tags=["Places"])


@router.get("/places/nearby")
async def search_nearby_places(
    category: str = Query(..., min_length=1),
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_meters: int = Query(5000, ge=10, le=50000),
    limit: int = Query(15, ge=1, le=50),
):
    try:
        results = await PlacesNearbyService.search_nearby_places(
            category=category,
            lat=lat,
            lng=lng,
            radius_meters=radius_meters,
            limit=limit,
        )
        return {"results": results}
    except Exception as exc:
        raise AppException.bad_request(f"Nearby search failed: {str(exc)}")
