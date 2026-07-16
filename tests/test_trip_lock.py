"""Tests for trip lock + poll resolve (Gap 1)."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.dependencies.authz import require_trip_admin
from app.models.group import GroupMember, MemberRole
from app.models.poll import Poll, PollOption, PollStatus, PollType
from app.models.trip import Trip, TripStatus
from app.services.poll_service import PollService
from app.services.trip_decision_service import apply_resolved_poll_to_trip, pick_winning_option
from app.services.trip_service import TripService
from tests.conftest import exec_result


def _member(gid: uuid.UUID, uid: uuid.UUID, *, admin: bool = True) -> GroupMember:
    return GroupMember(
        group_id=gid,
        user_id=uid,
        role=MemberRole.admin if admin else MemberRole.member,
    )


def test_lock_applies_structured_dates(db):
    trip = Trip(
        group_id=uuid.uuid4(),
        title="T",
        status=TripStatus.planning,
        created_by=uuid.uuid4(),
    )
    poll = Poll(
        trip_id=trip.id,
        question="When?",
        poll_type=PollType.date,
        status=PollStatus.resolved,
        created_by=uuid.uuid4(),
    )
    winner = PollOption(
        poll_id=poll.id,
        label="2026-09-01 to 2026-09-05",
        location_id=None,
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 5),
    )
    apply_resolved_poll_to_trip(db, trip, poll, winner, applied_by=uuid.uuid4())
    assert trip.start_date == date(2026, 9, 1)
    assert trip.end_date == date(2026, 9, 5)


def test_pick_winning_option_uses_highest_votes(db):
    poll = Poll(
        trip_id=uuid.uuid4(),
        question="Where?",
        poll_type=PollType.destination,
        status=PollStatus.closed,
        created_by=uuid.uuid4(),
    )
    opt_a = PollOption(poll_id=poll.id, label="A", location_id=None)
    opt_b = PollOption(poll_id=poll.id, label="B", location_id=None)
    poll.options = [opt_a, opt_b]

    def se(_stmt=None):
        return exec_result(scalar_one=3 if db.execute.call_count <= 1 else 1)

    db.execute.side_effect = se
    winner = pick_winning_option(db, poll)
    assert winner.label == "A"


@pytest.mark.asyncio
async def test_resolve_forbidden_non_admin(db, mock_user):
    gid = uuid.uuid4()
    creator_id = uuid.uuid4()
    trip_id = uuid.uuid4()
    mock_user.id = uuid.uuid4()
    trip = Trip(
        id=trip_id,
        group_id=gid,
        title="T",
        status=TripStatus.planning,
        created_by=creator_id,
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),
        exec_result(scalar_one_or_none=None),
    ]
    with pytest.raises(HTTPException) as ei:
        await require_trip_admin(trip_id=trip_id, current_user=mock_user, db=db)
    assert ei.value.status_code == 403


@pytest.mark.asyncio
async def test_resolve_allowed_creator(db, mock_user):
    gid = uuid.uuid4()
    trip_id = uuid.uuid4()
    mock_user.id = uuid.uuid4()
    trip = Trip(
        id=trip_id,
        group_id=gid,
        title="T",
        status=TripStatus.planning,
        created_by=mock_user.id,
    )
    db.execute.return_value = exec_result(scalar_one_or_none=trip)
    user = await require_trip_admin(trip_id=trip_id, current_user=mock_user, db=db)
    assert user.id == mock_user.id


@pytest.mark.asyncio
async def test_resolve_allowed_group_admin(db, mock_user):
    gid = uuid.uuid4()
    creator_id = uuid.uuid4()
    trip_id = uuid.uuid4()
    mock_user.id = uuid.uuid4()
    trip = Trip(
        id=trip_id,
        group_id=gid,
        title="T",
        status=TripStatus.planning,
        created_by=creator_id,
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),
        exec_result(scalar_one_or_none=_member(gid, mock_user.id)),
    ]
    user = await require_trip_admin(trip_id=trip_id, current_user=mock_user, db=db)
    assert user.id == mock_user.id


@pytest.mark.asyncio
async def test_lock_forbidden_non_admin(db, mock_user):
    gid = uuid.uuid4()
    creator_id = uuid.uuid4()
    trip_id = uuid.uuid4()
    mock_user.id = uuid.uuid4()
    trip = Trip(
        id=trip_id,
        group_id=gid,
        title="T",
        status=TripStatus.planning,
        created_by=creator_id,
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),
        exec_result(scalar_one_or_none=None),
    ]
    with pytest.raises(HTTPException) as ei:
        await require_trip_admin(trip_id=trip_id, current_user=mock_user, db=db)
    assert ei.value.status_code == 403


def test_resolve_poll_success(db, mock_user):
    mock_user.id = uuid.uuid4()
    poll = Poll(
        trip_id=uuid.uuid4(),
        question="Where?",
        poll_type=PollType.destination,
        status=PollStatus.closed,
        created_by=mock_user.id,
    )
    opt_a_id = uuid.uuid4()
    opt_b_id = uuid.uuid4()
    opt_a = PollOption(poll_id=poll.id, label="A", location_id=None)
    opt_b = PollOption(poll_id=poll.id, label="B", location_id=None)
    object.__setattr__(opt_a, "id", opt_a_id)
    object.__setattr__(opt_b, "id", opt_b_id)
    poll.options = [opt_a, opt_b]

    db.execute.side_effect = [
        exec_result(scalar_one_or_none=poll),
        exec_result(rows_all=[(opt_a_id, 2), (opt_b_id, 0)]),
        exec_result(scalar_one_or_none=poll),
        exec_result(scalar_one=1),
        exec_result(scalar_one=0),
    ]

    out = PollService.resolve_poll(db, poll.id, mock_user)
    assert out.status == PollStatus.resolved
    assert poll.resolved_option_id == opt_a_id


def test_resolve_tie_without_override(db, mock_user):
    mock_user.id = uuid.uuid4()
    poll = Poll(
        trip_id=uuid.uuid4(),
        question="Where?",
        poll_type=PollType.destination,
        status=PollStatus.closed,
        created_by=mock_user.id,
    )
    opt_a_id = uuid.uuid4()
    opt_b_id = uuid.uuid4()
    opt_a = PollOption(poll_id=poll.id, label="A", location_id=None)
    opt_b = PollOption(poll_id=poll.id, label="B", location_id=None)
    object.__setattr__(opt_a, "id", opt_a_id)
    object.__setattr__(opt_b, "id", opt_b_id)
    poll.options = [opt_a, opt_b]

    db.execute.side_effect = [
        exec_result(scalar_one_or_none=poll),
        exec_result(rows_all=[(opt_a_id, 2), (opt_b_id, 2)]),
    ]

    with pytest.raises(HTTPException) as ei:
        PollService.resolve_poll(db, poll.id, mock_user)
    assert ei.value.status_code == 409


def test_resolve_tie_with_override(db, mock_user):
    mock_user.id = uuid.uuid4()
    poll = Poll(
        trip_id=uuid.uuid4(),
        question="Where?",
        poll_type=PollType.destination,
        status=PollStatus.closed,
        created_by=mock_user.id,
    )
    opt_a_id = uuid.uuid4()
    opt_b_id = uuid.uuid4()
    opt_a = PollOption(poll_id=poll.id, label="A", location_id=None)
    opt_b = PollOption(poll_id=poll.id, label="B", location_id=None)
    object.__setattr__(opt_a, "id", opt_a_id)
    object.__setattr__(opt_b, "id", opt_b_id)
    poll.options = [opt_a, opt_b]

    db.execute.side_effect = [
        exec_result(scalar_one_or_none=poll),
        exec_result(scalar_one_or_none=opt_b),
        exec_result(scalar_one_or_none=poll),
        exec_result(scalar_one=0),
        exec_result(scalar_one=0),
    ]

    out = PollService.resolve_poll(db, poll.id, mock_user, option_id=opt_b_id)
    assert out.status == PollStatus.resolved
    assert poll.resolved_option_id == opt_b_id


def test_lock_trip_requires_resolved_decision_polls(db, mock_user):
    mock_user.id = uuid.uuid4()
    gid = uuid.uuid4()
    trip = Trip(
        group_id=gid,
        title="T",
        status=TripStatus.planning,
        created_by=mock_user.id,
    )
    open_poll = Poll(
        trip_id=trip.id,
        question="When?",
        poll_type=PollType.date,
        status=PollStatus.open,
        created_by=mock_user.id,
    )

    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),
        exec_result(scalars_all=[open_poll]),
    ]

    with pytest.raises(HTTPException) as ei:
        TripService.lock_trip(db, trip.id, mock_user)
    assert ei.value.status_code == 400


def test_lock_conflict_already_locked(db, mock_user):
    mock_user.id = uuid.uuid4()
    gid = uuid.uuid4()
    trip = Trip(
        group_id=gid,
        title="T",
        status=TripStatus.locked,
        created_by=mock_user.id,
    )
    resolved_poll = Poll(
        trip_id=trip.id,
        question="When?",
        poll_type=PollType.date,
        status=PollStatus.resolved,
        created_by=mock_user.id,
    )
    winner_id = uuid.uuid4()
    winner = PollOption(
        poll_id=resolved_poll.id,
        label="2026-09-01 to 2026-09-05",
        location_id=None,
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 5),
    )
    object.__setattr__(winner, "id", winner_id)
    resolved_poll.resolved_option_id = winner_id
    resolved_poll.options = [winner]

    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),
        exec_result(scalars_all=[resolved_poll]),
        exec_result(rowcount=0),
    ]

    with pytest.raises(HTTPException) as ei:
        TripService.lock_trip(db, trip.id, mock_user)
    assert ei.value.status_code == 409


def test_lock_trip_success(db, mock_user):
    mock_user.id = uuid.uuid4()
    gid = uuid.uuid4()
    trip = Trip(
        group_id=gid,
        title="T",
        status=TripStatus.planning,
        created_by=mock_user.id,
    )
    resolved_poll = Poll(
        trip_id=trip.id,
        question="When?",
        poll_type=PollType.date,
        status=PollStatus.resolved,
        created_by=mock_user.id,
    )
    winner_id = uuid.uuid4()
    winner = PollOption(
        poll_id=resolved_poll.id,
        label="2026-09-01 to 2026-09-05",
        location_id=None,
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 5),
    )
    object.__setattr__(winner, "id", winner_id)
    resolved_poll.resolved_option_id = winner_id
    resolved_poll.options = [winner]

    locked_trip = trip

    def side_effect(_stmt=None):
        call = side_effect.n
        side_effect.n += 1
        if call == 0:
            return exec_result(scalar_one_or_none=locked_trip)
        if call == 1:
            return exec_result(scalars_all=[resolved_poll])
        if call == 2:
            return exec_result(rowcount=1)
        locked_trip.status = TripStatus.locked
        locked_trip.locked_at = datetime.now(timezone.utc)
        return exec_result(scalar_one=locked_trip)

    side_effect.n = 0
    db.execute.side_effect = side_effect

    out = TripService.lock_trip(db, trip.id, mock_user)
    assert out.status == TripStatus.locked
    assert out.locked_at is not None
    assert out.start_date == date(2026, 9, 1)
    assert out.end_date == date(2026, 9, 5)
