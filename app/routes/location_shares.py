"""
app/routes/location_shares.py — Live location sharing endpoints

Routes are thin: accept request, call service, return response.
"""
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.location_share import (
    ActiveSharerOut,
    LocationShareOut,
    StartSharingRequest,
    UpdateLocationRequest,
)
from app.services.location_share_service import LocationShareService
from app.utils.auth import get_current_user
from app.utils.database import get_db
from app.utils.feature_gate import require_plan

router = APIRouter(prefix="/trips", tags=["Location Sharing"])


@router.post(
    "/{trip_id}/location/start",
    response_model=LocationShareOut,
    status_code=status.HTTP_201_CREATED,
    summary="Start sharing live location for a trip",
)
def start_location_sharing(
    trip_id: uuid.UUID,
    data: StartSharingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_plan("pass_3day")),
):
    return LocationShareService.start_sharing(
        db,
        current_user.id,
        trip_id,
        data.latitude,
        data.longitude,
    )


@router.put(
    "/{trip_id}/location/update",
    status_code=status.HTTP_200_OK,
    summary="Update shared coordinates",
)
def update_shared_location(
    trip_id: uuid.UUID,
    data: UpdateLocationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_plan("pass_3day")),
):
    LocationShareService.update_location(
        db,
        current_user.id,
        trip_id,
        data.latitude,
        data.longitude,
    )
    return {"detail": "Location updated"}


@router.post(
    "/{trip_id}/location/stop",
    status_code=status.HTTP_200_OK,
    summary="Stop sharing live location",
)
def stop_location_sharing(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_plan("pass_3day")),
):
    LocationShareService.stop_sharing(db, current_user.id, trip_id)
    return {"detail": "Location sharing stopped"}


@router.get(
    "/{trip_id}/location/members",
    response_model=list[ActiveSharerOut],
    status_code=status.HTTP_200_OK,
    summary="List members actively sharing location on a trip",
)
def list_active_sharers(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_plan("pass_3day")),
):
    sharers = LocationShareService.get_active_sharers(db, trip_id)
    return sharers
