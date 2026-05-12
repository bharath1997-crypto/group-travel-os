"""Curated hotel search (Agoda affiliate placeholders)."""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.hotel import HotelResult
from app.services.hotel_service import HotelService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(prefix="/hotels", tags=["hotels"])


@router.get("/search", response_model=list[HotelResult])
def search_hotels(
    location: str = Query(..., min_length=1),
    check_in: date = Query(...),
    check_out: date = Query(...),
    adults: int = Query(1, ge=1, le=9),
    rooms: int = Query(1, ge=1, le=9),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _ = db
    return HotelService.search_hotels(location, check_in, check_out, adults, rooms)
