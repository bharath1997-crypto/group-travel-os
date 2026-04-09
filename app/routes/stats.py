"""
app/routes/stats.py — User travel aggregates

Routes are thin: accept request, call service, return response.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.stats_service import StatsService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(prefix="/users", tags=["stats"])


class TravelStatsOut(BaseModel):
    trips_created: int
    groups_joined: int
    locations_saved: int
    expenses_paid: int
    polls_created: int
    countries_from_trips: list[str]


@router.get("/me/travel-stats", response_model=TravelStatsOut, summary="Current user travel statistics")
def get_my_travel_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return StatsService.get_travel_stats(db, current_user.id)
