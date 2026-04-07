"""
app/services/meet_point_service.py — Meet point proposals and attendance

Rules:
- Session is always injected — never created here
- All errors raised via AppException
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.meet_point import MeetPoint, MeetPointAttendance
from app.models.trip import Trip
from app.services.group_service import GroupService
from app.services.trip_service import TripService
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)


class MeetPointService:

    @staticmethod
    def propose_meet_point(
        db: Session,
        user_id: uuid.UUID,
        trip_id: uuid.UUID,
        name: str,
        latitude: float,
        longitude: float,
        address: str | None = None,
        meet_at: datetime | None = None,
        location_id: uuid.UUID | None = None,
    ) -> MeetPoint:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        TripService._verify_membership(db, trip.group_id, user_id)

        mp = MeetPoint(
            trip_id=trip_id,
            proposed_by=user_id,
            location_id=location_id,
            name=name,
            address=address,
            latitude=latitude,
            longitude=longitude,
            meet_at=meet_at,
        )
        db.add(mp)
        db.commit()
        db.refresh(mp)
        logger.info("Meet point proposed: %s for trip %s", mp.id, trip_id)
        return mp

    @staticmethod
    def confirm_attendance(
        db: Session,
        user_id: uuid.UUID,
        meet_point_id: uuid.UUID,
        status: str,
    ) -> MeetPointAttendance:
        mp = db.execute(
            select(MeetPoint).where(MeetPoint.id == meet_point_id)
        ).scalar_one_or_none()
        if not mp:
            AppException.not_found("Meet point not found")

        trip = db.execute(select(Trip).where(Trip.id == mp.trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        TripService._verify_membership(db, trip.group_id, user_id)

        existing = db.execute(
            select(MeetPointAttendance).where(
                MeetPointAttendance.meet_point_id == meet_point_id,
                MeetPointAttendance.user_id == user_id,
            )
        ).scalar_one_or_none()

        now = datetime.now(timezone.utc)
        if existing:
            existing.status = status
            existing.responded_at = now
            db.commit()
            db.refresh(existing)
            return existing

        row = MeetPointAttendance(
            meet_point_id=meet_point_id,
            user_id=user_id,
            status=status,
            responded_at=now,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        logger.info(
            "Meet point attendance: user %s meet_point %s status %s",
            user_id,
            meet_point_id,
            status,
        )
        return row

    @staticmethod
    def set_as_official(
        db: Session,
        user_id: uuid.UUID,
        trip_id: uuid.UUID,
        meet_point_id: uuid.UUID,
    ) -> MeetPoint:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        GroupService.require_admin(db, trip.group_id, user_id)

        others = db.execute(
            select(MeetPoint).where(
                MeetPoint.trip_id == trip_id,
                MeetPoint.is_official.is_(True),
            )
        ).scalars().all()
        for o in others:
            o.is_official = False

        mp = db.execute(
            select(MeetPoint).where(
                MeetPoint.id == meet_point_id,
                MeetPoint.trip_id == trip_id,
            )
        ).scalar_one_or_none()
        if not mp:
            AppException.not_found("Meet point not found")

        mp.is_official = True
        db.commit()
        db.refresh(mp)
        logger.info("Meet point %s set official for trip %s", meet_point_id, trip_id)
        return mp

    @staticmethod
    def get_trip_meet_points(
        db: Session,
        user_id: uuid.UUID,
        trip_id: uuid.UUID,
    ) -> list[MeetPoint]:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        TripService._verify_membership(db, trip.group_id, user_id)

        rows = db.execute(
            select(MeetPoint)
            .where(MeetPoint.trip_id == trip_id)
            .order_by(MeetPoint.is_official.desc(), MeetPoint.created_at.desc())
        ).scalars().all()
        return list(rows)
