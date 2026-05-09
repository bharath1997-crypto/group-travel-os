from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.services.explorer.explorer_service import explorer_service
from app.utils.database import get_db

router = APIRouter(prefix="/explorer", tags=["Explorer (New)"])


@router.get("/live-feed", status_code=status.HTTP_200_OK)
async def get_explorer_live_feed(
    lat: float = Query(..., description="Latitude of the location"),
    lon: float = Query(..., description="Longitude of the location"),
    radius: int = Query(10000, description="Search radius in meters (default 10km)"),
    db: Session = Depends(get_db),
):
    """
    Get the live destination feed for a location.
    
    This endpoint is part of the new, isolated Explorer architecture.
    It aggregates data from multiple providers, deduplicates them, 
    and returns a ranked feed of experiences.
    """
    return await explorer_service.get_feed(lat, lon, radius, db)
