"""
Helpers for applying resolved poll winners to trip fields.
"""
from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.location import TripLocation
from app.models.poll import Poll, PollOption, PollStatus, PollType, Vote
from app.models.trip import Trip


def decision_poll_types() -> frozenset[PollType]:
    return frozenset({PollType.destination, PollType.date})


def pick_winning_option(db: Session, poll: Poll) -> PollOption:
    if not poll.options:
        raise ValueError("Poll has no options")

    best: PollOption | None = None
    best_votes = -1
    for opt in poll.options:
        vote_count = db.execute(
            select(func.count()).select_from(Vote).where(Vote.option_id == opt.id)
        ).scalar_one()
        vote_count = int(vote_count)
        if vote_count > best_votes:
            best = opt
            best_votes = vote_count
        elif vote_count == best_votes and best is not None:
            if str(opt.id) < str(best.id):
                best = opt

    assert best is not None
    return best


def apply_resolved_poll_to_trip(
    db: Session,
    trip: Trip,
    poll: Poll,
    winning_option: PollOption,
    *,
    applied_by: uuid.UUID,
) -> None:
    if poll.poll_type == PollType.destination:
        if winning_option.location_id is None:
            return
        existing = db.execute(
            select(TripLocation).where(
                TripLocation.trip_id == trip.id,
                TripLocation.location_id == winning_option.location_id,
            )
        ).scalar_one_or_none()
        if existing:
            existing.status = "confirmed"
            return
        db.add(
            TripLocation(
                trip_id=trip.id,
                location_id=winning_option.location_id,
                status="confirmed",
                added_by=applied_by,
            )
        )
        return

    if poll.poll_type == PollType.date:
        if winning_option.start_date is not None:
            trip.start_date = winning_option.start_date
        if winning_option.end_date is not None:
            trip.end_date = winning_option.end_date


def apply_all_resolved_polls_to_trip(
    db: Session,
    trip: Trip,
    polls: list[Poll],
    *,
    applied_by: uuid.UUID,
) -> None:
    for poll in polls:
        if poll.status != PollStatus.resolved or poll.resolved_option_id is None:
            continue
        winning = next((o for o in poll.options if o.id == poll.resolved_option_id), None)
        if winning is None:
            winning = db.execute(
                select(PollOption).where(PollOption.id == poll.resolved_option_id)
            ).scalar_one_or_none()
        if winning is None:
            continue
        apply_resolved_poll_to_trip(db, trip, poll, winning, applied_by=applied_by)
