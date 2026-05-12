"""Curated activity search (GetYourGuide affiliate placeholders)."""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.activity import ActivityResult
from app.services.activity_service import ActivityService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(prefix="/activities", tags=["activities"])


@router.get("/search", response_model=list[ActivityResult])
def search_activities(
    location: str = Query(..., min_length=1),
    date: date = Query(...),
    adults: int = Query(1, ge=1, le=9),
    category: str | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _ = db
    return ActivityService.search_activities(location, date, adults, category)
