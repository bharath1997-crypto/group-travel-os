"""
Public trip preview — no membership required; respects profile privacy.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.group import GroupMember, MemberRole
from app.models.location import Location, TripLocation
from app.models.trip import Trip
from app.models.trip_join_request import TripJoinRequest
from app.models.trip_roster import TripRoster
from app.models.user import User
from app.utils.exceptions import AppException


def _is_online(last_seen: datetime | None) -> bool:
    if last_seen is None:
        return False
    return datetime.now(timezone.utc) - last_seen < timedelta(minutes=2)


class TripPublicService:
    @staticmethod
    def get_public_preview(
        db: Session,
        trip_id: uuid.UUID,
        viewer_id: uuid.UUID | None,
    ) -> dict:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        group_id = trip.group_id

        is_member = False
        viewer_is_group_admin = False
        if viewer_id is not None:
            m = db.execute(
                select(GroupMember).where(
                    GroupMember.group_id == group_id,
                    GroupMember.user_id == viewer_id,
                )
            ).scalar_one_or_none()
            is_member = m is not None
            if m is not None and m.role == MemberRole.admin:
                viewer_is_group_admin = True

        loc_rows = db.execute(
            select(Location)
            .join(TripLocation, TripLocation.location_id == Location.id)
            .where(TripLocation.trip_id == trip_id)
        ).scalars().unique().all()

        locations_out = [
            {
                "id": str(loc.id),
                "name": loc.name,
                "address": loc.address,
                "latitude": loc.latitude,
                "longitude": loc.longitude,
                "category": loc.category,
            }
            for loc in loc_rows
        ]

        members = db.execute(
            select(GroupMember)
            .where(GroupMember.group_id == group_id)
            .order_by(GroupMember.joined_at.asc())
        ).scalars().all()

        pending_request = False
        if viewer_id is not None and not is_member:
            pr = db.execute(
                select(TripJoinRequest).where(
                    TripJoinRequest.trip_id == trip_id,
                    TripJoinRequest.user_id == viewer_id,
                    TripJoinRequest.status == "pending",
                )
            ).scalar_one_or_none()
            pending_request = pr is not None

        user_ids = [m.user_id for m in members]
        users_by_id: dict[uuid.UUID, User] = {}
        if user_ids:
            urows = db.execute(select(User).where(User.id.in_(user_ids))).scalars().all()
            users_by_id = {u.id: u for u in urows}

        roster_map: dict[uuid.UUID, str | None] = {}
        roster_rows = db.execute(
            select(TripRoster).where(TripRoster.trip_id == trip_id)
        ).scalars().all()
        for r in roster_rows:
            roster_map[r.user_id] = r.note

        total = len(members)
        private_count = 0
        public_participants: list[dict] = []

        for gm in members:
            user = users_by_id.get(gm.user_id)
            if not user:
                continue
            if not user.profile_public:
                private_count += 1
                continue
            note = roster_map.get(user.id)
            public_participants.append(
                {
                    "user_id": str(user.id),
                    "full_name": user.full_name,
                    "avatar_url": user.avatar_url,
                    "trip_note": note,
                    "is_online": _is_online(gm.last_seen_at),
                }
            )

        return {
            "trip": {
                "id": str(trip.id),
                "group_id": str(trip.group_id),
                "title": trip.title,
                "description": trip.description,
                "status": trip.status.value if hasattr(trip.status, "value") else str(trip.status),
                "start_date": trip.start_date.isoformat() if trip.start_date else None,
                "end_date": trip.end_date.isoformat() if trip.end_date else None,
            },
            "locations": locations_out,
            "member_count_total": total,
            "member_count_private": private_count,
            "member_count_public": total - private_count,
            "public_participants": public_participants,
            "viewer_is_member": is_member,
            "viewer_has_pending_request": pending_request,
            "viewer_is_group_admin": viewer_is_group_admin,
        }
