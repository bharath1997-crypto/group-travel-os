"""
app/routes/users.py — User-scoped endpoints (balance, flight-alert preferences, etc.)
"""
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.flight_preferences import FlightPreferencesRead, FlightPreferencesWrite
from app.services.group_service import GroupService
from app.services.user_flight_preference_service import UserFlightPreferenceService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(tags=["Users"])


@router.get("/users/me/flight-preferences", response_model=FlightPreferencesRead)
def get_my_flight_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FlightPreferencesRead:
    return UserFlightPreferenceService.get_flight_preferences(db, current_user)


@router.patch("/users/me/flight-preferences", response_model=FlightPreferencesRead)
def patch_my_flight_preferences(
    body: FlightPreferencesWrite,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FlightPreferencesRead:
    return UserFlightPreferenceService.update_flight_preferences(
        db, current_user, body
    )


@router.get(
    "/users/{other_user_id}/balance",
    status_code=status.HTTP_200_OK,
    summary="Net expense balance with another user across shared groups",
)
def get_user_balance(
    other_user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return GroupService.get_balance_with_user(db, current_user.id, other_user_id)
