"""
app/routes/geocoding.py — Nominatim geocoding proxy (no auth)
"""
from fastapi import APIRouter, Query

from app.services.geocoding_service import GeocodingService

router = APIRouter(tags=["Geocoding"])


@router.get("/geocoding/search")
async def search_address(
    q: str = Query(..., min_length=1),
    lat: float | None = Query(None, ge=-90, le=90),
    lng: float | None = Query(None, ge=-180, le=180),
):
    return await GeocodingService.search_address(q, lat=lat, lng=lng)


@router.get("/geocoding/reverse")
async def reverse_geocode(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
):
    result = await GeocodingService.reverse_geocode(lat, lng)
    return result if result else {}
