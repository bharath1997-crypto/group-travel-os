"""
app/services/location_share_service.py — Live location sharing (RTDB + LocationShare)

Rules:
- Session is always injected — never created here
- All errors raised via AppException
- Firebase access only via app.utils.firebase
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.location_share import LocationShare
from app.models.trip import Trip
from app.services.trip_service import TripService
from app.utils.exceptions import AppException
from app.utils.firebase import delete_rtdb, set_rtdb, update_rtdb

logger = logging.getLogger(__name__)


def _rtdb_location_path(trip_id: uuid.UUID, user_id: uuid.UUID) -> str:
    return f"trips/{trip_id}/locations/{user_id}"


def _unix_ts_now() -> int:
    return int(datetime.now(timezone.utc).timestamp())


class LocationShareService:

    @staticmethod
    def start_sharing(
        db: Session,
        user_id: uuid.UUID,
        trip_id: uuid.UUID,
        latitude: float,
        longitude: float,
    ) -> LocationShare:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        TripService._verify_membership(db, trip.group_id, user_id)

        existing = db.execute(
            select(LocationShare).where(
                LocationShare.user_id == user_id,
                LocationShare.trip_id == trip_id,
                LocationShare.is_active.is_(True),
            )
        ).scalars().all()
        now = datetime.now(timezone.utc)
        for row in existing:
            row.is_active = False
            row.stopped_at = now
        db.flush()

        share = LocationShare(
            user_id=user_id,
            trip_id=trip_id,
            is_active=True,
        )
        db.add(share)
        db.flush()

        set_rtdb(
            _rtdb_location_path(trip_id, user_id),
            {
                "latitude": latitude,
                "longitude": longitude,
                "timestamp": _unix_ts_now(),
                "is_active": True,
            },
        )

        db.commit()
        db.refresh(share)
        logger.info("Location share started: user %s trip %s", user_id, trip_id)
        return share

    @staticmethod
    def update_location(
        db: Session,
        user_id: uuid.UUID,
        trip_id: uuid.UUID,
        latitude: float,
        longitude: float,
    ) -> None:
        session = db.execute(
            select(LocationShare)
            .where(
                LocationShare.user_id == user_id,
                LocationShare.trip_id == trip_id,
                LocationShare.is_active.is_(True),
            )
            .limit(1)
        ).scalar_one_or_none()
        if not session:
            AppException.not_found("No active location share for this trip")

        update_rtdb(
            _rtdb_location_path(trip_id, user_id),
            {
                "latitude": latitude,
                "longitude": longitude,
                "timestamp": _unix_ts_now(),
            },
        )

        session.last_updated = datetime.now(timezone.utc)
        db.commit()
        logger.debug("Location updated: user %s trip %s", user_id, trip_id)

    @staticmethod
    def stop_sharing(db: Session, user_id: uuid.UUID, trip_id: uuid.UUID) -> None:
        session = db.execute(
            select(LocationShare)
            .where(
                LocationShare.user_id == user_id,
                LocationShare.trip_id == trip_id,
                LocationShare.is_active.is_(True),
            )
            .limit(1)
        ).scalar_one_or_none()
        if not session:
            AppException.not_found("No active location share for this trip")

        now = datetime.now(timezone.utc)
        session.is_active = False
        session.stopped_at = now

        delete_rtdb(_rtdb_location_path(trip_id, user_id))
        db.commit()
        logger.info("Location share stopped: user %s trip %s", user_id, trip_id)

    @staticmethod
    def get_active_sharers(db: Session, trip_id: uuid.UUID) -> list[LocationShare]:
        rows = db.execute(
            select(LocationShare).where(
                LocationShare.trip_id == trip_id,
                LocationShare.is_active.is_(True),
            )
        ).scalars().all()
        return list(rows)

    @staticmethod
    def auto_stop_stale_sessions(db: Session) -> int:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=4)
        stale = db.execute(
            select(LocationShare).where(
                LocationShare.is_active.is_(True),
                LocationShare.last_updated < cutoff,
            )
        ).scalars().all()

        now = datetime.now(timezone.utc)
        for row in stale:
            row.is_active = False
            row.stopped_at = now
            try:
                delete_rtdb(_rtdb_location_path(row.trip_id, row.user_id))
            except Exception:
                pass

        db.commit()
        if stale:
            logger.info("auto_stop_stale_sessions: stopped %s session(s)", len(stale))
        return len(stale)
