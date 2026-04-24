"""
app/services/poll_service.py — Polls, options, and votes

Rules:
- Session is always injected — never created here
- All errors raised via AppException
- Vote counts are computed with COUNT() at read time only
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.group import GroupMember, MemberRole
from app.models.poll import Poll, PollOption, PollStatus, PollType, Vote
from app.models.trip import Trip
from app.models.user import User
from app.services.trip_service import TripService
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)


def _vote_count_for_option(db: Session, option_id: uuid.UUID) -> int:
    n = db.execute(
        select(func.count()).select_from(Vote).where(Vote.option_id == option_id)
    ).scalar_one()
    return int(n)


def _attach_vote_counts_to_options(db: Session, poll: Poll) -> None:
    for opt in poll.options:
        cnt = _vote_count_for_option(db, opt.id)
        object.__setattr__(opt, "vote_count", cnt)


def _is_poll_creator_or_admin(
    db: Session,
    poll: Poll,
    trip: Trip,
    user_id: uuid.UUID,
) -> bool:
    if poll.created_by == user_id:
        return True
    admin = db.execute(
        select(GroupMember).where(
            GroupMember.group_id == trip.group_id,
            GroupMember.user_id == user_id,
            GroupMember.role == MemberRole.admin,
        )
    ).scalar_one_or_none()
    return admin is not None


def _load_poll_with_options(db: Session, poll_id: uuid.UUID) -> Poll | None:
    return db.execute(
        select(Poll)
        .where(Poll.id == poll_id)
        .options(selectinload(Poll.options))
    ).scalar_one_or_none()


class PollService:

    @staticmethod
    def create_poll(
        db: Session,
        trip_id: uuid.UUID,
        question: str,
        poll_type: PollType,
        options: list[dict[str, Any]],
        closes_at: datetime | None,
        current_user: User,
    ) -> Poll:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        TripService._verify_membership(db, trip.group_id, current_user.id)

        if len(options) < 2:
            AppException.bad_request("A poll must have at least two options")

        normalized: list[tuple[str, uuid.UUID | None]] = []
        for raw in options:
            if not isinstance(raw, dict):
                AppException.bad_request("Each option must be a dict with label and optional location_id")
            label = raw.get("label")
            if label is None or not str(label).strip():
                AppException.bad_request("Each option must have a non-empty label")
            loc_id = raw.get("location_id")
            if loc_id is not None and not isinstance(loc_id, uuid.UUID):
                try:
                    loc_id = uuid.UUID(str(loc_id))
                except (ValueError, TypeError):
                    AppException.bad_request("Invalid location_id for poll option")
            normalized.append((str(label).strip(), loc_id))

        poll = Poll(
            trip_id=trip_id,
            question=question,
            poll_type=poll_type,
            status=PollStatus.open,
            created_by=current_user.id,
            closes_at=closes_at,
        )
        db.add(poll)
        db.flush()

        for label, loc_id in normalized:
            db.add(
                PollOption(
                    poll_id=poll.id,
                    label=label,
                    location_id=loc_id,
                )
            )

        db.commit()
        out = _load_poll_with_options(db, poll.id)
        assert out is not None
        _attach_vote_counts_to_options(db, out)
        from app.services.notification_service import NotificationService

        NotificationService.on_poll_created(db, trip, out, current_user)
        logger.info("Poll created: %s on trip %s", out.id, trip_id)
        return out

    @staticmethod
    def get_poll(db: Session, poll_id: uuid.UUID, current_user: User) -> Poll:
        poll = _load_poll_with_options(db, poll_id)
        if not poll:
            AppException.not_found("Poll not found")

        trip = db.execute(select(Trip).where(Trip.id == poll.trip_id)).scalar_one()
        TripService._verify_membership(db, trip.group_id, current_user.id)

        _attach_vote_counts_to_options(db, poll)
        return poll

    @staticmethod
    def list_trip_polls(
        db: Session,
        trip_id: uuid.UUID,
        current_user: User,
    ) -> list[Poll]:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        TripService._verify_membership(db, trip.group_id, current_user.id)

        polls = db.execute(
            select(Poll)
            .where(Poll.trip_id == trip_id)
            .options(selectinload(Poll.options))
            .order_by(Poll.created_at.desc())
        ).scalars().all()
        return list(polls)

    @staticmethod
    def cast_vote(
        db: Session,
        poll_id: uuid.UUID,
        option_id: uuid.UUID,
        current_user: User,
    ) -> Poll:
        poll = db.execute(select(Poll).where(Poll.id == poll_id)).scalar_one_or_none()
        if not poll:
            AppException.not_found("Poll not found")

        trip = db.execute(select(Trip).where(Trip.id == poll.trip_id)).scalar_one()
        TripService._verify_membership(db, trip.group_id, current_user.id)

        if poll.status != PollStatus.open:
            AppException.bad_request("This poll is not open for voting")

        if poll.closes_at is not None:
            now = datetime.now(timezone.utc)
            deadline = poll.closes_at
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone.utc)
            if now > deadline:
                AppException.bad_request("This poll has closed")

        existing = db.execute(
            select(Vote).where(
                Vote.poll_id == poll_id,
                Vote.user_id == current_user.id,
            )
        ).scalar_one_or_none()
        if existing:
            AppException.conflict("You have already voted on this poll")

        option = db.execute(
            select(PollOption).where(
                PollOption.id == option_id,
                PollOption.poll_id == poll_id,
            )
        ).scalar_one_or_none()
        if not option:
            AppException.bad_request("This option does not belong to this poll")

        db.add(
            Vote(
                poll_id=poll_id,
                option_id=option_id,
                user_id=current_user.id,
            )
        )
        db.commit()

        out = _load_poll_with_options(db, poll_id)
        assert out is not None
        _attach_vote_counts_to_options(db, out)
        logger.info("Vote cast: poll %s option %s user %s", poll_id, option_id, current_user.id)
        return out

    @staticmethod
    def close_poll(db: Session, poll_id: uuid.UUID, current_user: User) -> Poll:
        poll = db.execute(select(Poll).where(Poll.id == poll_id)).scalar_one_or_none()
        if not poll:
            AppException.not_found("Poll not found")

        trip = db.execute(select(Trip).where(Trip.id == poll.trip_id)).scalar_one()

        if not _is_poll_creator_or_admin(db, poll, trip, current_user.id):
            AppException.forbidden("Only the poll creator or a group admin can close this poll")

        poll.status = PollStatus.closed
        db.commit()
        db.refresh(poll)

        out = _load_poll_with_options(db, poll_id)
        assert out is not None
        _attach_vote_counts_to_options(db, out)
        logger.info("Poll closed: %s", poll_id)
        return out

    @staticmethod
    def get_poll_results(
        db: Session,
        poll_id: uuid.UUID,
        current_user: User,
    ) -> dict[str, Any]:
        poll = _load_poll_with_options(db, poll_id)
        if not poll:
            AppException.not_found("Poll not found")

        trip = db.execute(select(Trip).where(Trip.id == poll.trip_id)).scalar_one()
        TripService._verify_membership(db, trip.group_id, current_user.id)

        results: list[dict[str, Any]] = []
        for opt in poll.options:
            vote_count = _vote_count_for_option(db, opt.id)
            results.append(
                {
                    "option_id": opt.id,
                    "label": opt.label,
                    "vote_count": vote_count,
                    "location_id": opt.location_id,
                }
            )

        return {"poll": poll, "results": results}
