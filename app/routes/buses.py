"""Curated bus search (Busbud affiliate placeholders)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.bus import BusSearchResponse
from app.services.bus_service import BusService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(prefix="/buses", tags=["buses"])


@router.get("/search", response_model=BusSearchResponse)
def search_buses(
    origin: str = Query(..., min_length=1),
    destination: str = Query(..., min_length=1),
    date: str = Query(..., min_length=10, max_length=10, description="YYYY-MM-DD"),
    adults: int = Query(1, ge=1, le=9),
    currency: str = Query("USD", min_length=3, max_length=3),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _ = db
    results = BusService.search_buses(origin, destination, date, adults, currency)
    
    return BusSearchResponse(
        origin=origin,
        destination=destination,
        date=date,
        results=results
    )
