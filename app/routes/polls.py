"""
app/routes/polls.py — Poll endpoints

Routes are thin: accept request, call service, return response.
"""
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.poll import (
    CastVoteRequest,
    PollCreate,
    PollCreateWithTrip,
    PollOut,
    PollResolveRequest,
    PollResultsOut,
    poll_results_to_out,
    poll_to_out,
)
from app.dependencies.actor import ActorContext, get_current_actor
from app.dependencies.authz import require_trip_admin
from app.services.poll_service import PollService
from app.utils.auth import get_current_user
from app.utils.database import get_db

trip_polls_router = APIRouter(prefix="/trips", tags=["Polls"])

polls_router = APIRouter(prefix="/polls", tags=["Polls"])


@polls_router.post(
    "",
    response_model=PollOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a poll on a trip (includes trip_id in body)",
)
def create_poll_for_trip(
    data: PollCreateWithTrip,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    poll = PollService.create_poll(
        db,
        data.trip_id,
        data.question,
        data.poll_type,
        [o.model_dump() for o in data.options],
        data.closes_at,
        current_user,
    )
    return poll_to_out(poll)


@trip_polls_router.post(
    "/{trip_id}/polls",
    response_model=PollOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a poll on a trip",
)
def create_poll(
    trip_id: uuid.UUID,
    data: PollCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    poll = PollService.create_poll(
        db,
        trip_id,
        data.question,
        data.poll_type,
        [o.model_dump() for o in data.options],
        data.closes_at,
        current_user,
    )
    return poll_to_out(poll)


@trip_polls_router.get(
    "/{trip_id}/polls",
    response_model=list[PollOut],
    status_code=status.HTTP_200_OK,
    summary="List polls for a trip",
)
def list_trip_polls(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    polls = PollService.list_trip_polls(db, trip_id, current_user)
    return [poll_to_out(p) for p in polls]


@polls_router.get(
    "/{poll_id}",
    response_model=PollOut,
    status_code=status.HTTP_200_OK,
    summary="Get a poll by id",
)
def get_poll(
    poll_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    poll = PollService.get_poll(db, poll_id, current_user)
    return poll_to_out(poll)


@polls_router.post(
    "/{poll_id}/vote",
    response_model=PollOut,
    status_code=status.HTTP_200_OK,
    summary="Cast a vote on a poll",
)
def cast_vote(
    poll_id: uuid.UUID,
    data: CastVoteRequest,
    db: Session = Depends(get_db),
    actor: ActorContext = Depends(get_current_actor),
):
    poll = PollService.cast_vote(db, poll_id, data.option_id, actor)
    return poll_to_out(poll)


@polls_router.patch(
    "/{poll_id}/resolve",
    response_model=PollOut,
    status_code=status.HTTP_200_OK,
    summary="Resolve a closed poll and record the winning option",
)
def resolve_poll(
    poll_id: uuid.UUID,
    data: PollResolveRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_trip_admin),
):
    body = data or PollResolveRequest()
    poll = PollService.resolve_poll(db, poll_id, current_user, option_id=body.option_id)
    return poll_to_out(poll)


@polls_router.patch(
    "/{poll_id}/close",
    response_model=PollOut,
    status_code=status.HTTP_200_OK,
    summary="Close a poll",
)
def close_poll(
    poll_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    poll = PollService.close_poll(db, poll_id, current_user)
    return poll_to_out(poll)


@polls_router.get(
    "/{poll_id}/results",
    response_model=PollResultsOut,
    status_code=status.HTTP_200_OK,
    summary="Get poll results with vote counts",
)
def get_poll_results(
    poll_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = PollService.get_poll_results(db, poll_id, current_user)
    return poll_results_to_out(data)
