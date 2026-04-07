"""
app/routes/timers.py — Trip timer endpoints (RTDB-backed)

Routes are thin: accept request, call service, return response.
"""
import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.timer import StartTimerRequest
from app.services.timer_service import TimerService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(prefix="/trips", tags=["Timers"])


@router.post(
    "/{trip_id}/timer",
    status_code=status.HTTP_201_CREATED,
    summary="Start a trip timer",
)
def start_trip_timer(
    trip_id: uuid.UUID,
    data: StartTimerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return TimerService.start_timer(
        db,
        current_user.id,
        trip_id,
        data.duration_seconds,
    )


@router.get(
    "/{trip_id}/timer",
    status_code=status.HTTP_200_OK,
    summary="Get current trip timer state",
)
def get_trip_timer(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    state = TimerService.get_timer_state(db, current_user.id, trip_id)
    if state is None:
        return {"is_active": False}
    return state


@router.delete(
    "/{trip_id}/timer",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancel trip timer",
)
def cancel_trip_timer(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    TimerService.cancel_timer(db, current_user.id, trip_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
