"""Invite link lookup and guest token issuance."""
from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.group import Group
from app.models.poll import Poll, PollStatus
from app.models.trip import Trip, TripStatus
from app.utils.exceptions import AppException
from app.utils.guest_token import create_guest_token

logger = logging.getLogger(__name__)

_ACTIVE_TRIP_STATUSES = (TripStatus.planning, TripStatus.locked)


class InviteService:

    @staticmethod
    def get_invite_context(db: Session, invite_code: str) -> dict:
        code = invite_code.strip()
        if not code:
            AppException.not_found("Invite not found")

        group = db.execute(
            select(Group).where(Group.invite_code == code)
        ).scalar_one_or_none()
        if not group:
            AppException.not_found("Invite not found")

        trip = db.execute(
            select(Trip)
            .where(
                Trip.group_id == group.id,
                Trip.status.in_(_ACTIVE_TRIP_STATUSES),
            )
            .order_by(Trip.created_at.desc())
            .limit(1)
        ).scalar_one_or_none()
        if not trip:
            AppException.not_found("No active trip found for this invite")

        polls = db.execute(
            select(Poll)
            .where(
                Poll.trip_id == trip.id,
                Poll.status == PollStatus.open,
            )
            .options(selectinload(Poll.options))
            .order_by(Poll.created_at.desc())
        ).scalars().all()

        guest_identifier = str(uuid.uuid4())
        guest_token = create_guest_token(trip.id, guest_identifier)

        logger.info(
            "Invite context issued: group=%s trip=%s polls=%d",
            group.id,
            trip.id,
            len(polls),
        )
        return {
            "group": group,
            "trip": trip,
            "polls": list(polls),
            "guest_token": guest_token,
            "guest_identifier": guest_identifier,
        }
