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
from app.services.trip_service import TripService
from app.utils.auth import get_current_user
from app.utils.database import get_db

group_trips_router = APIRouter(prefix="/groups/{group_id}/trips", tags=["Trips"])

trips_router = APIRouter(prefix="/trips", tags=["Trips"])


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
