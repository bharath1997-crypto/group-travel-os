"""
app/services/live_service.py — Live sessions and crowdsourced road reports

Rules:
- Session is always injected — never created here
- Use SQLAlchemy 2.0 select() style
- All errors via AppException
"""
from __future__ import annotations

import hashlib
import logging
import math
import re
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

import httpx
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.api_limits import API_TIMEOUT_SECONDS
from app.models.emergency_contact import EmergencyContact
from app.models.group import GroupMember, MemberRole
from app.models.live_session import LiveMode, LiveSession
from app.models.road_report import EXPIRY_MINUTES, ReportConfirmation, ReportType, RoadReport
from app.models.trip import Trip
from app.models.trip_track import TripTrack
from app.models.spectator_invite import SpectatorInvite
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
_traveler_chat_rate: dict[str, list[float]] = {}

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

WAYRA_LIVE_SYSTEM_PROMPT = """
You are Wayra, Rovvy's real-time travel AI assistant.
You are helping a traveler who is currently on the road.

Current context:
- Location: {lat:.4f}, {lng:.4f}
- Speed: {speed_mph:.0f} mph
- Nearby hazards: {active_reports}
- Weather: {weather_description}
- Group members: {member_count} traveling together
- Destination: {route_destination}

Your role:
- Give SHORT responses (max 2 sentences)
- Be direct and actionable
- Focus on safety and navigation
- For "find X near me" requests: suggest they use the POI search (tap search icon)
- For navigation requests: suggest they use the search bar
- Never make up specific addresses or business names
- Always prioritize safety over convenience
"""


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


def _bearing_degrees(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_lng = math.radians(lng2 - lng1)
    y = math.sin(d_lng) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(d_lng)
    bearing = math.degrees(math.atan2(y, x))
    return (bearing + 360) % 360


def _bearing_delta(a: float, b: float) -> float:
    diff = abs(a - b) % 360
    return diff if diff <= 180 else 360 - diff


def _is_ahead(user_bearing: float, target_bearing: float, tolerance: float = 45.0) -> bool:
    return _bearing_delta(user_bearing, target_bearing) <= tolerance


def _is_same_direction(
    user_bearing: float,
    other_bearing: float,
    to_traveler_bearing: float,
) -> bool:
    if not _is_ahead(user_bearing, to_traveler_bearing):
        return False
    return _bearing_delta(user_bearing, other_bearing) <= 45.0


def _route_alert_tier(distance_miles: float) -> str | None:
    if distance_miles < 2.0:
        return "immediate"
    if distance_miles < 5.0:
        return "soon"
    if distance_miles <= 8.0:
        return "advance"
    return None


def _route_alert_message(
    report_type: str,
    distance_miles: float,
    minutes_away: float | None,
) -> str:
    miles_text = f"{distance_miles:.1f}"
    if report_type == "police":
        if minutes_away is not None:
            return (
                f"Police ahead in {miles_text} miles. "
                f"{minutes_away:.0f} minutes away."
            )
        return f"Police ahead in {miles_text} miles."
    if report_type == "accident":
        return f"Accident reported on your route, {miles_text} miles ahead."
    return f"{report_type.replace('_', ' ').title()} reported on your route, {miles_text} miles ahead."


def _traveler_id(viewer_id: uuid.UUID, target_id: uuid.UUID) -> str:
    raw = f"{viewer_id}:{target_id}".encode()
    return hashlib.sha256(raw).hexdigest()[:16]


def _resolve_traveler_target(user_id: uuid.UUID, traveler_id: str) -> uuid.UUID | None:
    raw = get_rtdb("live_locations") or {}
    if not isinstance(raw, dict):
        return None
    for other_id in raw:
        if other_id == str(user_id):
            continue
        try:
            target_id = uuid.UUID(str(other_id))
        except ValueError:
            continue
        if _traveler_id(user_id, target_id) == traveler_id:
            return target_id
    return None


def _check_traveler_chat_rate(session_key: str) -> None:
    now = time.time()
    key = session_key.strip()
    timestamps = _traveler_chat_rate.get(key, [])
    timestamps = [stamp for stamp in timestamps if now - stamp < 60]
    if len(timestamps) >= 10:
        AppException.bad_request("Too many messages. Slow down.")
    timestamps.append(now)
    _traveler_chat_rate[key] = timestamps


def _parse_maxspeed_mph(raw: str) -> int | None:
    value = raw.strip().lower()
    if not value:
        return None
    if "mph" in value:
        try:
            return int(float(value.replace("mph", "").strip()))
        except ValueError:
            return None
    if "km/h" in value or "kph" in value:
        try:
            numeric = float(value.replace("km/h", "").replace("kph", "").strip())
            return int(round(numeric * 0.621371))
        except ValueError:
            return None
    try:
        numeric = float(value)
        return int(round(numeric * 0.621371)) if numeric > 120 else int(numeric)
    except ValueError:
        return None


def _fetch_speed_limit_from_overpass(lat: float, lng: float) -> dict[str, int | str | None]:
    query = (
        f'[out:json][timeout:10];'
        f'way(around:40,{lat},{lng})["highway"]["maxspeed"];'
        f'out tags;'
    )
    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            response = client.get(
                "https://overpass-api.de/api/interpreter",
                params={"data": query},
            )
        if response.status_code != 200:
            return {"speed_limit_mph": None, "road_name": None}

        data = response.json()
        elements = data.get("elements")
        if not isinstance(elements, list):
            return {"speed_limit_mph": None, "road_name": None}

        speed_limit: int | None = None
        road_name: str | None = None
        for element in elements:
            if not isinstance(element, dict):
                continue
            tags = element.get("tags")
            if not isinstance(tags, dict):
                continue
            if speed_limit is None and isinstance(tags.get("maxspeed"), str):
                speed_limit = _parse_maxspeed_mph(tags["maxspeed"])
            if road_name is None:
                for key in ("name", "ref"):
                    tag_value = tags.get(key)
                    if isinstance(tag_value, str) and tag_value.strip():
                        road_name = tag_value.strip()
                        break
            if speed_limit is not None and road_name is not None:
                break

        return {"speed_limit_mph": speed_limit, "road_name": road_name}
    except Exception as exc:
        logger.debug("Overpass speed limit lookup failed: %s", exc)
        return {"speed_limit_mph": None, "road_name": None}


_speed_camera_cache: dict[str, tuple[float, list[dict]]] = {}
_SPEED_CAMERA_CACHE_TTL = 3600


def _speed_camera_cache_key(lat: float, lng: float, radius_m: int) -> str:
    return f"{round(lat, 2)}:{round(lng, 2)}:{radius_m}"


def _camera_alert_tier(distance_miles: float) -> str | None:
    if distance_miles < 0.1:
        return "immediate"
    if distance_miles < 0.3:
        return "warning"
    if distance_miles <= 1.0:
        return "advisory"
    return None


def _camera_alert_message(
    tier: str,
    distance_miles: float,
    max_speed_mph: int | None,
    over_limit: bool,
) -> str:
    miles_text = f"{distance_miles:.1f}"
    limit_text = f"{max_speed_mph} mph" if max_speed_mph is not None else "speed limit"
    if tier == "immediate":
        base = f"Speed camera now — {limit_text} zone."
    elif tier == "warning":
        base = f"Speed camera in {miles_text} mi — slow down."
    else:
        base = f"Speed camera ahead in {miles_text} mi."
        if max_speed_mph is not None:
            base = f"Speed camera ahead in {miles_text} mi — limit {max_speed_mph} mph."
    if over_limit:
        base = f"{base} Reduce speed now."
    return base


def _fetch_speed_cameras_from_overpass(
    lat: float,
    lng: float,
    radius_m: int,
) -> list[dict]:
    query = (
        f"[out:json][timeout:15];("
        f'node(around:{radius_m},{lat},{lng})["highway"="speed_camera"];'
        f'node(around:{radius_m},{lat},{lng})["enforcement"="maxspeed"];'
        f'node(around:{radius_m},{lat},{lng})["man_made"="surveillance"]["surveillance"="public"];'
        f");out body;"
    )
    cameras: list[dict] = []
    seen_ids: set[str] = set()
    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            response = client.get(
                "https://overpass-api.de/api/interpreter",
                params={"data": query},
            )
        if response.status_code != 200:
            return cameras

        data = response.json()
        elements = data.get("elements")
        if not isinstance(elements, list):
            return cameras

        for element in elements:
            if not isinstance(element, dict):
                continue
            if element.get("type") != "node":
                continue
            osm_id = element.get("id")
            node_lat = element.get("lat")
            node_lng = element.get("lon")
            if osm_id is None or node_lat is None or node_lng is None:
                continue
            camera_id = f"osm-{osm_id}"
            if camera_id in seen_ids:
                continue
            seen_ids.add(camera_id)

            tags = element.get("tags")
            max_speed_mph: int | None = None
            direction: str | None = None
            if isinstance(tags, dict):
                raw_speed = tags.get("maxspeed")
                if isinstance(raw_speed, str):
                    max_speed_mph = _parse_maxspeed_mph(raw_speed)
                raw_direction = tags.get("direction")
                if isinstance(raw_direction, str) and raw_direction.strip():
                    direction = raw_direction.strip()

            cameras.append(
                {
                    "camera_id": camera_id,
                    "lat": float(node_lat),
                    "lng": float(node_lng),
                    "max_speed_mph": max_speed_mph,
                    "direction": direction,
                }
            )
    except Exception as exc:
        logger.debug("Overpass speed camera lookup failed: %s", exc)
    return cameras


MAX_TRACK_POINTS = 2160


def _parse_track_ts(raw: str) -> datetime:
    dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    return _haversine_km(lat1, lng1, lat2, lng2) * 1000.0


def _trip_track_to_dict(track: TripTrack) -> dict:
    return {
        "id": track.id,
        "session_id": track.session_id,
        "trip_id": track.trip_id,
        "track_points": list(track.track_points or []),
        "total_distance_m": track.total_distance_m,
        "total_duration_s": track.total_duration_s,
        "max_speed_mph": track.max_speed_mph,
        "avg_speed_mph": track.avg_speed_mph,
        "reports_encountered": track.reports_encountered or 0,
        "cameras_passed": track.cameras_passed or 0,
        "started_at": track.started_at,
        "ended_at": track.ended_at,
        "created_at": track.created_at,
    }


def _trip_track_summary_dict(track: TripTrack) -> dict:
    return {
        "id": track.id,
        "session_id": track.session_id,
        "total_distance_m": track.total_distance_m,
        "total_duration_s": track.total_duration_s,
        "max_speed_mph": track.max_speed_mph,
        "avg_speed_mph": track.avg_speed_mph,
        "started_at": track.started_at,
        "ended_at": track.ended_at,
        "reports_encountered": track.reports_encountered or 0,
        "cameras_passed": track.cameras_passed or 0,
    }


def _calculate_track_stats(points: list[dict]) -> dict[str, float | int | None]:
    if not points:
        return {
            "total_distance_m": 0.0,
            "total_duration_s": 0,
            "max_speed_mph": None,
            "avg_speed_mph": None,
        }

    total_distance_m = 0.0
    speeds: list[float] = []
    for index, point in enumerate(points):
        speed = float(point.get("speed_mph") or 0)
        if speed > 0:
            speeds.append(speed)
        if index == 0:
            continue
        prev = points[index - 1]
        total_distance_m += _haversine_meters(
            float(prev["lat"]),
            float(prev["lng"]),
            float(point["lat"]),
            float(point["lng"]),
        )

    try:
        first_ts = _parse_track_ts(str(points[0]["ts"]))
        last_ts = _parse_track_ts(str(points[-1]["ts"]))
        total_duration_s = max(0, int((last_ts - first_ts).total_seconds()))
    except (KeyError, ValueError, TypeError):
        total_duration_s = 0

    max_speed_mph = max(speeds) if speeds else None
    avg_speed_mph = round(sum(speeds) / len(speeds), 1) if speeds else None
    return {
        "total_distance_m": round(total_distance_m, 1),
        "total_duration_s": total_duration_s,
        "max_speed_mph": max_speed_mph,
        "avg_speed_mph": avg_speed_mph,
    }


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
        db.execute(
            update(SpectatorInvite)
            .where(SpectatorInvite.session_id == session_id)
            .values(is_active=False)
        )
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
    def get_speed_limit(lat: float, lng: float) -> dict[str, int | str | None]:
        return _fetch_speed_limit_from_overpass(lat, lng)

    @staticmethod
    def get_speed_cameras(lat: float, lng: float, radius_m: int = 5000) -> dict[str, list[dict]]:
        key = _speed_camera_cache_key(lat, lng, radius_m)
        now = time.time()
        cached = _speed_camera_cache.get(key)
        if cached and now - cached[0] < _SPEED_CAMERA_CACHE_TTL:
            return {"cameras": cached[1]}

        cameras = _fetch_speed_cameras_from_overpass(lat, lng, radius_m)
        _speed_camera_cache[key] = (now, cameras)
        return {"cameras": cameras}

    @staticmethod
    def get_speed_camera_route_alert(
        lat: float,
        lng: float,
        bearing: float,
        speed_mph: float,
        radius_m: int = 5000,
    ) -> dict:
        empty = {
            "camera_id": None,
            "tier": None,
            "distance_miles": None,
            "max_speed_mph": None,
            "over_limit": False,
            "message": None,
            "lat": None,
            "lng": None,
        }
        cameras = LiveService.get_speed_cameras(lat, lng, radius_m)["cameras"]
        best: dict | None = None
        for camera in cameras:
            distance_miles = _haversine_km(lat, lng, camera["lat"], camera["lng"]) * 0.621371
            camera_bearing = _bearing_degrees(lat, lng, camera["lat"], camera["lng"])
            if not _is_ahead(bearing, camera_bearing):
                continue
            tier = _camera_alert_tier(distance_miles)
            if tier is None:
                continue
            max_speed = camera.get("max_speed_mph")
            over_limit = max_speed is not None and speed_mph > max_speed
            candidate = {
                "camera_id": camera["camera_id"],
                "tier": tier,
                "distance_miles": round(distance_miles, 2),
                "max_speed_mph": max_speed,
                "over_limit": over_limit,
                "message": _camera_alert_message(tier, distance_miles, max_speed, over_limit),
                "lat": camera["lat"],
                "lng": camera["lng"],
            }
            if best is None or candidate["distance_miles"] < best["distance_miles"]:
                best = candidate
        return best if best is not None else empty

    @staticmethod
    def record_track_point(
        db: Session,
        user_id: uuid.UUID,
        session_id: uuid.UUID,
        lat: float,
        lng: float,
        speed_mph: float,
        bearing: float,
        ts: str,
    ) -> dict[str, int | bool]:
        track = db.execute(
            select(TripTrack).where(
                TripTrack.session_id == session_id,
                TripTrack.user_id == user_id,
            )
        ).scalar_one_or_none()

        if track is None:
            session = db.execute(
                select(LiveSession).where(LiveSession.id == session_id)
            ).scalar_one_or_none()
            if not session:
                AppException.not_found("Live session not found")
            if session.started_by != user_id:
                AppException.forbidden("You do not own this live session")
            track = TripTrack(
                user_id=user_id,
                session_id=session_id,
                trip_id=session.trip_id,
                track_points=[],
                started_at=datetime.now(timezone.utc),
            )
            db.add(track)

        points = list(track.track_points or [])
        points.append(
            {
                "lat": lat,
                "lng": lng,
                "speed_mph": speed_mph,
                "bearing": bearing,
                "ts": ts,
            }
        )
        if len(points) > MAX_TRACK_POINTS:
            points = points[-MAX_TRACK_POINTS:]
        track.track_points = points
        db.commit()
        db.refresh(track)
        return {"recorded": True, "point_count": len(points)}

    @staticmethod
    def end_track(
        db: Session,
        user_id: uuid.UUID,
        session_id: uuid.UUID,
        reports_encountered: int,
        cameras_passed: int,
    ) -> dict:
        track = db.execute(
            select(TripTrack).where(
                TripTrack.session_id == session_id,
                TripTrack.user_id == user_id,
            )
        ).scalar_one_or_none()
        if not track:
            AppException.not_found("Trip track not found")

        points = list(track.track_points or [])
        stats = _calculate_track_stats(points)
        track.total_distance_m = stats["total_distance_m"]
        track.total_duration_s = stats["total_duration_s"]
        track.max_speed_mph = stats["max_speed_mph"]
        track.avg_speed_mph = stats["avg_speed_mph"]
        track.reports_encountered = reports_encountered
        track.cameras_passed = cameras_passed
        track.ended_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(track)
        return _trip_track_to_dict(track)

    @staticmethod
    def get_track(
        db: Session,
        user_id: uuid.UUID,
        session_id: uuid.UUID,
    ) -> dict:
        track = db.execute(
            select(TripTrack).where(TripTrack.session_id == session_id)
        ).scalar_one_or_none()
        if not track:
            AppException.not_found("Trip track not found")
        if track.user_id != user_id:
            AppException.forbidden("You do not have access to this trip track")
        return _trip_track_to_dict(track)

    @staticmethod
    def get_track_history(db: Session, user_id: uuid.UUID) -> list[dict]:
        tracks = db.execute(
            select(TripTrack)
            .where(TripTrack.user_id == user_id)
            .order_by(TripTrack.created_at.desc())
            .limit(10)
        ).scalars().all()
        return [_trip_track_summary_dict(track) for track in tracks]

    @staticmethod
    def create_spectator_invite(db: Session, user_id: uuid.UUID) -> dict:
        session = db.execute(
            select(LiveSession)
            .where(
                LiveSession.started_by == user_id,
                LiveSession.is_active.is_(True),
            )
            .order_by(LiveSession.started_at.desc())
        ).scalar_one_or_none()
        if not session:
            AppException.not_found("No active live session")

        token = secrets.token_urlsafe(32)
        expires_at = session.started_at + timedelta(hours=24)
        invite = SpectatorInvite(
            session_id=session.id,
            host_user_id=user_id,
            invite_token=token,
            expires_at=expires_at,
        )
        db.add(invite)
        db.commit()
        db.refresh(invite)
        return {
            "invite_token": invite.invite_token,
            "share_url": f"https://rovvy.app/live/watch/{invite.invite_token}",
            "expires_at": invite.expires_at,
        }

    @staticmethod
    def validate_spectator_invite(db: Session, user_id: uuid.UUID, token: str) -> dict:
        invite = db.execute(
            select(SpectatorInvite).where(SpectatorInvite.invite_token == token)
        ).scalar_one_or_none()
        if not invite:
            AppException.not_found("Invalid invite link")
        if not invite.is_active:
            AppException.bad_request("This invite has expired")
        if invite.expires_at < datetime.now(timezone.utc):
            AppException.bad_request("This invite has expired")

        session = db.execute(
            select(LiveSession).where(LiveSession.id == invite.session_id)
        ).scalar_one_or_none()
        if not session or not session.is_active:
            AppException.bad_request("This trip has ended")

        host = db.execute(
            select(User).where(User.id == invite.host_user_id)
        ).scalar_one_or_none()
        if not host:
            AppException.not_found("Host not found")

        return {
            "session_id": session.id,
            "host_name": host.full_name,
            "host_avatar": host.avatar_url,
            "trip_id": session.trip_id,
            "started_at": session.started_at,
            "firebase_path": f"live_locations/{invite.host_user_id}",
        }

    @staticmethod
    def deactivate_spectator_invite(
        db: Session,
        user_id: uuid.UUID,
        token: str,
    ) -> None:
        invite = db.execute(
            select(SpectatorInvite).where(SpectatorInvite.invite_token == token)
        ).scalar_one_or_none()
        if not invite:
            AppException.not_found("Invalid invite link")
        if invite.host_user_id != user_id:
            AppException.forbidden("Only the host can deactivate this invite")
        invite.is_active = False
        db.commit()

    @staticmethod
    def get_spectator_host_location(
        db: Session,
        viewer_user_id: uuid.UUID,
        session_id: uuid.UUID,
    ) -> dict:
        session = db.execute(
            select(LiveSession).where(LiveSession.id == session_id)
        ).scalar_one_or_none()
        if not session:
            AppException.not_found("Live session not found")
        if session.started_by == viewer_user_id:
            AppException.forbidden("Hosts cannot use the spectator location endpoint")
        return {"firebase_path": f"live_locations/{session.started_by}"}

    @staticmethod
    def get_spectator_active_count(
        db: Session,
        user_id: uuid.UUID,
        session_id: uuid.UUID,
    ) -> dict:
        session = db.execute(
            select(LiveSession).where(LiveSession.id == session_id)
        ).scalar_one_or_none()
        if not session:
            AppException.not_found("Live session not found")
        if session.started_by != user_id:
            AppException.forbidden("Only the host can view spectator count")

        count = db.execute(
            select(func.count())
            .select_from(SpectatorInvite)
            .where(
                SpectatorInvite.session_id == session_id,
                SpectatorInvite.is_active.is_(True),
            )
        ).scalar_one()
        return {"count": int(count or 0)}

    @staticmethod
    def get_route_alerts(
        db: Session,
        lat: float,
        lng: float,
        bearing: float,
        speed_mph: float,
    ) -> dict[str, list[dict]]:
        now = datetime.now(timezone.utc)
        reports = db.execute(
            select(RoadReport).where(
                RoadReport.is_active.is_(True),
                RoadReport.expires_at > now,
                RoadReport.report_type.in_(
                    [ReportType.police, ReportType.accident, ReportType.closure]
                ),
            )
        ).scalars().all()

        alerts: list[dict] = []
        for report in reports:
            distance_km = _haversine_km(lat, lng, report.lat, report.lng)
            distance_miles = distance_km * 0.621371
            if distance_miles > 8.0:
                continue

            report_bearing = _bearing_degrees(lat, lng, report.lat, report.lng)
            if not _is_ahead(bearing, report_bearing):
                continue

            tier = _route_alert_tier(distance_miles)
            if tier is None:
                continue

            minutes_away = None
            if speed_mph > 5:
                minutes_away = round((distance_miles / speed_mph) * 60, 1)

            message = _route_alert_message(
                report.report_type.value,
                distance_miles,
                minutes_away,
            )
            alerts.append(
                {
                    "alert_id": f"{report.id}:{tier}",
                    "report_type": report.report_type.value,
                    "tier": tier,
                    "distance_miles": round(distance_miles, 1),
                    "minutes_away": minutes_away,
                    "message": message,
                }
            )

        alerts.sort(key=lambda item: item["distance_miles"])
        return {"alerts": alerts}

    @staticmethod
    def get_nearby_travelers(
        user_id: uuid.UUID,
        lat: float,
        lng: float,
        bearing: float,
        speed_mph: float,
    ) -> list[dict]:
        raw = get_rtdb("live_locations") or {}
        if not isinstance(raw, dict):
            return []

        now = datetime.now(timezone.utc)
        travelers: list[dict] = []
        for other_id, payload in raw.items():
            if other_id == str(user_id) or not isinstance(payload, dict):
                continue

            last_seen_raw = payload.get("last_seen")
            if not last_seen_raw:
                continue
            try:
                last_seen = datetime.fromisoformat(str(last_seen_raw))
                if last_seen.tzinfo is None:
                    last_seen = last_seen.replace(tzinfo=timezone.utc)
            except ValueError:
                continue
            if (now - last_seen).total_seconds() > 600:
                continue

            other_lat = payload.get("lat")
            other_lng = payload.get("lng")
            if other_lat is None or other_lng is None:
                continue

            distance_km = _haversine_km(lat, lng, float(other_lat), float(other_lng))
            distance_miles = distance_km * 0.621371
            if distance_miles > 5.0:
                continue

            other_bearing = float(payload.get("bearing") or 0)
            traveler_bearing = _bearing_degrees(
                lat, lng, float(other_lat), float(other_lng)
            )
            if not _is_same_direction(bearing, other_bearing, traveler_bearing):
                continue

            try:
                target_id = uuid.UUID(str(other_id))
            except ValueError:
                continue

            traveler_id = _traveler_id(user_id, target_id)
            ahead = _is_ahead(bearing, traveler_bearing)
            direction = "ahead" if ahead else "nearby"
            travelers.append(
                {
                    "traveler_id": traveler_id,
                    "distance_miles": round(distance_miles, 1),
                    "label": f"Traveler {distance_miles:.1f} mi {direction}",
                    "lat": float(other_lat),
                    "lng": float(other_lng),
                    "bearing": other_bearing if payload.get("bearing") is not None else None,
                }
            )

        travelers.sort(key=lambda item: item["distance_miles"])
        return travelers

    @staticmethod
    def send_traveler_chat(
        user_id: uuid.UUID,
        traveler_id: str,
        text: str,
        sender_session_key: str,
    ) -> dict:
        target_id = _resolve_traveler_target(user_id, traveler_id)
        if not target_id:
            AppException.not_found("Traveler not found")

        _check_traveler_chat_rate(sender_session_key)
        filtered_text = _filter_message(text)

        message_id = str(uuid.uuid4())
        sent_at = datetime.now(timezone.utc)
        expires_at = sent_at + timedelta(hours=2)
        message_data = {
            "id": message_id,
            "text": filtered_text,
            "sender_session_key": sender_session_key.strip(),
            "sender_label": "You",
            "sent_at": sent_at.isoformat(),
            "expires_at": expires_at.isoformat(),
        }
        set_rtdb(
            f"live_traveler_chats/{traveler_id}/messages/{message_id}",
            message_data,
        )
        return {
            "message_id": message_id,
            "sent_at": sent_at,
            "text": filtered_text,
            "sender_label": "You",
        }

    @staticmethod
    def get_traveler_chat(
        user_id: uuid.UUID,
        traveler_id: str,
        sender_session_key: str,
    ) -> list[dict]:
        if not _resolve_traveler_target(user_id, traveler_id):
            AppException.not_found("Traveler not found")

        raw = get_rtdb(f"live_traveler_chats/{traveler_id}/messages")
        if not raw:
            return []

        now = datetime.now(timezone.utc)
        session_key = sender_session_key.strip()
        messages: list[dict] = []
        for message_id, payload in raw.items():
            if not isinstance(payload, dict):
                continue
            expires_raw = payload.get("expires_at")
            if expires_raw:
                try:
                    expires_at = datetime.fromisoformat(str(expires_raw))
                    if expires_at.tzinfo is None:
                        expires_at = expires_at.replace(tzinfo=timezone.utc)
                    if expires_at <= now:
                        continue
                except ValueError:
                    pass

            own = payload.get("sender_session_key") == session_key
            messages.append(
                {
                    "id": payload.get("id") or message_id,
                    "text": payload.get("text") or "",
                    "sender_label": "You" if own else "Traveler nearby",
                    "sent_at": payload.get("sent_at") or "",
                }
            )
        messages.sort(key=lambda item: item.get("sent_at") or "")
        return messages

    @staticmethod
    def flag_traveler_chat_message(
        user_id: uuid.UUID,
        traveler_id: str,
        message_id: str,
    ) -> dict[str, bool]:
        if not _resolve_traveler_target(user_id, traveler_id):
            AppException.not_found("Traveler not found")

        path = f"live_traveler_chats/{traveler_id}/messages/{message_id}"
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

    _MAX_EMERGENCY_CONTACTS = 5

    @staticmethod
    def get_emergency_contacts(db: Session, user_id: uuid.UUID) -> list[EmergencyContact]:
        return list(
            db.execute(
                select(EmergencyContact)
                .where(EmergencyContact.user_id == user_id)
                .order_by(EmergencyContact.name.asc())
            )
            .scalars()
            .all()
        )

    @staticmethod
    def add_emergency_contact(
        db: Session,
        user_id: uuid.UUID,
        name: str,
        phone: str,
    ) -> EmergencyContact:
        count = db.execute(
            select(func.count())
            .select_from(EmergencyContact)
            .where(EmergencyContact.user_id == user_id)
        ).scalar_one()
        if int(count) >= LiveService._MAX_EMERGENCY_CONTACTS:
            AppException.bad_request("Maximum 5 emergency contacts")

        contact = EmergencyContact(
            user_id=user_id,
            name=name.strip(),
            phone=phone.strip(),
        )
        db.add(contact)
        db.commit()
        db.refresh(contact)
        return contact

    @staticmethod
    def delete_emergency_contact(
        db: Session,
        user_id: uuid.UUID,
        contact_id: uuid.UUID,
    ) -> None:
        contact = db.execute(
            select(EmergencyContact).where(EmergencyContact.id == contact_id)
        ).scalar_one_or_none()
        if not contact:
            AppException.not_found("Emergency contact not found")
        if contact.user_id != user_id:
            AppException.forbidden("You do not own this emergency contact")
        db.delete(contact)
        db.commit()

    @staticmethod
    def trigger_sos(
        db: Session,
        user_id: uuid.UUID,
        lat: float,
        lng: float,
        trip_id: uuid.UUID | None,
        message: str,
    ) -> dict:
        user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
        if not user:
            AppException.not_found("User not found")

        contacts = LiveService.get_emergency_contacts(db, user_id)
        user_name = user.full_name or "Traveler"
        maps_url = f"https://maps.google.com/?q={lat},{lng}"
        sms_template = (
            f"🆘 EMERGENCY: {user_name} needs help. "
            f"Last known location: {maps_url} — Sent via Rovvy"
        )

        fcm_sent = 0
        if trip_id is not None:
            trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
            if trip:
                TripService._verify_membership(db, trip.group_id, user_id)
                members = NotificationService._group_members_with_fcm_tokens(
                    db,
                    trip.group_id,
                )
                title = f"🆘 SOS — {user_name} needs help"
                body = f"Last location: {lat:.4f}, {lng:.4f}"
                payload = {
                    "type": "sos",
                    "lat": str(lat),
                    "lng": str(lng),
                    "user_id": str(user_id),
                    "trip_id": str(trip_id),
                }
                for member in members:
                    try:
                        if NotificationService.send_to_token(
                            member.fcm_token or "",
                            title,
                            body,
                            payload,
                        ):
                            fcm_sent += 1
                    except Exception as exc:  # noqa: BLE001
                        logger.warning("FCM SOS failed: %s", exc)

                set_rtdb(
                    f"trips/{trip_id}/live/sos",
                    {
                        "user_id": str(user_id),
                        "user_name": user_name,
                        "lat": lat,
                        "lng": lng,
                        "message": message,
                        "triggered_at": datetime.now(timezone.utc).isoformat(),
                    },
                )

        return {
            "sos_triggered": True,
            "fcm_sent_to": fcm_sent,
            "emergency_contacts": [
                {"name": contact.name, "phone": contact.phone} for contact in contacts
            ],
            "sms_template": sms_template,
            "google_maps_url": maps_url,
        }

    @staticmethod
    def set_geofence(
        db: Session,
        user_id: uuid.UUID,
        trip_id: uuid.UUID,
        center_lat: float,
        center_lng: float,
        radius_m: float,
        label: str,
    ) -> dict:
        trip = LiveService._get_trip_for_member(db, user_id, trip_id)
        LiveService._require_trip_admin(db, trip, user_id)
        set_at = datetime.now(timezone.utc).isoformat()
        data = {
            "center_lat": center_lat,
            "center_lng": center_lng,
            "radius_m": radius_m,
            "label": label,
            "set_by": str(user_id),
            "set_at": set_at,
        }
        set_rtdb(f"trips/{trip_id}/live/geofence", data)
        return data

    @staticmethod
    def delete_geofence(
        db: Session,
        user_id: uuid.UUID,
        trip_id: uuid.UUID,
    ) -> None:
        trip = LiveService._get_trip_for_member(db, user_id, trip_id)
        LiveService._require_trip_admin(db, trip, user_id)
        delete_rtdb(f"trips/{trip_id}/live/geofence")

    @staticmethod
    def update_battery_level(
        db: Session,
        user_id: uuid.UUID,
        trip_id: uuid.UUID,
        level: int,
    ) -> dict:
        trip = LiveService._get_trip_for_member(db, user_id, trip_id)
        update_rtdb(
            f"trips/{trip_id}/live/members/{user_id}",
            {"battery_level": level},
        )

        alert_sent = False
        if level <= 20:
            user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
            user_name = user.full_name if user else "A member"
            alert_sent = (
                LiveService._send_fcm_to_trip_members(
                    db,
                    trip,
                    "🔋 Low battery",
                    f"{user_name}'s battery is at {level}%",
                    "live_low_battery",
                )
                > 0
            )

        return {"battery_level": level, "alert_sent": alert_sent}

    @staticmethod
    def wayra_live_chat(message: str, context: dict) -> dict[str, str | None]:
        msg = message.strip()
        if not msg:
            AppException.bad_request("message is required")
        if len(msg) > 500:
            AppException.bad_request("message too long")

        ctx = context or {}
        lat = float(ctx.get("lat") or 0)
        lng = float(ctx.get("lng") or 0)
        speed_mph = float(ctx.get("speed_mph") or 0)
        active_reports = ctx.get("active_reports") or []
        if not isinstance(active_reports, list):
            active_reports = []
        weather_code = ctx.get("weather_code")
        members = ctx.get("members") or []
        if not isinstance(members, list):
            members = []
        route_destination = ctx.get("route_destination") or "None"

        system_prompt = WAYRA_LIVE_SYSTEM_PROMPT.format(
            lat=lat,
            lng=lng,
            speed_mph=speed_mph,
            active_reports=", ".join(str(item) for item in active_reports) or "none",
            weather_description=_weather_description(
                weather_code if isinstance(weather_code, int) else None
            ),
            member_count=len(members) if members else 1,
            route_destination=route_destination,
        )
        reply = _call_wayra_live_gemini(system_prompt, msg)
        action = _detect_wayra_live_action(msg, reply)
        return {"reply": reply, "action": action}

    @staticmethod
    def wayra_analyze(payload: dict) -> dict[str, str | None]:
        lat = float(payload.get("lat") or 0)
        lng = float(payload.get("lng") or 0)
        speed_mph = float(payload.get("speed_mph") or 0)
        member_positions = payload.get("member_positions") or []
        active_reports = payload.get("active_reports") or []
        nearby_reports = payload.get("nearby_reports") or []
        weather_code = payload.get("weather_code")
        route_geometry = payload.get("route_geometry")

        if not isinstance(member_positions, list):
            member_positions = []
        if not isinstance(active_reports, list):
            active_reports = []
        if not isinstance(nearby_reports, list):
            nearby_reports = []

        no_alert = {"alert_type": None, "message": None, "severity": None, "action": None}

        # CHECK 1 — Group split
        valid_members = [
            item
            for item in member_positions
            if isinstance(item, dict)
            and item.get("lat") is not None
            and item.get("lng") is not None
        ]
        if len(valid_members) >= 3:
            centroid_lat = sum(float(item["lat"]) for item in valid_members) / len(
                valid_members
            )
            centroid_lng = sum(float(item["lng"]) for item in valid_members) / len(
                valid_members
            )
            farthest = max(
                valid_members,
                key=lambda item: _haversine_km(
                    float(item["lat"]),
                    float(item["lng"]),
                    centroid_lat,
                    centroid_lng,
                ),
            )
            distance_km = _haversine_km(
                float(farthest["lat"]),
                float(farthest["lng"]),
                centroid_lat,
                centroid_lng,
            )
            if distance_km > 2.0:
                name = str(farthest.get("display_name") or "A member")
                return {
                    "alert_type": "group_split",
                    "message": (
                        f"{name} is {distance_km:.1f}km behind the group. "
                        "Consider waiting at the next stop."
                    ),
                    "severity": "warning",
                    "action": None,
                }

        # CHECK 2 — Hazard on route
        hazard_types = {"accident", "closure"}
        report_types = {str(item).lower() for item in active_reports}
        if route_geometry and isinstance(route_geometry, dict):
            report_points = [
                item
                for item in nearby_reports
                if isinstance(item, dict)
                and str(item.get("report_type", "")).lower() in hazard_types
            ]
            if not report_points and report_types.intersection(hazard_types):
                report_points = [
                    {"report_type": item}
                    for item in active_reports
                    if str(item).lower() in hazard_types
                ]
            for report in report_points:
                report_lat = report.get("lat")
                report_lng = report.get("lng")
                if report_lat is None or report_lng is None:
                    continue
                distance_m = _distance_to_route_line(
                    float(report_lat),
                    float(report_lng),
                    route_geometry,
                )
                if distance_m <= 300:
                    report_type = str(report.get("report_type") or "hazard")
                    return {
                        "alert_type": "hazard_on_route",
                        "message": (
                            f"There's a reported {report_type} on your route ahead. "
                            "Consider an alternate path."
                        ),
                        "severity": "warning",
                        "action": "open_navigation",
                    }

        # CHECK 3 — Weather reroute
        if isinstance(weather_code, int):
            if 95 <= weather_code <= 99:
                return {
                    "alert_type": "weather_severe",
                    "message": (
                        "Severe storm detected on your route. "
                        "Find shelter or take an alternate route."
                    ),
                    "severity": "danger",
                    "action": None,
                }
            if 51 <= weather_code <= 82 and speed_mph > 60:
                return {
                    "alert_type": "weather_rain_speed",
                    "message": "Rain detected. Reduce speed for safety.",
                    "severity": "info",
                    "action": None,
                }

        # CHECK 4 — Speeding advisory
        if speed_mph > 80:
            return {
                "alert_type": "speed_advisory",
                "message": (
                    "You're traveling fast. Stay alert and maintain safe following distance."
                ),
                "severity": "info",
                "action": None,
            }

        return no_alert


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


def _weather_description(code: int | None) -> str:
    if code is None:
        return "Unknown"
    if code == 0:
        return "Clear"
    if 1 <= code <= 3:
        return "Partly cloudy"
    if code in (45, 48):
        return "Foggy"
    if 51 <= code <= 67:
        return "Rain"
    if 71 <= code <= 77:
        return "Snow"
    if 80 <= code <= 82:
        return "Showers"
    if 95 <= code <= 99:
        return "Thunderstorm"
    return "Mixed conditions"


def _detect_wayra_live_action(message: str, reply: str) -> str | None:
    combined = f"{message} {reply}".lower()
    if any(
        phrase in combined
        for phrase in (
            "sos",
            "emergency",
            "call for help",
            "need help now",
            "trigger sos",
        )
    ):
        return "call_sos"
    if any(
        phrase in combined
        for phrase in (
            "poi search",
            "search icon",
            "find near me",
            "nearby",
            "restaurant",
            "gas station",
            "food near",
            "coffee near",
            "bathroom",
            "parking near",
        )
    ):
        return "open_poi_search"
    if any(
        phrase in combined
        for phrase in (
            "search bar",
            "navigation",
            "directions",
            "route to",
            "drive to",
            "navigate to",
        )
    ):
        return "open_navigation"
    return None


def _extract_gemini_text(data: dict) -> str:
    candidates = data.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        return ""
    first = candidates[0]
    if not isinstance(first, dict):
        return ""
    content = first.get("content")
    if not isinstance(content, dict):
        return ""
    parts = content.get("parts")
    if not isinstance(parts, list):
        return ""
    chunks: list[str] = []
    for part in parts:
        if isinstance(part, dict) and isinstance(part.get("text"), str):
            chunks.append(part["text"])
    return "".join(chunks).strip()


def _call_wayra_live_gemini(system_prompt: str, message: str) -> str:
    api_key = _gemini_key()
    if not api_key:
        return "Wayra is temporarily unavailable. Please try again later."

    body = {
        "systemInstruction": {"parts": [{"text": system_prompt.strip()}]},
        "contents": [{"role": "user", "parts": [{"text": message}]}],
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 256,
        },
    }
    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            response = client.post(_GEMINI_URL, params={"key": api_key}, json=body)
        if response.status_code != 200:
            logger.debug(
                "Wayra live Gemini HTTP %s: %s",
                response.status_code,
                response.text[:300],
            )
            return "I couldn't respond right now. Please try again."
        text = _extract_gemini_text(response.json())
        return text or "I couldn't process that right now. Please try again."
    except Exception as exc:
        logger.debug("Wayra live Gemini failed: %s", exc)
        return "Wayra is temporarily offline. Please try again."


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    return _haversine_km(lat1, lng1, lat2, lng2) * 1000.0


def _point_to_segment_distance_m(
    lat: float,
    lng: float,
    a: tuple[float, float],
    b: tuple[float, float],
) -> float:
    lng1, lat1 = a
    lng2, lat2 = b
    dx = lng2 - lng1
    dy = lat2 - lat1
    if dx == 0 and dy == 0:
        return _haversine_m(lat, lng, lat1, lng1)
    t = max(0.0, min(1.0, ((lng - lng1) * dx + (lat - lat1) * dy) / (dx * dx + dy * dy)))
    proj_lat = lat1 + t * dy
    proj_lng = lng1 + t * dx
    return _haversine_m(lat, lng, proj_lat, proj_lng)


def _distance_to_route_line(
    lat: float,
    lng: float,
    geometry: dict,
) -> float:
    coords = geometry.get("coordinates")
    if not isinstance(coords, list) or len(coords) < 2:
        return float("inf")
    min_dist = float("inf")
    for index in range(len(coords) - 1):
        a_raw = coords[index]
        b_raw = coords[index + 1]
        if not isinstance(a_raw, list) or not isinstance(b_raw, list):
            continue
        if len(a_raw) < 2 or len(b_raw) < 2:
            continue
        a = (float(a_raw[0]), float(a_raw[1]))
        b = (float(b_raw[0]), float(b_raw[1]))
        distance_m = _point_to_segment_distance_m(lat, lng, a, b)
        if distance_m < min_dist:
            min_dist = distance_m
    return min_dist


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
