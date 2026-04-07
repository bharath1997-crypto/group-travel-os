"""
app/routes/meet_points.py — Meet point endpoints

Routes are thin: accept request, call service, return response.
"""
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.meet_point import (
    AttendanceRequest,
    MeetPointAttendanceOut,
    MeetPointOut,
    ProposeMeetPointRequest,
)
from app.services.meet_point_service import MeetPointService
from app.utils.auth import get_current_user
from app.utils.database import get_db

trip_meet_points_router = APIRouter(prefix="/trips", tags=["Meet Points"])
meet_points_router = APIRouter(prefix="/meet-points", tags=["Meet Points"])


@trip_meet_points_router.post(
    "/{trip_id}/meet-points",
    response_model=MeetPointOut,
    status_code=status.HTTP_201_CREATED,
    summary="Propose a meet point for a trip",
)
def propose_meet_point(
    trip_id: uuid.UUID,
    data: ProposeMeetPointRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return MeetPointService.propose_meet_point(
        db,
        current_user.id,
        trip_id,
        data.name,
        data.latitude,
        data.longitude,
        data.address,
        data.meet_at,
        data.location_id,
    )


@trip_meet_points_router.get(
    "/{trip_id}/meet-points",
    response_model=list[MeetPointOut],
    status_code=status.HTTP_200_OK,
    summary="List meet points for a trip",
)
def list_trip_meet_points(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return MeetPointService.get_trip_meet_points(db, current_user.id, trip_id)


@trip_meet_points_router.patch(
    "/{trip_id}/meet-points/{meet_point_id}/official",
    response_model=MeetPointOut,
    status_code=status.HTTP_200_OK,
    summary="Set a meet point as the official one for the trip",
)
def set_official_meet_point(
    trip_id: uuid.UUID,
    meet_point_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return MeetPointService.set_as_official(
        db,
        current_user.id,
        trip_id,
        meet_point_id,
    )


@meet_points_router.patch(
    "/{meet_point_id}/confirm",
    response_model=MeetPointAttendanceOut,
    status_code=status.HTTP_200_OK,
    summary="Confirm or decline attendance for a meet point",
)
def confirm_meet_point_attendance(
    meet_point_id: uuid.UUID,
    data: AttendanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return MeetPointService.confirm_attendance(
        db,
        current_user.id,
        meet_point_id,
        data.status,
    )
