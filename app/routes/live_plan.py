"""
app/routes/live_plan.py — Router for Trip Live Plan (Phase 4)
"""
from __future__ import annotations

import uuid
import datetime as dt
from typing import Any, List

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import select, delete
from sqlalchemy.orm import Session

from app.models.group import GroupMember
from app.models.live_plan import TripLivePlan
from app.models.trip import Trip
from app.models.user import User
from app.utils.auth import get_current_user
from app.utils.database import get_db
from app.utils.exceptions import AppException

router = APIRouter(prefix="/trips", tags=["Live Plan"])


class ActivityInput(BaseModel):
    time: str | None = None
    description: str


class DayPlanInput(BaseModel):
    day_number: int
    date: dt.date | None = None
    destination: str | None = None
    departure_time: str | None = None
    activities: List[ActivityInput] | None = None


class LivePlanCreate(BaseModel):
    days: List[DayPlanInput]


class DayPlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    day_number: int
    date: dt.date | None
    destination: str | None
    departure_time: dt.time | None
    activities: List[ActivityInput] | None


@router.post(
    "/{trip_id}/live-plan",
    status_code=status.HTTP_200_OK,
    summary="Save a live day-by-day plan for a trip",
)
def save_live_plan(
    trip_id: uuid.UUID,
    payload: LivePlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Verify trip existence
    trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
    if not trip:
        AppException.not_found("Trip not found")

    # 2. Verify group membership
    member = db.execute(
        select(GroupMember).where(
            GroupMember.group_id == trip.group_id,
            GroupMember.user_id == current_user.id,
        )
    ).scalar_one_or_none()
    if not member:
        AppException.forbidden("Not a member of this trip's group")

    # Only admins or coordinators can edit the plan
    if member.role not in ("admin", "coordinator"):
        AppException.forbidden("Only admins and coordinators can modify the live plan")

    # Delete existing days for this trip
    db.execute(delete(TripLivePlan).where(TripLivePlan.trip_id == trip_id))

    # Add new days
    for day in payload.days:
        dep_time = None
        if day.departure_time and day.departure_time.strip():
            try:
                # Expecting format HH:MM:SS or HH:MM
                parts = list(map(int, day.departure_time.split(":")))
                if len(parts) >= 2:
                    dep_time = dt.time(parts[0], parts[1])
            except Exception:
                pass

        acts_json = []
        if day.activities:
            acts_json = [act.model_dump() for act in day.activities]

        live_day = TripLivePlan(
            id=uuid.uuid4(),
            trip_id=trip_id,
            day_number=day.day_number,
            date=day.date,
            destination=day.destination,
            activities=acts_json,
            departure_time=dep_time,
        )
        db.add(live_day)

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        AppException.internal_server_error(f"Failed to save plan: {exc}")

    return {"status": "success", "message": "Trip plan saved"}


@router.get(
    "/{trip_id}/live-plan",
    response_model=List[DayPlanOut],
    status_code=status.HTTP_200_OK,
    summary="Get the live plan for a trip",
)
def get_live_plan(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify trip
    trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
    if not trip:
        AppException.not_found("Trip not found")

    # Verify group membership
    member = db.execute(
        select(GroupMember).where(
            GroupMember.group_id == trip.group_id,
            GroupMember.user_id == current_user.id,
        )
    ).scalar_one_or_none()
    if not member:
        AppException.forbidden("Not a member of this trip's group")

    days = db.execute(
        select(TripLivePlan)
        .where(TripLivePlan.trip_id == trip_id)
        .order_by(TripLivePlan.day_number.asc())
    ).scalars().all()

    return days
