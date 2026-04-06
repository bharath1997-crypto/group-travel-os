"""
app/routes/locations.py — Saved locations and trip–location endpoints

Routes are thin: accept request, call service, return response.
"""
import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.location import (
    AddToTripRequest,
    LocationCreate,
    LocationOut,
    LocationUpdate,
    TripLocationOut,
)
from app.services.location_service import LocationService
from app.utils.auth import get_current_user
from app.utils.database import get_db

locations_router = APIRouter(prefix="/locations", tags=["Locations"])

trip_locations_router = APIRouter(prefix="/trips", tags=["Locations"])


@locations_router.post(
    "",
    response_model=LocationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Save a new location",
)
def save_location(
    data: LocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    location = LocationService.save_location(db, data, current_user)
    return location


@locations_router.get(
    "",
    response_model=list[LocationOut],
    status_code=status.HTTP_200_OK,
    summary="List your saved locations",
)
def list_user_locations(
    category: str | None = Query(None),
    is_visited: bool | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    locations = LocationService.list_user_locations(
        db, current_user, category, is_visited
    )
    return locations


@locations_router.get(
    "/{location_id}",
    response_model=LocationOut,
    status_code=status.HTTP_200_OK,
    summary="Get a saved location by id",
)
def get_location(
    location_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    location = LocationService.get_location(db, location_id, current_user)
    return location


@locations_router.patch(
    "/{location_id}",
    response_model=LocationOut,
    status_code=status.HTTP_200_OK,
    summary="Update a saved location",
)
def update_location(
    location_id: uuid.UUID,
    data: LocationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    location = LocationService.update_location(db, location_id, data, current_user)
    return location


@locations_router.delete(
    "/{location_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a saved location",
)
def delete_location(
    location_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    LocationService.delete_location(db, location_id, current_user)


@trip_locations_router.post(
    "/{trip_id}/locations",
    response_model=TripLocationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a saved location to a trip",
)
def add_location_to_trip(
    trip_id: uuid.UUID,
    data: AddToTripRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = LocationService.add_to_trip(db, trip_id, data.location_id, current_user)
    return row


@trip_locations_router.get(
    "/{trip_id}/locations",
    response_model=list[LocationOut],
    status_code=status.HTTP_200_OK,
    summary="List locations on a trip",
)
def list_trip_locations(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    locations = LocationService.list_trip_locations(db, trip_id, current_user)
    return locations


@trip_locations_router.delete(
    "/{trip_id}/locations/{location_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a location from a trip",
)
def remove_location_from_trip(
    trip_id: uuid.UUID,
    location_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    LocationService.remove_from_trip(db, trip_id, location_id, current_user)
