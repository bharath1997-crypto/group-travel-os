from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.dependencies.actor import ActorContext
from app.models.group import GroupMember
from app.models.live_session import LiveMode, LiveSession
from app.models.poll import Poll, PollStatus, PollType, Vote
from app.models.user import User
from app.schemas.live_group import (
    LiveCreateVotePollRequest,
    LiveFirebaseTokenResponse,
    LiveStartGroupConvergeRequest,
    LiveStartGroupConvergeResponse,
    LiveVotePanelOut,
    LiveVotePanelOptionOut,
)
from app.services.poll_service import PollService, _attach_vote_counts_to_options
from app.services.trip_service import TripService
from app.utils.exceptions import AppException
from app.utils.firebase import create_custom_token

_LIVE_VOTE_POLL_TYPES = (PollType.destination, PollType.activity, PollType.custom)


class LiveGroupService:
    @staticmethod
    def get_firebase_token(user: User) -> LiveFirebaseTokenResponse:
        try:
            token = create_custom_token(str(user.id))
        except RuntimeError:
            AppException.bad_gateway("Firebase is not configured on the server.")
        return LiveFirebaseTokenResponse(token=token)

    @staticmethod
    def start_group_converge(
        db: Session,
        user: User,
        data: LiveStartGroupConvergeRequest,
    ) -> LiveStartGroupConvergeResponse:
        TripService.get_trip(db, data.tripId, user)

        active = db.execute(
            select(LiveSession).where(
                LiveSession.started_by == user.id,
                LiveSession.is_active.is_(True),
            )
        ).scalar_one_or_none()
        if active:
            active.is_active = False
            active.ended_at = datetime.now(timezone.utc)

        session = LiveSession(
            started_by=user.id,
            mode=LiveMode.group,
            is_active=True,
            trip_id=data.tripId,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        return LiveStartGroupConvergeResponse(
            status="ready",
            sessionId=session.id,
            message=None,
        )

    @staticmethod
    def _trip_member_count(db: Session, group_id: uuid.UUID) -> int:
        count = db.execute(
            select(func.count())
            .select_from(GroupMember)
            .where(GroupMember.group_id == group_id)
        ).scalar_one()
        return max(int(count), 1)

    @staticmethod
    def _format_closes_at_label(closes_at: datetime | None) -> str | None:
        if closes_at is None:
            return None
        deadline = closes_at
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        local = deadline.astimezone(timezone.utc)
        hour = local.hour % 12 or 12
        return f"Closes {hour}:{local.minute:02d}"

    @staticmethod
    def _user_vote_option_id(
        db: Session,
        poll_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> uuid.UUID | None:
        vote = db.execute(
            select(Vote.option_id).where(
                Vote.poll_id == poll_id,
                Vote.user_id == user_id,
            )
        ).scalar_one_or_none()
        return vote

    @staticmethod
    def _active_live_poll(polls: list[Poll]) -> Poll | None:
        for poll in polls:
            if poll.status != PollStatus.open:
                continue
            if poll.poll_type in _LIVE_VOTE_POLL_TYPES:
                return poll
        return None

    @staticmethod
    def _poll_to_vote_panel(
        db: Session,
        poll: Poll | None,
        member_count: int,
        user_id: uuid.UUID | None,
    ) -> LiveVotePanelOut:
        if poll is None:
            return LiveVotePanelOut(
                pollId=None,
                question="Where are we eating?",
                closesAtLabel=None,
                memberCount=member_count,
                options=[],
                myOptionId=None,
                status="empty",
            )

        _attach_vote_counts_to_options(db, poll)
        my_option_id = (
            LiveGroupService._user_vote_option_id(db, poll.id, user_id)
            if user_id is not None
            else None
        )
        closes_label = LiveGroupService._format_closes_at_label(poll.closes_at)
        if closes_label is None and poll.status == PollStatus.open:
            closes_label = "Vote open"

        return LiveVotePanelOut(
            pollId=poll.id,
            question=poll.question,
            closesAtLabel=closes_label,
            memberCount=member_count,
            options=[
                LiveVotePanelOptionOut(
                    id=option.id,
                    name=option.label,
                    meta="Trip option",
                    voteCount=int(getattr(option, "vote_count", 0)),
                )
                for option in poll.options
            ],
            myOptionId=my_option_id,
            status=poll.status.value,
        )

    @staticmethod
    def get_vote_panel(
        db: Session,
        trip_id: uuid.UUID,
        user: User,
    ) -> LiveVotePanelOut:
        trip = TripService.get_trip(db, trip_id, user)
        member_count = LiveGroupService._trip_member_count(db, trip.group_id)
        polls = PollService.list_trip_polls(db, trip_id, user)
        active = LiveGroupService._active_live_poll(polls)
        return LiveGroupService._poll_to_vote_panel(db, active, member_count, user.id)

    @staticmethod
    def create_vote_poll(
        db: Session,
        trip_id: uuid.UUID,
        user: User,
        data: LiveCreateVotePollRequest,
    ) -> LiveVotePanelOut:
        trip = TripService.get_trip(db, trip_id, user)
        member_count = LiveGroupService._trip_member_count(db, trip.group_id)

        existing = LiveGroupService._active_live_poll(
            PollService.list_trip_polls(db, trip_id, user)
        )
        if existing is not None:
            return LiveGroupService._poll_to_vote_panel(db, existing, member_count, user.id)

        closes_at = data.closesAt
        if closes_at is None:
            closes_at = datetime.now(timezone.utc) + timedelta(hours=2)

        option_payloads = [
            {
                "label": option.label,
                "location_id": option.locationId,
            }
            for option in data.options
        ]
        poll = PollService.create_poll(
            db,
            trip_id,
            data.question,
            PollType.destination,
            option_payloads,
            closes_at,
            user,
        )
        panel = LiveGroupService._poll_to_vote_panel(db, poll, member_count, user.id)
        return LiveVotePanelOut(
            pollId=panel.pollId,
            question=panel.question,
            closesAtLabel=panel.closesAtLabel,
            memberCount=panel.memberCount,
            myOptionId=panel.myOptionId,
            status=panel.status,
            options=[
                LiveVotePanelOptionOut(
                    id=option.id,
                    name=option.name,
                    meta=(
                        data.options[idx].meta
                        if idx < len(data.options) and data.options[idx].meta
                        else option.meta
                    ),
                    voteCount=option.voteCount,
                )
                for idx, option in enumerate(panel.options)
            ],
        )

    @staticmethod
    def cast_vote(
        db: Session,
        poll_id: uuid.UUID,
        option_id: uuid.UUID,
        user: User,
    ) -> LiveVotePanelOut:
        poll = PollService.cast_vote(
            db,
            poll_id,
            option_id,
            ActorContext(user_id=user.id, is_guest=False),
        )
        trip = TripService.get_trip(db, poll.trip_id, user)
        member_count = LiveGroupService._trip_member_count(db, trip.group_id)
        return LiveGroupService._poll_to_vote_panel(db, poll, member_count, user.id)
