"""
app/routes/places.py — Endpoint for searching nearby points of interest.
"""
from fastapi import APIRouter, Query

from app.schemas.places import PlaceResolveRequest, PlaceResolveResponse
from app.services.places_nearby_service import PlacesNearbyService
from app.services.place_wikipedia_service import PlaceWikipediaService
from app.services.place_autocomplete_service import PlaceAutocompleteService
from app.utils.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends
from app.utils.exceptions import AppException

import logging
logger = logging.getLogger(__name__)

router = APIRouter(tags=["Places"])

@router.get("/search/places")
async def search_places(
    q: str = Query(..., min_length=2),
    lat: float | None = Query(None, ge=-90, le=90),
    lng: float | None = Query(None, ge=-180, le=180),
    radius_km: float = Query(10.0, ge=0.1, le=50),
    limit: int = Query(8, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    logger.info(
        "[Rovvy Search Audit] Search endpoint hit. Query: %s, Latitude: %s, Longitude: %s, Radius: %s km, Limit: %s",
        q, lat, lng, radius_km, limit
    )
    try:
        results = await PlaceAutocompleteService.search_places(
            db=db,
            q=q,
            lat=lat,
            lng=lng,
            radius_km=radius_km,
            limit=limit,
        )
        logger.info(
            "[Rovvy Search Audit] Search endpoint success. Found %d results.",
            len(results) if results else 0
        )
        return {"results": results}
    except Exception as exc:
        logger.error("[Rovvy Search Audit] Search endpoint failed: %s", exc)
        raise AppException.bad_request(f"Place search failed: {str(exc)}")


@router.get("/places/autocomplete")
async def get_places_autocomplete(
    q: str = Query(..., min_length=2),
    lat: float | None = Query(None, ge=-90, le=90),
    lng: float | None = Query(None, ge=-180, le=180),
    limit: int = Query(10, ge=1, le=20),
    radius_meters: int = Query(25000, ge=10),
    mode: str | None = Query(None),
    db: AsyncSession = Depends(get_db)
):
    try:
        results = await PlaceAutocompleteService.autocomplete(
            db=db,
            q=q,
            lat=lat,
            lng=lng,
            limit=limit,
            radius_meters=radius_meters
        )
        return {"results": results}
    except Exception as exc:
        raise AppException.bad_request(f"Autocomplete failed: {str(exc)}")


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


@router.post("/places/resolve-click", response_model=PlaceResolveResponse)
async def resolve_click(request: PlaceResolveRequest):
    try:
        res = await PlacesNearbyService.resolve_click(
            lat=request.lat,
            lng=request.lng,
            clicked_name=request.clickedName,
            feature_properties=request.featureProperties,
            radius_meters=request.radiusMeters,
        )
        return res
    except Exception as exc:
        raise AppException.bad_request(f"Click resolution failed: {str(exc)}")


@router.get("/places/wiki-summary")
async def get_wiki_summary(
    name: str = Query(..., min_length=1),
    category: str = Query(..., min_length=1),
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    wikidata_id: str | None = None,
    wikipedia_title: str | None = None,
):
    try:
        return await PlaceWikipediaService.get_wiki_summary(
            name=name,
            category=category,
            lat=lat,
            lng=lng,
            wikidata_id=wikidata_id,
            wikipedia_title=wikipedia_title,
        )
    except Exception as exc:
        raise AppException.bad_request(f"Wikipedia lookup failed: {str(exc)}")

