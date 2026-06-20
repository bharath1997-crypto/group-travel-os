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
import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

import httpx
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.api_limits import API_TIMEOUT_SECONDS
from app.models.group import GroupMember, MemberRole
from app.models.live_session import LiveMode, LiveSession
from app.models.road_report import EXPIRY_MINUTES, ReportConfirmation, ReportType, RoadReport
from app.models.trip import Trip
from app.models.user import User
from app.schemas.live import RoadReportCreate, TrafficDensityPoint
from app.services.notification_service import NotificationService
from app.services.trip_service import TripService
from app.services.wayra_service import _GEMINI_URL, _gemini_key
from app.utils.exceptions import AppException
from app.utils.firebase import delete_rtdb, get_rtdb, set_rtdb, update_rtdb

logger = logging.getLogger(__name__)

GUEST_WAYRA_LIMIT = 3
guest_wayra_counts: dict[str, int] = {}

_chat_rate: dict[str, list[float]] = {}

BLOCKED_PATTERNS = [
    re.compile(r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b"),
    re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"),
    re.compile(r"https?://\S+", re.IGNORECASE),
    re.compile(r"www\.\S+", re.IGNORECASE),
    re.compile(r"@[a-zA-Z0-9_]+"),
]

PROFANITY_LIST = frozenset(
    {
        "asshole",
        "bastard",
        "bitch",
        "bollocks",
        "bullshit",
        "cock",
        "crap",
        "cunt",
        "damn",
        "dick",
        "douche",
        "fuck",
        "fucker",
        "fucking",
        "goddamn",
        "hell",
        "jackass",
        "jerk",
        "motherfucker",
        "piss",
        "prick",
        "pussy",
        "shit",
        "slut",
        "twat",
        "wanker",
        "whore",
        "ass",
        "arse",
        "bloody",
        "bugger",
        "chink",
        "coon",
        "dyke",
        "fag",
        "faggot",
        "kike",
        "nazi",
        "nigger",
        "retard",
        "spic",
        "tranny",
        "wetback",
    }
)

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

    @staticmethod
    def get_route(
        start_lat: float,
        start_lng: float,
        end_lat: float,
        end_lng: float,
    ) -> dict:
        url = (
            "http://router.project-osrm.org/route/v1/driving/"
            f"{start_lng},{start_lat};{end_lng},{end_lat}"
        )
        params = {
            "overview": "full",
            "geometries": "geojson",
            "steps": "true",
        }
        try:
            with httpx.Client(timeout=15.0) as client:
                response = client.get(url, params=params)
            if response.status_code != 200:
                AppException.bad_request("Routing unavailable")
            payload = response.json()
        except Exception as exc:
            logger.debug("OSRM route request failed: %s", exc)
            AppException.bad_request("Routing unavailable")

        if payload.get("code") != "Ok":
            AppException.bad_request("Routing unavailable")

        routes = payload.get("routes")
        if not isinstance(routes, list) or not routes:
            AppException.bad_request("Routing unavailable")

        route = routes[0]
        if not isinstance(route, dict):
            AppException.bad_request("Routing unavailable")

        geometry = route.get("geometry")
        legs = route.get("legs")
        if not isinstance(geometry, dict) or not isinstance(legs, list) or not legs:
            AppException.bad_request("Routing unavailable")

        first_leg = legs[0]
        if not isinstance(first_leg, dict):
            AppException.bad_request("Routing unavailable")

        raw_steps = first_leg.get("steps")
        if not isinstance(raw_steps, list):
            AppException.bad_request("Routing unavailable")

        steps: list[dict] = []
        for step in raw_steps:
            if not isinstance(step, dict):
                continue
            maneuver = step.get("maneuver")
            if not isinstance(maneuver, dict):
                continue
            location = maneuver.get("location")
            if (
                not isinstance(location, list)
                or len(location) < 2
                or not isinstance(location[0], (int, float))
                or not isinstance(location[1], (int, float))
            ):
                continue

            maneuver_type = _osrm_maneuver_type(maneuver)
            name = step.get("name")
            instruction = step.get("name") or ""
            if isinstance(name, str) and name.strip():
                instruction = name.strip()

            steps.append(
                {
                    "instruction": instruction,
                    "distance": float(step.get("distance") or 0),
                    "duration": float(step.get("duration") or 0),
                    "maneuver_type": maneuver_type,
                    "name": name if isinstance(name, str) else None,
                    "lat": float(location[1]),
                    "lng": float(location[0]),
                }
            )

        return {
            "geometry": geometry,
            "steps": steps,
            "total_distance_m": float(route.get("distance") or 0),
            "total_duration_s": float(route.get("duration") or 0),
        }

    @staticmethod
    def send_report_chat(
        db: Session,
        user_id: uuid.UUID,
        report_id: uuid.UUID,
        text: str,
    ) -> dict:
        report = _get_active_report_for_chat(db, report_id)
        _check_rate_limit(user_id)
        filtered_text = _filter_message(text)

        message_id = str(uuid.uuid4())
        sent_at = datetime.now(timezone.utc)
        expires_at = _report_expires_at_utc(report)
        message_data = {
            "id": message_id,
            "text": filtered_text,
            "sender_label": "Traveler nearby",
            "sent_at": sent_at.isoformat(),
            "expires_at": expires_at.isoformat(),
        }
        set_rtdb(f"live_reports/{report_id}/chat/{message_id}", message_data)
        return {
            "message_id": message_id,
            "sent_at": sent_at,
            "text": filtered_text,
            "sender_label": "Traveler nearby",
        }

    @staticmethod
    def get_report_chat(db: Session, report_id: uuid.UUID) -> list[dict]:
        _get_active_report_for_chat(db, report_id)
        raw = get_rtdb(f"live_reports/{report_id}/chat")
        if not raw:
            return []

        messages: list[dict] = []
        for message_id, payload in raw.items():
            if not isinstance(payload, dict):
                continue
            messages.append(
                {
                    "id": payload.get("id") or message_id,
                    "text": payload.get("text") or "",
                    "sender_label": payload.get("sender_label") or "Traveler nearby",
                    "sent_at": payload.get("sent_at") or "",
                }
            )
        messages.sort(key=lambda item: item.get("sent_at") or "")
        return messages

    @staticmethod
    def get_report_chat_count(db: Session, report_id: uuid.UUID) -> int:
        report = db.execute(
            select(RoadReport).where(RoadReport.id == report_id)
        ).scalar_one_or_none()
        if not report or not report.is_active:
            return 0
        now = datetime.now(timezone.utc)
        expires_at = _report_expires_at_utc(report)
        if expires_at <= now:
            return 0

        raw = get_rtdb(f"live_reports/{report_id}/chat")
        if not raw:
            return 0
        return len(raw)

    @staticmethod
    def flag_chat_message(
        db: Session,
        report_id: uuid.UUID,
        message_id: str,
    ) -> dict[str, bool]:
        _get_active_report_for_chat(db, report_id)
        path = f"live_reports/{report_id}/chat/{message_id}"
        message = get_rtdb(path)
        if not message:
            AppException.not_found("Message not found")

        flag_count = int(message.get("flag_count") or 0) + 1
        if flag_count >= 2:
            delete_rtdb(path)
            return {"flagged": True, "removed": True}

        update_rtdb(path, {"flag_count": flag_count})
        return {"flagged": True, "removed": False}

    @staticmethod
    def validate_group_member(
        db: Session,
        user_id: uuid.UUID,
        trip_id: uuid.UUID,
    ) -> dict:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")
        member = db.execute(
            select(GroupMember).where(
                GroupMember.group_id == trip.group_id,
                GroupMember.user_id == user_id,
            )
        ).scalar_one_or_none()
        if not member:
            AppException.forbidden("Not a trip member")

        rows = db.execute(
            select(GroupMember, User)
            .join(User, User.id == GroupMember.user_id)
            .where(GroupMember.group_id == trip.group_id)
            .order_by(GroupMember.joined_at.asc())
        ).all()

        members: list[dict] = []
        for _member, user in rows:
            members.append(
                {
                    "user_id": user.id,
                    "display_name": user.full_name,
                    "is_admin": TripService._is_creator_or_admin(db, trip, user.id),
                }
            )

        return {
            "trip_id": trip.id,
            "trip_name": trip.title,
            "member_count": len(members),
            "members": members,
            "is_admin": TripService._is_creator_or_admin(db, trip, user_id),
        }

    @staticmethod
    def _require_trip_admin(db: Session, trip: Trip, user_id: uuid.UUID) -> None:
        if not TripService._is_creator_or_admin(db, trip, user_id):
            AppException.forbidden("Admin access required")

    @staticmethod
    def _get_trip_for_member(
        db: Session,
        user_id: uuid.UUID,
        trip_id: uuid.UUID,
    ) -> Trip:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")
        TripService._verify_membership(db, trip.group_id, user_id)
        return trip

    @staticmethod
    def _send_fcm_to_trip_members(
        db: Session,
        trip: Trip,
        title: str,
        body: str,
        notification_type: str,
    ) -> int:
        users = NotificationService._group_members_with_fcm_tokens(db, trip.group_id)
        payload = {"trip_id": str(trip.id), "type": notification_type}
        ok = 0
        for user in users:
            try:
                if NotificationService.send_to_token(
                    user.fcm_token or "",
                    title,
                    body,
                    payload,
                ):
                    ok += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning("FCM to trip members failed: %s", exc)
        return ok

    @staticmethod
    def set_meeting_point(
        db: Session,
        user_id: uuid.UUID,
        trip_id: uuid.UUID,
        lat: float,
        lng: float,
        label: str,
    ) -> dict:
        trip = LiveService._get_trip_for_member(db, user_id, trip_id)
        LiveService._require_trip_admin(db, trip, user_id)

        user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
        admin_name = user.full_name if user else "Trip admin"
        set_at = datetime.now(timezone.utc).isoformat()
        data = {
            "lat": lat,
            "lng": lng,
            "label": label,
            "set_by": str(user_id),
            "set_at": set_at,
        }
        set_rtdb(f"trips/{trip_id}/live/meeting_point", data)
        LiveService._send_fcm_to_trip_members(
            db,
            trip,
            "Meeting point set",
            f"{admin_name} set a meeting point",
            "live_meeting_point",
        )
        return data

    @staticmethod
    def delete_meeting_point(
        db: Session,
        user_id: uuid.UUID,
        trip_id: uuid.UUID,
    ) -> None:
        trip = LiveService._get_trip_for_member(db, user_id, trip_id)
        LiveService._require_trip_admin(db, trip, user_id)
        delete_rtdb(f"trips/{trip_id}/live/meeting_point")

    @staticmethod
    def set_member_status(
        db: Session,
        user_id: uuid.UUID,
        trip_id: uuid.UUID,
        status: str,
    ) -> dict:
        trip = LiveService._get_trip_for_member(db, user_id, trip_id)
        updated_at = datetime.now(timezone.utc).isoformat()
        data = {"status": status, "updated_at": updated_at}
        set_rtdb(f"trips/{trip_id}/live/members/{user_id}/status", data)

        if status == "need_help":
            user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
            user_name = user.full_name if user else "A member"
            LiveService._send_fcm_to_trip_members(
                db,
                trip,
                "⚠️ Someone needs help",
                f"{user_name} needs help",
                "live_need_help",
            )
        return {"status": status, "updated_at": updated_at}

    @staticmethod
    def start_convoy(
        db: Session,
        user_id: uuid.UUID,
        trip_id: uuid.UUID,
        destination_lat: float,
        destination_lng: float,
        destination_name: str,
    ) -> dict:
        trip = LiveService._get_trip_for_member(db, user_id, trip_id)
        LiveService._require_trip_admin(db, trip, user_id)

        leader_loc = get_rtdb(f"trips/{trip_id}/live/members/{user_id}")
        if not leader_loc or leader_loc.get("lat") is None or leader_loc.get("lng") is None:
            AppException.bad_request("Leader location unavailable")

        route = LiveService.get_route(
            float(leader_loc["lat"]),
            float(leader_loc["lng"]),
            destination_lat,
            destination_lng,
        )

        user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
        leader_name = user.full_name if user else "Trip admin"
        started_at = datetime.now(timezone.utc).isoformat()
        data = {
            "active": True,
            "leader_id": str(user_id),
            "destination_lat": destination_lat,
            "destination_lng": destination_lng,
            "destination_name": destination_name,
            "route_geometry": route["geometry"],
            "started_at": started_at,
        }
        set_rtdb(f"trips/{trip_id}/live/convoy", data)
        LiveService._send_fcm_to_trip_members(
            db,
            trip,
            "Convoy started",
            f"Follow {leader_name} to {destination_name}",
            "live_convoy_started",
        )
        return data

    @staticmethod
    def end_convoy(db: Session, user_id: uuid.UUID, trip_id: uuid.UUID) -> None:
        trip = LiveService._get_trip_for_member(db, user_id, trip_id)
        LiveService._require_trip_admin(db, trip, user_id)
        delete_rtdb(f"trips/{trip_id}/live/convoy")
        LiveService._send_fcm_to_trip_members(
            db,
            trip,
            "Convoy ended",
            "Convoy ended",
            "live_convoy_ended",
        )


def _check_rate_limit(user_id: uuid.UUID) -> None:
    now = time.time()
    key = str(user_id)
    timestamps = _chat_rate.get(key, [])
    timestamps = [stamp for stamp in timestamps if now - stamp < 60]
    if len(timestamps) >= 10:
        AppException.bad_request("Too many messages. Slow down.")
    timestamps.append(now)
    _chat_rate[key] = timestamps


def _filter_message(text: str) -> str:
    cleaned = text.strip()
    if not cleaned:
        AppException.bad_request("Message is required")
    for pattern in BLOCKED_PATTERNS:
        if pattern.search(cleaned):
            AppException.bad_request("Message contains blocked content")
    lower = cleaned.lower()
    for word in PROFANITY_LIST:
        if word in lower:
            AppException.bad_request("Message contains inappropriate content")
    return cleaned


def _report_expires_at_utc(report: RoadReport) -> datetime:
    expires_at = report.expires_at
    if expires_at.tzinfo is None:
        return expires_at.replace(tzinfo=timezone.utc)
    return expires_at


def _get_active_report_for_chat(db: Session, report_id: uuid.UUID) -> RoadReport:
    report = db.execute(
        select(RoadReport).where(RoadReport.id == report_id)
    ).scalar_one_or_none()
    if not report or not report.is_active:
        AppException.not_found("Report not found or expired")

    now = datetime.now(timezone.utc)
    if _report_expires_at_utc(report) <= now:
        AppException.bad_request("This report has expired")
    return report


def _osrm_maneuver_type(maneuver: dict) -> str:
    maneuver_type = str(maneuver.get("type") or "straight")
    modifier = maneuver.get("modifier")
    if isinstance(modifier, str) and modifier.strip():
        normalized = modifier.strip().replace(" ", "-")
        if maneuver_type in ("turn", "end of road", "fork", "off ramp", "on ramp"):
            return f"{maneuver_type}-{normalized}" if maneuver_type == "turn" else normalized
        return normalized
    return maneuver_type


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
