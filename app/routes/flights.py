"""Authenticated flight search (Kiwi Tequila via FlightService)."""

from datetime import date

from fastapi import APIRouter, Depends, Query

from app.models.user import User
from app.schemas.flight import FlightResult
from app.services.flight_service import FlightService
from app.utils.auth import get_current_user
from app.utils.exceptions import AppException

router = APIRouter(prefix="/flights", tags=["flights"])


@router.get("/search", response_model=list[FlightResult], summary="Search flights (Kiwi)")
def search_flights(
    fly_from: str = Query(..., min_length=2, description="Origin airport / city code"),
    fly_to: str = Query(..., min_length=2, description="Destination airport / city code"),
    date_from: date = Query(..., description="Outbound search start"),
    date_to: date = Query(..., description="Outbound search end"),
    adults: int = Query(1, ge=1, le=9),
    currency: str = Query("USD", min_length=3, max_length=3),
    cabins: str = Query("M", min_length=1, max_length=1),
    return_from: date | None = Query(None, description="Return leg start (round trip)"),
    return_to: date | None = Query(None, description="Return leg end (round trip)"),
    _: User = Depends(get_current_user),
):
    rf = return_from
    rt = return_to
    if (rf is None) ^ (rt is None):
        AppException.unprocessable(
            "Provide both return_from and return_to, or omit return dates",
        )
    return FlightService.search_flights(
        fly_from=fly_from,
        fly_to=fly_to,
        date_from=date_from,
        date_to=date_to,
        adults=adults,
        currency=currency.upper(),
        cabins=cabins.upper(),
        return_from=rf,
        return_to=rt,
    )
