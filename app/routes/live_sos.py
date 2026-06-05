"""
app/routes/live_sos.py — Router for SOS Alerts (Phase 4)
"""
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.live import SOSRequest
from app.services.live_sos_service import LiveSOSService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(prefix="/trips", tags=["Live SOS"])


@router.post(
    "/{trip_id}/sos",
    status_code=status.HTTP_200_OK,
    summary="Trigger an emergency SOS alert to all group members",
)
def send_sos_alert(
    trip_id: uuid.UUID,
    payload: SOSRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    LiveSOSService.send_sos(
        db=db,
        user_id=current_user.id,
        trip_id=trip_id,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    return {"status": "success", "message": "SOS alert sent successfully"}
