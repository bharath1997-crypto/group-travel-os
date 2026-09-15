from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.live_place_reports import (
    LivePlaceReportCreateRequest,
    LivePlaceReportCreateResponse,
    LivePlaceReportNearbyResponse,
)
from app.services.live_place_report_service import LivePlaceReportService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(tags=["Live Place Reports"])


@router.post(
    "/live/place-reports",
    response_model=LivePlaceReportCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a place vibe report (L2 Reports)",
)
def create_live_place_report(
    body: LivePlaceReportCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LivePlaceReportCreateResponse:
    return LivePlaceReportService.create_report(db, current_user, body)


@router.get(
    "/live/place-reports/nearby",
    response_model=LivePlaceReportNearbyResponse,
    summary="List active place reports near a map point",
)
def list_nearby_live_place_reports(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_m: float = Query(2500.0, ge=100, le=15000, alias="radiusM"),
    db: Session = Depends(get_db),
) -> LivePlaceReportNearbyResponse:
    return LivePlaceReportService.list_nearby(db, lat, lng, radius_m=radius_m)
