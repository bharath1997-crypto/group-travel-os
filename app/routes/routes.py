"""Multi-modal route discovery (Kiwi + Google Routes)."""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.route import RouteSearchResponse
from app.services.route_service import RouteService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(prefix="/routes", tags=["routes"])


@router.get(
    "/search",
    response_model=RouteSearchResponse,
    summary="Compare flight and ground routes between two places",
)
async def search_multimodal_routes(
    origin: str = Query(..., min_length=1, description="Origin city or airport"),
    destination: str = Query(..., min_length=1, description="Destination city or airport"),
    date: date = Query(..., description="Travel date (outbound)"),
    adults: int = Query(1, ge=1, le=9),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await RouteService.search_routes(
        origin,
        destination,
        date,
        adults,
        db,
    )
