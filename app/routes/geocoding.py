"""
app/routes/geocoding.py — Nominatim geocoding proxy (no auth)
"""
from fastapi import APIRouter, Query

from app.schemas.place_name_display import PlaceNameDisplayResponse
from app.services.geocoding_service import GeocodingService
from app.services.place_name_translation_service import PlaceNameTranslationService

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
    if not result:
        return {}

    addr = result.get("address", {})
    city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("hamlet") or addr.get("suburb")
    state = addr.get("state")
    country = addr.get("country")
    name = result.get("name") or addr.get("road") or result.get("display_name", "").split(",")[0] or "Address"

    # Construct stable placeKey
    from app.services.place_key_service import build_place_key
    place_key = build_place_key(
        name=name,
        lat=lat,
        lng=lng,
        city=city,
        country=country,
        osm_type=result.get("osm_type"),
        osm_id=result.get("osm_id")
    )

    return {
        "name": name,
        "address": addr,
        "display_name": result.get("display_name"),
        "lat": lat,
        "lng": lng,
        "city": city,
        "state": state,
        "country": country,
        "placeKey": place_key,
        "source": "nominatim",
        # Legacy compatibility for test assertions
        "extratags": result.get("extratags", {}),
    }


@router.get("/geocoding/display-name", response_model=PlaceNameDisplayResponse)
async def resolve_place_display_name(
    name: str = Query(..., min_length=1, max_length=500),
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    osm_type: str | None = Query(None, max_length=32),
    osm_id: int | None = Query(None),
    country: str | None = Query(None, max_length=120),
):
    result = await PlaceNameTranslationService.resolve_display_name(
        name=name,
        lat=lat,
        lng=lng,
        osm_type=osm_type,
        osm_id=osm_id,
        country=country,
    )
    return PlaceNameDisplayResponse.model_validate(result)
