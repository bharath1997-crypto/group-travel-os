from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.live_preview_actions import (
    LiveAddLocationRequest,
    LiveAddLocationResponse,
    LiveStartDirectionRequest,
    LiveStartDirectionResponse,
)
from app.services.live_preview_action_service import LivePreviewActionService
from app.utils.auth import get_current_user, get_current_user_optional
from app.utils.database import get_db

router = APIRouter(tags=["Live Preview Actions"])


@router.post(
    "/live/places/add-location",
    response_model=LiveAddLocationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Save a Live map place to the user's account",
)
def add_live_location(
    body: LiveAddLocationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LiveAddLocationResponse:
    return LivePreviewActionService.add_location(db, current_user, body)


@router.post(
    "/live/directions/start",
    response_model=LiveStartDirectionResponse,
    summary="Validate route and start a solo Live direction session",
)
async def start_live_direction(
    body: LiveStartDirectionRequest,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
) -> LiveStartDirectionResponse:
    return await LivePreviewActionService.start_direction(db, user, body)
