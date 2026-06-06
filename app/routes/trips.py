"""
app/routes/trips.py — Trip endpoints

Routes are thin: accept request, call service, return response.
"""
import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.models.trip import TripStatus
from app.models.user import User
from app.schemas.trip import TripCreate, TripOut, TripStatusUpdate, TripUpdate
from app.schemas.trip_item import TripItemCreate, TripItemOut, TripListOut
from app.schemas.trip_public import (
    PendingTripJoinOut,
    TripJoinRequestCreate,
    TripJoinRequestOut,
    TripPublicPreviewOut,
    TripRosterUpdate,
)
from app.services.trip_join_request_service import TripJoinRequestService
from app.services.trip_public_service import TripPublicService
from app.services.trip_service import TripService
from app.utils.auth import get_current_user, get_current_user_optional
from app.utils.database import get_db

group_trips_router = APIRouter(prefix="/groups/{group_id}/trips", tags=["Trips"])

trips_router = APIRouter(prefix="/trips", tags=["Trips"])


@trips_router.get(
    "",
    response_model=list[TripListOut],
    status_code=status.HTTP_200_OK,
    summary="List all trips for the current user",
)
def list_my_trips(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = TripService.list_user_trips(db, current_user)
    out: list[TripListOut] = []
    for trip, group_name in rows:
        out.append(
            TripListOut(
                id=trip.id,
                group_id=trip.group_id,
                group_name=group_name,
                title=trip.title,
                description=trip.description,
                status=trip.status.value,
                start_date=trip.start_date.isoformat() if trip.start_date else None,
                end_date=trip.end_date.isoformat() if trip.end_date else None,
                created_by=trip.created_by,
                created_at=trip.created_at,
                updated_at=trip.updated_at,
            )
        )
    return out


@trips_router.post(
    "/{trip_id}/items",
    response_model=TripItemOut,
    status_code=status.HTTP_201_CREATED,
    summary="Save an explore event to a trip",
)
def add_trip_item(
    trip_id: uuid.UUID,
    data: TripItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = TripService.add_trip_item(db, trip_id, data, current_user)
    return TripItemOut.model_validate(result)


@group_trips_router.post(
    "",
    response_model=TripOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a trip in a group",
)
def create_trip(
    group_id: uuid.UUID,
    data: TripCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = TripService.create_trip(db, group_id, data, current_user)
    return trip


@group_trips_router.get(
    "",
    response_model=list[TripOut],
    status_code=status.HTTP_200_OK,
    summary="List trips for a group",
)
def list_group_trips(
    group_id: uuid.UUID,
    status: TripStatus | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trips = TripService.list_group_trips(db, group_id, current_user, status)
    return trips


@trips_router.get(
    "/{trip_id}/public",
    response_model=TripPublicPreviewOut,
    status_code=status.HTTP_200_OK,
    summary="Public trip preview (share link); optional auth for membership flags",
)
def get_trip_public(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    viewer: User | None = Depends(get_current_user_optional),
):
    raw = TripPublicService.get_public_preview(
        db,
        trip_id,
        viewer.id if viewer else None,
    )
    return TripPublicPreviewOut.model_validate(raw)


@trips_router.patch(
    "/{trip_id}/roster",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Set your public trip note (group members only)",
)
def set_trip_roster(
    trip_id: uuid.UUID,
    data: TripRosterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    TripService.set_roster_note(db, trip_id, current_user.id, data.note)


@trips_router.post(
    "/{trip_id}/join-requests",
    response_model=TripJoinRequestOut,
    status_code=status.HTTP_201_CREATED,
    summary="Request to join this trip’s group",
)
def create_trip_join_request(
    trip_id: uuid.UUID,
    body: TripJoinRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    req = TripJoinRequestService.request_join(
        db, trip_id, current_user.id, body.message
    )
    return TripJoinRequestOut(
        id=str(req.id),
        trip_id=str(req.trip_id),
        user_id=str(req.user_id),
        message=req.message,
        status=req.status,
    )


@trips_router.get(
    "/{trip_id}/join-requests",
    response_model=list[PendingTripJoinOut],
    status_code=status.HTTP_200_OK,
    summary="List pending trip join requests (group admins)",
)
def list_trip_join_requests(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = TripJoinRequestService.list_pending_for_trip(db, trip_id, current_user.id)
    return [
        PendingTripJoinOut(
            id=str(req.id),
            trip_id=str(req.trip_id),
            user_id=str(req.user_id),
            message=req.message,
            status=req.status,
            created_at=req.created_at.isoformat(),
            user_full_name=user.full_name,
            user_email=user.email,
        )
        for req, user in rows
    ]


@trips_router.patch(
    "/join-requests/{request_id}/approve",
    response_model=TripJoinRequestOut,
    status_code=status.HTTP_200_OK,
    summary="Approve a trip join request (group admin)",
)
def approve_trip_join_request(
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    req = TripJoinRequestService.approve_request(db, request_id, current_user.id)
    return TripJoinRequestOut(
        id=str(req.id),
        trip_id=str(req.trip_id),
        user_id=str(req.user_id),
        message=req.message,
        status=req.status,
    )


@trips_router.patch(
    "/join-requests/{request_id}/deny",
    response_model=TripJoinRequestOut,
    status_code=status.HTTP_200_OK,
    summary="Deny a trip join request (group admin)",
)
def deny_trip_join_request(
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    req = TripJoinRequestService.deny_request(db, request_id, current_user.id)
    return TripJoinRequestOut(
        id=str(req.id),
        trip_id=str(req.trip_id),
        user_id=str(req.user_id),
        message=req.message,
        status=req.status,
    )


@trips_router.get(
    "/{trip_id}",
    response_model=TripOut,
    status_code=status.HTTP_200_OK,
    summary="Get a trip by id",
)
def get_trip(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = TripService.get_trip(db, trip_id, current_user)
    from sqlalchemy import select
    from app.models.group import GroupMember
    member = db.execute(
        select(GroupMember).where(
            GroupMember.group_id == trip.group_id,
            GroupMember.user_id == current_user.id,
        )
    ).scalar_one_or_none()
    trip.my_role = member.role.value if member else "member"
    return trip


@trips_router.patch(
    "/{trip_id}",
    response_model=TripOut,
    status_code=status.HTTP_200_OK,
    summary="Update a trip",
)
def update_trip(
    trip_id: uuid.UUID,
    data: TripUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = TripService.update_trip(db, trip_id, data, current_user)
    return trip


@trips_router.delete(
    "/{trip_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a trip",
)
def delete_trip(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    TripService.delete_trip(db, trip_id, current_user)


@trips_router.patch(
    "/{trip_id}/status",
    response_model=TripOut,
    status_code=status.HTTP_200_OK,
    summary="Change trip status",
)
def change_trip_status(
    trip_id: uuid.UUID,
    data: TripStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = TripService.change_status(db, trip_id, data.status, current_user)
    return trip


@trips_router.post(
    "/{trip_id}/plan",
    status_code=status.HTTP_200_OK,
    summary="Save trip plan",
)
def save_trip_plan(
    trip_id: uuid.UUID,
    plan_json: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import select
    from app.services.timer_service import TimerService
    from app.models.trip_plan import TripPlan
    from app.utils.exceptions import AppException

    TimerService._verify_membership(db, current_user.id, trip_id)

    plan = db.execute(select(TripPlan).where(TripPlan.trip_id == trip_id)).scalar_one_or_none()
    if plan:
        plan.plan_json = plan_json
    else:
        plan = TripPlan(trip_id=trip_id, plan_json=plan_json)
        db.add(plan)

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        AppException.internal(f"Could not save trip plan: {exc}")

    return {"status": "success", "message": "Trip plan saved"}


@trips_router.get(
    "/{trip_id}/plan",
    status_code=status.HTTP_200_OK,
    summary="Get trip plan",
)
def get_trip_plan(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import select
    from app.services.timer_service import TimerService
    from app.models.trip_plan import TripPlan

    TimerService._verify_membership(db, current_user.id, trip_id)

    plan = db.execute(select(TripPlan).where(TripPlan.trip_id == trip_id)).scalar_one_or_none()
    if not plan:
        return {"days": []}
    return plan.plan_json

