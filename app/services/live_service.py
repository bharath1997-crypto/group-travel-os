"""
app/services/live_service.py — Live sessions and crowdsourced road reports

Rules:
- Session is always injected — never created here
- Use SQLAlchemy 2.0 select() style
- All errors via AppException
"""
from __future__ import annotations

import logging
import math
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

import httpx
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.api_limits import API_TIMEOUT_SECONDS
from app.models.live_session import LiveMode, LiveSession
from app.models.road_report import EXPIRY_MINUTES, ReportConfirmation, ReportType, RoadReport
from app.models.trip import Trip
from app.schemas.live import RoadReportCreate, TrafficDensityPoint
from app.services.trip_service import TripService
from app.services.wayra_service import _GEMINI_URL, _gemini_key
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)

GUEST_WAYRA_LIMIT = 3
guest_wayra_counts: dict[str, int] = {}

_GUEST_WAYRA_SYSTEM = (
    "You are Wayra, Rovvy's travel AI. You help travelers with road conditions, "
    "directions, and travel tips. Keep responses under 100 words. Be friendly."
)


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

    @staticmethod
    def guest_wayra_chat(message: str, session_key: str) -> dict[str, str | int]:
        key = session_key.strip()
        if not key:
            AppException.bad_request("session_key is required")

        msg = message.strip()
        if not msg:
            AppException.bad_request("message is required")
        if len(msg) > 200:
            AppException.bad_request("message too long")

        count = guest_wayra_counts.get(key, 0)
        if count >= GUEST_WAYRA_LIMIT:
            AppException.bad_request("Guest message limit reached")

        guest_wayra_counts[key] = count + 1
        remaining = GUEST_WAYRA_LIMIT - guest_wayra_counts[key]
        reply = _call_guest_wayra_gemini(msg)
        return {"reply": reply, "remaining": remaining}

    @staticmethod
    def get_traffic_density(
        db: Session,
        lat: float,
        lng: float,
        radius_km: float,
    ) -> list[TrafficDensityPoint]:
        now = datetime.now(timezone.utc)
        reports = db.execute(
            select(RoadReport).where(
                RoadReport.is_active.is_(True),
                RoadReport.expires_at > now,
                RoadReport.report_type.in_([ReportType.traffic, ReportType.accident]),
            )
        ).scalars().all()

        grid: dict[tuple[float, float], int] = {}
        for report in reports:
            distance = _haversine_km(lat, lng, report.lat, report.lng)
            if distance > radius_km:
                continue
            cell_lat = round(report.lat, 2)
            cell_lng = round(report.lng, 2)
            grid_key = (cell_lat, cell_lng)
            grid[grid_key] = grid.get(grid_key, 0) + 1

        points: list[TrafficDensityPoint] = []
        for (cell_lat, cell_lng), count in grid.items():
            if count >= 5:
                level: Literal["low", "medium", "high"] = "high"
            elif count >= 2:
                level = "medium"
            else:
                level = "low"
            points.append(
                TrafficDensityPoint(
                    lat=cell_lat,
                    lng=cell_lng,
                    count=count,
                    level=level,
                )
            )

        points.sort(key=lambda item: item.count, reverse=True)
        return points


def _call_guest_wayra_gemini(message: str) -> str:
    api_key = _gemini_key()
    if not api_key:
        return "Wayra is temporarily unavailable. Please try again later."

    body = {
        "systemInstruction": {"parts": [{"text": _GUEST_WAYRA_SYSTEM}]},
        "contents": [{"role": "user", "parts": [{"text": message}]}],
        "generationConfig": {
            "temperature": 0.5,
            "maxOutputTokens": 256,
        },
    }
    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            response = client.post(_GEMINI_URL, params={"key": api_key}, json=body)
        if response.status_code != 200:
            logger.debug(
                "Guest Wayra Gemini HTTP %s: %s",
                response.status_code,
                response.text[:300],
            )
            return "I couldn't respond right now. Please try again."

        data = response.json()
        candidates = data.get("candidates")
        if not isinstance(candidates, list) or not candidates:
            return "I couldn't process that right now. Please try again."

        first = candidates[0]
        if not isinstance(first, dict):
            return "I couldn't process that right now. Please try again."

        content = first.get("content")
        if not isinstance(content, dict):
            return "I couldn't process that right now. Please try again."

        parts = content.get("parts")
        if not isinstance(parts, list):
            return "I couldn't process that right now. Please try again."

        chunks: list[str] = []
        for part in parts:
            if isinstance(part, dict) and isinstance(part.get("text"), str):
                chunks.append(part["text"])
        text = "".join(chunks).strip()
        return text or "I couldn't process that right now. Please try again."
    except Exception as exc:
        logger.debug("Guest Wayra Gemini failed: %s", exc)
        return "Wayra is temporarily offline. Please try again."
