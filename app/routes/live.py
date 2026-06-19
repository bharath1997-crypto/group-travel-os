"""
Live coordination API.

``GET /live/trips/{trip_id}/session`` returns the open session for a trip so UUIDs are
never ambiguous with ``/live/sessions/{session_id}/...``.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from pydantic import BaseModel, Field

from app.models.user import User
from app.schemas.live import (
    AssignCoordinatorBody,
    LiveChecklistItemOut,
    LiveMeetPointBody,
    LiveSessionCreate,
    LiveSessionOut,
    MyActiveLiveOut,
    QuickStatusBody,
    UpcomingTripOut,
)
from app.services.live_session_service import LiveSessionService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(prefix="/live", tags=["Live"])


class JoinByCodeBody(BaseModel):
    session_code: str = Field(..., min_length=8, max_length=8)


@router.get(
    "/upcoming-trips",
    response_model=list[UpcomingTripOut],
    status_code=status.HTTP_200_OK,
)
def list_upcoming_live_trips(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    raw = LiveSessionService.list_upcoming_trips(db, current_user.id)
    return [UpcomingTripOut.model_validate(r) for r in raw]


@router.get("/my-active-session", response_model=MyActiveLiveOut)
def my_active_live_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = LiveSessionService.my_active_session(db, current_user.id)
    if not row:
        return MyActiveLiveOut(active=False, member_count=0)
    return MyActiveLiveOut(
        active=True,
        session_id=uuid.UUID(row["session_id"]),
        trip_id=uuid.UUID(row["trip_id"]),
        status=row["status"],
        member_count=row["member_count"],
    )


@router.post("/sessions", response_model=LiveSessionOut, status_code=status.HTTP_201_CREATED)
def create_live_session(
    data: LiveSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveSessionService.create_session(db, data.trip_id, current_user.id, data.mode)


@router.get("/trips/{trip_id}/session", response_model=LiveSessionOut | None)
def get_live_session_for_trip(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveSessionService.session_for_trip(db, trip_id, current_user.id)


@router.post("/sessions/join-by-code", response_model=LiveSessionOut)
def join_live_by_code(
    body: JoinByCodeBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveSessionService.join_by_code(db, body.session_code, current_user.id)


@router.post("/sessions/{session_id}/join", response_model=LiveSessionOut)
def join_live_session(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveSessionService.join_session(db, session_id, current_user.id)


@router.post("/sessions/{session_id}/checklist/accept")
def accept_live_checklist(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveSessionService.accept_checklist(db, session_id, current_user.id)


@router.get("/sessions/{session_id}/checklist", response_model=list[LiveChecklistItemOut])
def list_live_checklist(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pairs = LiveSessionService.checklist_rows(db, session_id, current_user.id)
    return [
        LiveChecklistItemOut(
            user_id=chk.user_id,
            is_accepted=chk.is_accepted,
            accepted_at=chk.accepted_at,
            full_name=user.full_name if user else None,
            avatar_url=user.avatar_url if user else None,
        )
        for chk, user in pairs
    ]


@router.post("/sessions/{session_id}/end")
def end_live_session(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveSessionService.end_session(db, session_id, current_user.id)


@router.post("/sessions/{session_id}/coordinator")
def assign_coordinator_for_live_session(
    session_id: uuid.UUID,
    body: AssignCoordinatorBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return LiveSessionService.assign_coordinator(
        db, session_id, body.user_id, current_user
    )


@router.post(
    "/trips/{trip_id}/meet-point",
    status_code=status.HTTP_204_NO_CONTENT,
)
def live_set_meet_point(
    trip_id: uuid.UUID,
    body: LiveMeetPointBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    LiveSessionService.set_meet_point_rtdb(
        db, trip_id, current_user.id, body.lat, body.lng, body.name
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/trips/{trip_id}/quick-status", status_code=status.HTTP_204_NO_CONTENT)
def live_quick_status(
    trip_id: uuid.UUID,
    body: QuickStatusBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    LiveSessionService.set_quick_status(db, trip_id, current_user.id, body.status)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/trips/{trip_id}/timer-ended", status_code=status.HTTP_204_NO_CONTENT)
def live_timer_ended_notification(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    LiveSessionService.notify_timer_ended(db, trip_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/sessions/{session_id}/group-formed", status_code=status.HTTP_204_NO_CONTENT)
def live_group_formed_notification(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    LiveSessionService.notify_group_formed(db, session_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
