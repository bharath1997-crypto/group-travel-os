import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.live_group import (
    LiveCastVoteRequest,
    LiveCreateVotePollRequest,
    LiveFirebaseTokenResponse,
    LiveStartGroupConvergeRequest,
    LiveStartGroupConvergeResponse,
    LiveVotePanelOut,
)
from app.services.live_group_service import LiveGroupService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(tags=["Live Group"])


@router.get(
    "/live/firebase-token",
    response_model=LiveFirebaseTokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Issue a Firebase custom token for Live RTDB access",
)
def get_live_firebase_token(
    current_user: User = Depends(get_current_user),
) -> LiveFirebaseTokenResponse:
    return LiveGroupService.get_firebase_token(current_user)


@router.post(
    "/live/group/converge/start",
    response_model=LiveStartGroupConvergeResponse,
    status_code=status.HTTP_200_OK,
    summary="Start a group converge Live session for a trip",
)
def start_group_converge(
    body: LiveStartGroupConvergeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LiveStartGroupConvergeResponse:
    return LiveGroupService.start_group_converge(db, current_user, body)


@router.get(
    "/live/trips/{trip_id}/vote-panel",
    response_model=LiveVotePanelOut,
    status_code=status.HTTP_200_OK,
    summary="Get the active Live group vote panel for a trip",
)
def get_live_vote_panel(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LiveVotePanelOut:
    return LiveGroupService.get_vote_panel(db, trip_id, current_user)


@router.post(
    "/live/trips/{trip_id}/vote-panel",
    response_model=LiveVotePanelOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a destination vote poll from Live",
)
def create_live_vote_poll(
    trip_id: uuid.UUID,
    body: LiveCreateVotePollRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LiveVotePanelOut:
    return LiveGroupService.create_vote_poll(db, trip_id, current_user, body)


@router.post(
    "/live/polls/{poll_id}/vote",
    response_model=LiveVotePanelOut,
    status_code=status.HTTP_200_OK,
    summary="Cast a vote on a Live group poll",
)
def cast_live_poll_vote(
    poll_id: uuid.UUID,
    body: LiveCastVoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LiveVotePanelOut:
    return LiveGroupService.cast_vote(db, poll_id, body.optionId, current_user)
