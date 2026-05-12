"""Buddy trips API."""

from uuid import UUID

from fastapi import APIRouter, Body, Depends, Query, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.buddy import (
    BuddyJoinRead,
    BuddyJoinWrite,
    BuddyRespondWrite,
    BuddyTripCreate,
    BuddyTripRead,
)
from app.services.buddy_service import BuddyService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(prefix="/buddy", tags=["buddy"])


@router.post("/trips", response_model=BuddyTripRead, status_code=status.HTTP_201_CREATED)
def create_buddy_trip(
    body: BuddyTripCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BuddyTripRead:
    return BuddyService.create_buddy_trip(db, current_user, body)


@router.get("/trips", response_model=list[BuddyTripRead])
def list_buddy_trips(
    destination: str | None = Query(None),
    status: str | None = Query(None),
    mine: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[BuddyTripRead]:
    return BuddyService.list_buddy_trips(
        db,
        current_user,
        destination=destination,
        status=status,
        mine=mine,
    )


@router.get("/trips/{trip_id}", response_model=BuddyTripRead)
def get_buddy_trip_detail(
    trip_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> BuddyTripRead:
    return BuddyService.get_buddy_trip(db, trip_id)


@router.post("/trips/{trip_id}/join", response_model=BuddyJoinRead)
def request_join_buddy_trip(
    trip_id: UUID,
    body: BuddyJoinWrite = Body(default_factory=BuddyJoinWrite),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BuddyJoinRead:
    return BuddyService.request_to_join(db, current_user, trip_id, body)


@router.patch(
    "/trips/{trip_id}/requests/{request_id}",
    response_model=BuddyJoinRead,
)
def respond_buddy_join_request(
    trip_id: UUID,
    request_id: UUID,
    body: BuddyRespondWrite,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BuddyJoinRead:
    return BuddyService.respond_to_request(
        db,
        current_user,
        trip_id,
        request_id,
        body,
    )
