"""
app/services/live_session_service.py — Live coordination (DB sessions + Firebase RTDB + FCM)
"""
from __future__ import annotations

import logging
import math
import random
import secrets
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.group import GroupMember, MemberRole
from app.models.live_checklist import LiveChecklist
from app.models.live_session import LiveSession
from app.models.trip import Trip, TripStatus
from app.models.user import User
from app.services.group_service import GroupService
from app.services.trip_service import TripService
from app.utils.exceptions import AppException
from app.utils.firebase import delete_rtdb, set_rtdb, update_rtdb

logger = logging.getLogger(__name__)

_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


class LiveSessionService:

    # ── helpers ─────────────────────────────────────────────────────────────

    @staticmethod
    def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        r = 6371000.0
        p1, p2 = math.radians(lat1), math.radians(lat2)
        d_phi = math.radians(lat2 - lat1)
        d_lbd = math.radians(lng2 - lng1)
        a = (
            math.sin(d_phi / 2) ** 2
            + math.cos(p1) * math.cos(p2) * math.sin(d_lbd / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return r * c

    @staticmethod
    def _member_row(db: Session, trip_id: uuid.UUID, user_id: uuid.UUID) -> tuple[Trip, GroupMember]:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")
        gm = TripService._verify_membership(db, trip.group_id, user_id)
        return trip, gm

    @staticmethod
    def _can_start_or_end_live(role: MemberRole) -> bool:
        return role in (MemberRole.admin, MemberRole.coordinator)

    @staticmethod
    def _generate_unique_session_code(db: Session) -> str:
        for _ in range(32):
            code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(8))
            clash = db.execute(
                select(LiveSession.id).where(LiveSession.session_code == code)
            ).first()
            if clash is None:
                return code
        # astronomically unlikely; fall back to mixed random.choice
        return "".join(random.choice(_CODE_ALPHABET) for _ in range(8))

    @staticmethod
    def _firebase_merge(path: str, data: dict) -> None:
        try:
            update_rtdb(path, data)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Firebase update skipped (%s): %s", path, exc)

    @staticmethod
    def _firebase_set(path: str, data: dict) -> None:
        try:
            set_rtdb(path, data)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Firebase set skipped (%s): %s", path, exc)

    @staticmethod
    def _firebase_delete(path: str) -> None:
        try:
            delete_rtdb(path)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Firebase delete skipped (%s): %s", path, exc)

    @staticmethod
    def _end_open_sessions_on_trip(db: Session, trip_id: uuid.UUID) -> None:
        now = datetime.now(timezone.utc)
        rows = db.execute(select(LiveSession).where(LiveSession.trip_id == trip_id)).scalars().all()
        for s in rows:
            if s.ended_at is None and s.status != "ended":
                s.status = "ended"
                s.ended_at = now

    @staticmethod
    def _write_live_session_firebase(
        trip_id: uuid.UUID,
        session_code: str,
        status: str,
        checklist_user_ids: list[uuid.UUID],
        mode: str = "GROUP",
    ) -> None:
        checklist = {str(uid): {"accepted": False} for uid in checklist_user_ids}
        LiveSessionService._firebase_set(
            f"trips/{trip_id}/live_session",
            {
                "status": status,
                "session_code": session_code,
                "checklist": checklist,
                "mode": mode,
            },
        )

    # ── public API ─────────────────────────────────────────────────────────

    @staticmethod
    def create_session(
        db: Session,
        trip_id: uuid.UUID,
        user_id: uuid.UUID,
        mode: str = "GROUP",
    ) -> LiveSession:
        trip, gm = LiveSessionService._member_row(db, trip_id, user_id)
        if not LiveSessionService._can_start_or_end_live(gm.role):
            AppException.forbidden("Only a group admin or coordinator can start a live session")

        LiveSessionService._end_open_sessions_on_trip(db, trip_id)
        db.flush()

        code = LiveSessionService._generate_unique_session_code(db)
        now = datetime.now(timezone.utc)
        session = LiveSession(
            trip_id=trip_id,
            started_by=user_id,
            session_code=code,
            status="active" if mode == "SOLO" else "pre_live",
            meet_radius_meters=200,
            mode=mode,
            started_at=now if mode == "SOLO" else None,
        )
        db.add(session)
        db.flush()

        members = db.execute(
            select(GroupMember).where(GroupMember.group_id == trip.group_id)
        ).scalars().all()
        member_ids = [m.user_id for m in members]
        for uid in member_ids:
            db.add(
                LiveChecklist(
                    session_id=session.id,
                    user_id=uid,
                    is_accepted=True if mode == "SOLO" else False,
                    accepted_at=now if mode == "SOLO" else None,
                )
            )
        db.commit()
        db.refresh(session)

        LiveSessionService._write_live_session_firebase(
            trip_id,
            code,
            "active" if mode == "SOLO" else "pre_live",
            member_ids,
            mode,
        )

        try:
            from app.services.notification_service import NotificationService

            NotificationService.notify_live_session_created(db, trip_id, user_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Live session created FCM skipped: %s", exc)

        return session

    @staticmethod
    def accept_checklist(db: Session, session_id: uuid.UUID, user_id: uuid.UUID) -> dict:
        session = db.execute(select(LiveSession).where(LiveSession.id == session_id)).scalar_one_or_none()
        if not session or session.ended_at is not None:
            AppException.not_found("Live session not found")

        if session.status not in ("pre_live", "active"):
            AppException.bad_request("This session is not accepting checklist updates")

        trip, _ = LiveSessionService._member_row(db, session.trip_id, user_id)

        row = db.execute(
            select(LiveChecklist).where(
                LiveChecklist.session_id == session_id,
                LiveChecklist.user_id == user_id,
            )
        ).scalar_one_or_none()
        if not row:
            AppException.forbidden("No checklist entry for this user")

        now = datetime.now(timezone.utc)
        row.is_accepted = True
        row.accepted_at = now
        db.flush()

        LiveSessionService._firebase_merge(
            f"trips/{session.trip_id}/live_session/checklist/{user_id}",
            {"accepted": True},
        )

        checklists = db.execute(
            select(LiveChecklist).where(LiveChecklist.session_id == session_id)
        ).scalars().all()
        all_ok = all(c.is_accepted for c in checklists)

        if all_ok and session.status == "pre_live":
            session.status = "active"
            session.started_at = now
            db.commit()
            LiveSessionService._firebase_merge(
                f"trips/{session.trip_id}/live_session",
                {"status": "active"},
            )
            try:
                from app.services.notification_service import NotificationService

                NotificationService.notify_live_everyone_ready(db, session.trip_id)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Live everyone-ready FCM skipped: %s", exc)
        else:
            db.commit()

        return {
            "session_id": str(session.id),
            "all_accepted": all_ok,
            "status": session.status,
        }

    @staticmethod
    def join_session(db: Session, session_id: uuid.UUID, user_id: uuid.UUID) -> LiveSession:
        session = db.execute(select(LiveSession).where(LiveSession.id == session_id)).scalar_one_or_none()
        if not session or session.ended_at is not None:
            AppException.not_found("Live session not found")

        LiveSessionService._member_row(db, session.trip_id, user_id)
        return session

    @staticmethod
    def join_by_code(db: Session, session_code: str, user_id: uuid.UUID) -> LiveSession:
        code = session_code.strip().upper()
        if len(code) != 8:
            AppException.bad_request("Invalid session code")

        session = db.execute(
            select(LiveSession).where(LiveSession.session_code == code)
        ).scalar_one_or_none()
        if not session or session.ended_at is not None:
            AppException.not_found("Live session not found")

        LiveSessionService._member_row(db, session.trip_id, user_id)
        return session

    @staticmethod
    def end_session(db: Session, session_id: uuid.UUID, user_id: uuid.UUID) -> dict:
        session = db.execute(select(LiveSession).where(LiveSession.id == session_id)).scalar_one_or_none()
        if not session:
            AppException.not_found("Live session not found")

        _, gm = LiveSessionService._member_row(db, session.trip_id, user_id)
        if not LiveSessionService._can_start_or_end_live(gm.role):
            AppException.forbidden("Only a group admin or coordinator can end the live session")

        if session.ended_at is not None:
            return {"ended": True, "session_id": str(session.id)}

        now = datetime.now(timezone.utc)
        session.status = "ended"
        session.ended_at = now
        db.commit()

        LiveSessionService._firebase_delete(f"trips/{session.trip_id}/live_session")

        try:
            from app.services.notification_service import NotificationService

            NotificationService.notify_live_session_ended(db, session.trip_id, user_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Live session ended FCM skipped: %s", exc)

        return {"ended": True, "session_id": str(session.id)}

    @staticmethod
    def check_group_formation(
        *,
        session: LiveSession,
        members_locations: list[dict],
    ) -> bool:
        pts: list[tuple[float, float]] = []
        for item in members_locations:
            lat = item.get("lat")
            lng = item.get("lng")
            if lat is None or lng is None:
                continue
            try:
                pts.append((float(lat), float(lng)))
            except (TypeError, ValueError):
                continue
        r = session.meet_radius_meters
        if len(pts) < 2:
            return len(pts) == 1
        for i in range(len(pts)):
            for j in range(i + 1, len(pts)):
                if LiveSessionService.haversine_m(pts[i][0], pts[i][1], pts[j][0], pts[j][1]) > r:
                    return False
        return True

    @staticmethod
    def session_for_trip(db: Session, trip_id: uuid.UUID, user_id: uuid.UUID) -> LiveSession | None:
        trip, _ = LiveSessionService._member_row(db, trip_id, user_id)
        stmt = (
            select(LiveSession)
            .where(
                LiveSession.trip_id == trip_id,
                LiveSession.ended_at.is_(None),
            )
            .order_by(LiveSession.created_at.desc())
            .limit(1)
        )
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def checklist_rows(
        db: Session,
        session_id: uuid.UUID,
        viewer_id: uuid.UUID,
    ) -> list[tuple[LiveChecklist, User | None]]:
        session = db.execute(select(LiveSession).where(LiveSession.id == session_id)).scalar_one_or_none()
        if not session:
            AppException.not_found("Live session not found")
        LiveSessionService._member_row(db, session.trip_id, viewer_id)

        rows = db.execute(
            select(LiveChecklist, User)
            .outerjoin(User, User.id == LiveChecklist.user_id)
            .where(LiveChecklist.session_id == session_id)
        ).all()
        return list(rows)

    @staticmethod
    def assign_coordinator(
        db: Session,
        session_id: uuid.UUID,
        target_user_id: uuid.UUID,
        actor: User,
    ) -> dict:
        session = db.execute(select(LiveSession).where(LiveSession.id == session_id)).scalar_one_or_none()
        if not session or session.ended_at is not None:
            AppException.not_found("Live session not found")

        trip = db.execute(select(Trip).where(Trip.id == session.trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        gm_actor = TripService._verify_membership(db, trip.group_id, actor.id)
        if gm_actor.role != MemberRole.admin:
            AppException.forbidden("Only group admins can assign coordinators")

        target = db.execute(
            select(GroupMember).where(
                GroupMember.group_id == trip.group_id,
                GroupMember.user_id == target_user_id,
            )
        ).scalar_one_or_none()
        if not target:
            AppException.not_found("Target user is not in this trip's group")

        if target.role == MemberRole.admin:
            return {"user_id": str(target_user_id), "role": target.role.value}

        updated = GroupService.change_member_role(
            db, trip.group_id, target_user_id, MemberRole.coordinator, actor
        )
        return {"user_id": str(target_user_id), "role": updated.role.value}

    @staticmethod
    def list_upcoming_trips(db: Session, user_id: uuid.UUID) -> list[dict]:
        today = date.today()
        stmt = (
            select(Trip, GroupMember)
            .join(GroupMember, GroupMember.group_id == Trip.group_id)
            .where(
                GroupMember.user_id == user_id,
                Trip.status.notin_((TripStatus.completed, TripStatus.cancelled)),
            )
        )
        rows = db.execute(stmt).all()
        out: list[dict] = []
        seen: set[uuid.UUID] = set()
        for trip, gm in rows:
            if trip.id in seen:
                continue
            if trip.end_date is not None and trip.end_date < today:
                continue

            seen.add(trip.id)
            members = db.execute(
                select(GroupMember, User)
                .join(User, User.id == GroupMember.user_id)
                .where(GroupMember.group_id == trip.group_id)
                .order_by(GroupMember.joined_at.asc())
            ).all()

            previews = [
                {
                    "user_id": str(u.id),
                    "avatar_url": u.avatar_url,
                }
                for _, u in members[:8]
            ]
            out.append(
                {
                    "trip_id": str(trip.id),
                    "title": trip.title,
                    "destination_hint": (trip.description or "")[:120] or None,
                    "start_date": trip.start_date,
                    "end_date": trip.end_date,
                    "group_id": str(trip.group_id),
                    "member_count": len(members),
                    "members_preview": previews,
                    "my_role": gm.role.value,
                }
            )

        def _sort_key(d: dict) -> tuple:
            sd = d.get("start_date")
            if sd is None:
                return (1, "")
            return (0, sd.isoformat())

        out.sort(key=_sort_key)
        return out

    @staticmethod
    def my_active_session(db: Session, user_id: uuid.UUID) -> dict | None:
        stmt = (
            select(LiveSession, Trip)
            .join(Trip, Trip.id == LiveSession.trip_id)
            .join(GroupMember, GroupMember.group_id == Trip.group_id)
            .where(
                GroupMember.user_id == user_id,
                LiveSession.ended_at.is_(None),
                LiveSession.status.in_(("pre_live", "active")),
            )
            .order_by(LiveSession.created_at.desc())
            .limit(1)
        )
        row = db.execute(stmt).first()
        if not row:
            return None
        session, trip = row
        count = db.execute(
            select(GroupMember).where(GroupMember.group_id == trip.group_id)
        ).scalars().all()
        return {
            "active": True,
            "session_id": str(session.id),
            "trip_id": str(trip.id),
            "status": session.status,
            "member_count": len(count),
        }

    @staticmethod
    def set_meet_point_rtdb(
        db: Session,
        trip_id: uuid.UUID,
        user_id: uuid.UUID,
        lat: float,
        lng: float,
        name: str,
    ) -> None:
        LiveSessionService._member_row(db, trip_id, user_id)
        LiveSessionService._firebase_set(
            f"trips/{trip_id}/meet_point",
            {"lat": lat, "lng": lng, "name": name},
        )
        try:
            from app.utils.firebase import push_rtdb
            push_rtdb(f"trips/{trip_id}/activity_feed", {
                "text": f"Meet point moved to {name}" if name else "Meet point moved",
                "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000)
            })
        except Exception as exc:
            logger.warning("Activity feed meet point push skipped: %s", exc)

        try:
            from app.services.notification_service import NotificationService

            NotificationService.notify_live_meet_point_set(db, trip_id, user_id, name)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Meet point FCM skipped: %s", exc)

    @staticmethod
    def set_quick_status(db: Session, trip_id: uuid.UUID, user_id: uuid.UUID, status: str) -> None:
        LiveSessionService._member_row(db, trip_id, user_id)
        now_ts = int(datetime.now(timezone.utc).timestamp())
        LiveSessionService._firebase_merge(
            f"trips/{trip_id}/locations/{user_id}",
            {"quick_status": status.strip(), "updated_at": now_ts},
        )
        user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
        username = user.full_name if user and user.full_name else "Someone"
        try:
            from app.utils.firebase import push_rtdb
            push_rtdb(f"trips/{trip_id}/activity_feed", {
                "text": f"{username} updated status: {status.strip()}",
                "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000)
            })
        except Exception as exc:
            logger.warning("Activity feed status push skipped: %s", exc)

    @staticmethod
    def notify_timer_ended(db: Session, trip_id: uuid.UUID, user_id: uuid.UUID) -> None:
        LiveSessionService._member_row(db, trip_id, user_id)
        try:
            from app.services.notification_service import NotificationService

            NotificationService.notify_live_timer_ended(db, trip_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Timer ended FCM skipped: %s", exc)

    @staticmethod
    def notify_group_formed(db: Session, session_id: uuid.UUID, user_id: uuid.UUID) -> None:
        session = db.execute(select(LiveSession).where(LiveSession.id == session_id)).scalar_one_or_none()
        if not session or session.ended_at is not None:
            AppException.not_found("Live session not found")
        LiveSessionService._member_row(db, session.trip_id, user_id)
        try:
            from app.services.notification_service import NotificationService

            NotificationService.notify_live_group_formed(db, session.trip_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Group formed FCM skipped: %s", exc)
