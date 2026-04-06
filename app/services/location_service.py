"""
app/services/location_service.py — Saved locations and trip–location links

Rules:
- Session is always injected — never created here
- All errors raised via AppException
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.location import Location, TripLocation
from app.models.trip import Trip
from app.models.user import User
from app.services.trip_service import TripService
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)


def _location_update_payload(data: Any) -> dict[str, Any]:
    if hasattr(data, "model_dump"):
        return data.model_dump(exclude_unset=True)
    if isinstance(data, dict):
        return dict(data)
    out: dict[str, Any] = {}
    for key in ("notes", "is_visited", "category"):
        if hasattr(data, key):
            out[key] = getattr(data, key)
    return out


class LocationService:

    @staticmethod
    def save_location(
        db: Session,
        data: Any,
        current_user: User,
    ) -> Location:
        location = Location(
            saved_by=current_user.id,
            name=getattr(data, "name"),
            address=getattr(data, "address", None),
            latitude=getattr(data, "latitude"),
            longitude=getattr(data, "longitude"),
            place_id=getattr(data, "place_id", None),
            category=getattr(data, "category", None),
            notes=getattr(data, "notes", None),
        )
        db.add(location)
        db.commit()
        db.refresh(location)
        logger.info("Location saved: %s by user %s", location.id, current_user.id)
        return location

    @staticmethod
    def list_user_locations(
        db: Session,
        current_user: User,
        category: str | None = None,
        is_visited: bool | None = None,
    ) -> list[Location]:
        stmt = select(Location).where(Location.saved_by == current_user.id)
        if category is not None:
            stmt = stmt.where(Location.category == category)
        if is_visited is not None:
            stmt = stmt.where(Location.is_visited == is_visited)
        rows = db.execute(stmt).scalars().all()
        return list(rows)

    @staticmethod
    def get_location(
        db: Session,
        location_id: uuid.UUID,
        current_user: User,
    ) -> Location:
        location = db.execute(
            select(Location).where(Location.id == location_id)
        ).scalar_one_or_none()
        if not location:
            AppException.not_found("Location not found")
        if location.saved_by != current_user.id:
            AppException.forbidden("You can only access your own saved locations")
        return location

    @staticmethod
    def update_location(
        db: Session,
        location_id: uuid.UUID,
        data: Any,
        current_user: User,
    ) -> Location:
        location = db.execute(
            select(Location).where(Location.id == location_id)
        ).scalar_one_or_none()
        if not location:
            AppException.not_found("Location not found")
        if location.saved_by != current_user.id:
            AppException.forbidden("You can only update your own saved locations")

        payload = _location_update_payload(data)
        allowed = {"notes", "is_visited", "category"}
        for key, value in payload.items():
            if key in allowed:
                setattr(location, key, value)

        db.commit()
        db.refresh(location)
        logger.info("Location updated: %s", location.id)
        return location

    @staticmethod
    def delete_location(
        db: Session,
        location_id: uuid.UUID,
        current_user: User,
    ) -> None:
        location = db.execute(
            select(Location).where(Location.id == location_id)
        ).scalar_one_or_none()
        if not location:
            AppException.not_found("Location not found")
        if location.saved_by != current_user.id:
            AppException.forbidden("You can only delete your own saved locations")

        db.delete(location)
        db.commit()
        logger.info("Location deleted: %s", location_id)

    @staticmethod
    def add_to_trip(
        db: Session,
        trip_id: uuid.UUID,
        location_id: uuid.UUID,
        current_user: User,
    ) -> TripLocation:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        TripService._verify_membership(db, trip.group_id, current_user.id)

        location = db.execute(
            select(Location).where(Location.id == location_id)
        ).scalar_one_or_none()
        if not location:
            AppException.not_found("Location not found")

        existing = db.execute(
            select(TripLocation).where(
                TripLocation.trip_id == trip_id,
                TripLocation.location_id == location_id,
            )
        ).scalar_one_or_none()
        if existing:
            AppException.conflict("This location is already on this trip")

        row = TripLocation(
            trip_id=trip_id,
            location_id=location_id,
            status="suggested",
            added_by=current_user.id,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        logger.info("TripLocation created: trip %s location %s", trip_id, location_id)
        return row

    @staticmethod
    def list_trip_locations(
        db: Session,
        trip_id: uuid.UUID,
        current_user: User,
    ) -> list[Location]:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        TripService._verify_membership(db, trip.group_id, current_user.id)

        stmt = (
            select(Location)
            .join(TripLocation, TripLocation.location_id == Location.id)
            .where(TripLocation.trip_id == trip_id)
        )
        rows = db.execute(stmt).scalars().unique().all()
        return list(rows)

    @staticmethod
    def remove_from_trip(
        db: Session,
        trip_id: uuid.UUID,
        location_id: uuid.UUID,
        current_user: User,
    ) -> None:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        TripService._verify_membership(db, trip.group_id, current_user.id)

        row = db.execute(
            select(TripLocation).where(
                TripLocation.trip_id == trip_id,
                TripLocation.location_id == location_id,
            )
        ).scalar_one_or_none()
        if not row:
            AppException.not_found("This location is not linked to this trip")

        db.delete(row)
        db.commit()
        logger.info("TripLocation removed: trip %s location %s", trip_id, location_id)
