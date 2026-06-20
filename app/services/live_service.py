"""
app/services/live_service.py — Live sessions and crowdsourced road reports

Rules:
- Session is always injected — never created here
- Use SQLAlchemy 2.0 select() style
- All errors via AppException
"""
from __future__ import annotations

import math
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.live_session import LiveMode, LiveSession
from app.models.road_report import EXPIRY_MINUTES, ReportConfirmation, ReportType, RoadReport
from app.models.trip import Trip
from app.schemas.live import RoadReportCreate
from app.services.trip_service import TripService
from app.utils.exceptions import AppException


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius_km = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lng / 2) ** 2
    )
    return radius_km * 2 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))


class LiveService:

    @staticmethod
    def start_session(
        db: Session,
        user_id: uuid.UUID,
        trip_id: uuid.UUID | None,
        mode: LiveMode,
    ) -> LiveSession:
        if trip_id is not None:
            trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
            if not trip:
                AppException.not_found("Trip not found")
            TripService._verify_membership(db, trip.group_id, user_id)

        session = LiveSession(
            trip_id=trip_id,
            started_by=user_id,
            mode=mode,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    @staticmethod
    def end_session(db: Session, user_id: uuid.UUID, session_id: uuid.UUID) -> None:
        session = db.execute(
            select(LiveSession).where(LiveSession.id == session_id)
        ).scalar_one_or_none()
        if not session:
            AppException.not_found("Live session not found")
        if session.started_by != user_id:
            AppException.forbidden("You do not own this live session")

        session.is_active = False
        session.ended_at = datetime.now(timezone.utc)
        db.commit()

    @staticmethod
    def submit_report(
        db: Session,
        user_id: uuid.UUID,
        data: RoadReportCreate,
    ) -> RoadReport:
        minutes = EXPIRY_MINUTES[data.report_type.value]
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=minutes)
        report = RoadReport(
            reporter_id=user_id,
            report_type=data.report_type,
            lat=data.lat,
            lng=data.lng,
            city=data.city,
            description=data.description,
            expires_at=expires_at,
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def get_nearby_reports(
        db: Session,
        lat: float,
        lng: float,
        radius_km: float,
    ) -> list[RoadReport]:
        now = datetime.now(timezone.utc)
        reports = db.execute(
            select(RoadReport).where(
                RoadReport.is_active.is_(True),
                RoadReport.expires_at > now,
            )
        ).scalars().all()

        nearby: list[tuple[float, RoadReport]] = []
        for report in reports:
            distance = _haversine_km(lat, lng, report.lat, report.lng)
            if distance <= radius_km:
                nearby.append((distance, report))

        nearby.sort(key=lambda item: item[0])
        return [report for _, report in nearby]

    @staticmethod
    def confirm_report(
        db: Session,
        user_id: uuid.UUID,
        report_id: uuid.UUID,
        action: Literal["confirm", "dismiss"],
    ) -> RoadReport:
        report = db.execute(
            select(RoadReport).where(RoadReport.id == report_id)
        ).scalar_one_or_none()
        if not report:
            AppException.not_found("Report not found")

        existing = db.execute(
            select(ReportConfirmation).where(
                ReportConfirmation.report_id == report_id,
                ReportConfirmation.user_id == user_id,
            )
        ).scalar_one_or_none()
        if existing:
            AppException.conflict("You have already voted on this report")

        confirmation = ReportConfirmation(
            report_id=report_id,
            user_id=user_id,
            action=action,
        )
        db.add(confirmation)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            AppException.conflict("You have already voted on this report")

        if action == "confirm":
            report.confirmed_count += 1
        else:
            report.dismissed_count += 1
            if report.dismissed_count >= 3:
                report.is_active = False

        db.commit()
        db.refresh(report)
        return report
