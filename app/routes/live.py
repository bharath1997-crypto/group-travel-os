"""
app/routes/live.py — Live session and road report endpoints

Routes are thin: accept request, call service, return response.
"""
import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.live import (
    LiveSessionCreate,
    LiveSessionOut,
    NearbyReportsQuery,
    ReportConfirmBody,
    RoadReportCreate,
    RoadReportOut,
)
from app.services.live_service import LiveService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(prefix="/live", tags=["Live"])


@router.post(
    "/session/start",
    response_model=LiveSessionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Start a live session",
)
def start_live_session(
    data: LiveSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveService.start_session(
        db,
        current_user.id,
        data.trip_id,
        data.mode,
    )


@router.post(
    "/session/{session_id}/end",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="End a live session",
)
def end_live_session(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    LiveService.end_session(db, current_user.id, session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/reports",
    response_model=RoadReportOut,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a road report",
)
def submit_road_report(
    data: RoadReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveService.submit_report(db, current_user.id, data)


@router.get(
    "/reports/nearby",
    response_model=list[RoadReportOut],
    status_code=status.HTTP_200_OK,
    summary="Get nearby active road reports",
)
def get_nearby_road_reports(
    query: NearbyReportsQuery = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveService.get_nearby_reports(
        db,
        query.lat,
        query.lng,
        query.radius_km,
    )


@router.post(
    "/reports/{report_id}/confirm",
    response_model=RoadReportOut,
    status_code=status.HTTP_200_OK,
    summary="Confirm or dismiss a road report",
)
def confirm_road_report(
    report_id: uuid.UUID,
    body: ReportConfirmBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveService.confirm_report(
        db,
        current_user.id,
        report_id,
        body.action,
    )
