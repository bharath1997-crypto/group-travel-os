"""Persist authenticated user flight-alert preferences."""

from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.flight_preferences import (
    FlightPreferencesRead,
    FlightPreferencesWrite,
    coerce_and_validate_iata,
)
from app.utils.exceptions import AppException


class UserFlightPreferenceService:
    """Routes delegate here — no FastAPI-facing logic duplicated in routers."""

    @staticmethod
    def get_flight_preferences(_db: Session, user: User) -> FlightPreferencesRead:
        return FlightPreferencesRead(
            home_airport=user.home_airport,
            deal_price_threshold=user.deal_price_threshold,
            deal_alerts_enabled=bool(user.deal_alerts_enabled),
        )

    @staticmethod
    def update_flight_preferences(
        db: Session,
        user: User,
        body: FlightPreferencesWrite,
    ) -> FlightPreferencesRead:
        iata = coerce_and_validate_iata(body.home_airport)
        if iata is None:
            AppException.unprocessable(
                "home_airport must be exactly 3 uppercase letters (IATA code)",
            )
        user.home_airport = iata
        user.deal_price_threshold = float(body.deal_price_threshold)
        user.deal_alerts_enabled = bool(body.deal_alerts_enabled)
        db.commit()
        db.refresh(user)
        return FlightPreferencesRead(
            home_airport=user.home_airport,
            deal_price_threshold=user.deal_price_threshold,
            deal_alerts_enabled=bool(user.deal_alerts_enabled),
        )
