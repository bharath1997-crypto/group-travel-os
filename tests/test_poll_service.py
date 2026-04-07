"""Unit tests for app.services.poll_service.PollService — mocked Session only."""
from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.models.group import GroupMember, MemberRole
from app.models.poll import Poll, PollOption, PollStatus, PollType
from app.models.trip import Trip, TripStatus
from app.services.poll_service import PollService
from tests.conftest import exec_result


def _member(gid: uuid.UUID, uid: uuid.UUID) -> GroupMember:
    return GroupMember(group_id=gid, user_id=uid, role=MemberRole.member)


def _trip_and_poll(mock_user, *, status: PollStatus = PollStatus.open):
    gid = uuid.uuid4()
    trip = Trip(
        group_id=gid,
        title="T",
        description=None,
        status=TripStatus.planning,
        start_date=None,
        end_date=None,
        created_by=mock_user.id,
    )
    poll = Poll(
        trip_id=trip.id,
        question="Where?",
        poll_type=PollType.destination,
        status=status,
        created_by=mock_user.id,
        closes_at=None,
    )
    opt_a = PollOption(poll_id=poll.id, label="A", location_id=None)
    opt_b = PollOption(poll_id=poll.id, label="B", location_id=None)
    poll.options = [opt_a, opt_b]
    return trip, poll, opt_a, opt_b


def test_create_poll_success(db, mock_user):
    mock_user.id = uuid.uuid4()
    trip, _, _, _ = _trip_and_poll(mock_user)
    n = {"i": 0}

    def se(_stmt=None):
        n["i"] += 1
        if n["i"] == 1:
            return exec_result(scalar_one_or_none=trip)
        if n["i"] == 2:
            return exec_result(scalar_one_or_none=_member(trip.group_id, mock_user.id))
        if n["i"] == 3:
            poll_obj = db.add.call_args_list[0][0][0]
            o1 = PollOption(poll_id=poll_obj.id, label="One", location_id=None)
            o2 = PollOption(poll_id=poll_obj.id, label="Two", location_id=None)
            poll_obj.options = [o1, o2]
            return exec_result(scalar_one_or_none=poll_obj)
        return exec_result(scalar_one=0)

    db.execute.side_effect = se
    options = [{"label": "One"}, {"label": "Two"}]
    out = PollService.create_poll(
        db,
        trip.id,
        "Q?",
        PollType.custom,
        options,
        None,
        mock_user,
    )
    assert out.question == "Q?"
    assert len(out.options) == 2


def test_create_poll_not_found(db, mock_user):
    mock_user.id = uuid.uuid4()
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    with pytest.raises(HTTPException) as ei:
        PollService.create_poll(
            db,
            uuid.uuid4(),
            "Q?",
            PollType.custom,
            [{"label": "a"}, {"label": "b"}],
            None,
            mock_user,
        )
    assert ei.value.status_code == 404


def test_create_poll_bad_request_fewer_than_two_options(db, mock_user):
    mock_user.id = uuid.uuid4()
    trip, _, _, _ = _trip_and_poll(mock_user)
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),
        exec_result(scalar_one_or_none=_member(trip.group_id, mock_user.id)),
    ]
    with pytest.raises(HTTPException) as ei:
        PollService.create_poll(
            db,
            trip.id,
            "Q?",
            PollType.custom,
            [{"label": "only"}],
            None,
            mock_user,
        )
    assert ei.value.status_code == 400


def test_get_poll_success(db, mock_user):
    mock_user.id = uuid.uuid4()
    trip, poll, _, _ = _trip_and_poll(mock_user)
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=poll),
        exec_result(scalar_one=trip),
        exec_result(scalar_one_or_none=_member(trip.group_id, mock_user.id)),
        exec_result(scalar_one=0),
        exec_result(scalar_one=0),
    ]
    out = PollService.get_poll(db, poll.id, mock_user)
    assert out.id == poll.id
    assert hasattr(out.options[0], "vote_count")


def test_get_poll_not_found(db, mock_user):
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    with pytest.raises(HTTPException) as ei:
        PollService.get_poll(db, uuid.uuid4(), mock_user)
    assert ei.value.status_code == 404


def test_list_trip_polls_success(db, mock_user):
    mock_user.id = uuid.uuid4()
    trip, poll, _, _ = _trip_and_poll(mock_user)
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),
        exec_result(scalar_one_or_none=_member(trip.group_id, mock_user.id)),
        exec_result(scalars_all=[poll]),
    ]
    rows = PollService.list_trip_polls(db, trip.id, mock_user)
    assert rows == [poll]


def test_list_trip_polls_trip_not_found(db, mock_user):
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    with pytest.raises(HTTPException) as ei:
        PollService.list_trip_polls(db, uuid.uuid4(), mock_user)
    assert ei.value.status_code == 404


def test_cast_vote_success(db, mock_user):
    mock_user.id = uuid.uuid4()
    trip, poll, opt_a, opt_b = _trip_and_poll(mock_user)
    loaded = poll
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=poll),
        exec_result(scalar_one=trip),
        exec_result(scalar_one_or_none=_member(trip.group_id, mock_user.id)),
        exec_result(scalar_one_or_none=None),
        exec_result(scalar_one_or_none=opt_a),
        exec_result(scalar_one_or_none=loaded),
        exec_result(scalar_one=1),
        exec_result(scalar_one=0),
    ]
    out = PollService.cast_vote(db, poll.id, opt_a.id, mock_user)
    assert hasattr(out.options[0], "vote_count")
    db.add.assert_called()
    db.commit.assert_called_once()


def test_cast_vote_conflict_when_already_voted(db, mock_user):
    mock_user.id = uuid.uuid4()
    trip, poll, opt_a, _ = _trip_and_poll(mock_user)
    prior = MagicMock()
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=poll),
        exec_result(scalar_one=trip),
        exec_result(scalar_one_or_none=_member(trip.group_id, mock_user.id)),
        exec_result(scalar_one_or_none=prior),
    ]
    with pytest.raises(HTTPException) as ei:
        PollService.cast_vote(db, poll.id, opt_a.id, mock_user)
    assert ei.value.status_code == 409


def test_cast_vote_bad_request_when_option_not_on_poll(db, mock_user):
    mock_user.id = uuid.uuid4()
    trip, poll, opt_a, _ = _trip_and_poll(mock_user)
    wrong_opt_id = uuid.uuid4()
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=poll),
        exec_result(scalar_one=trip),
        exec_result(scalar_one_or_none=_member(trip.group_id, mock_user.id)),
        exec_result(scalar_one_or_none=None),
        exec_result(scalar_one_or_none=None),
    ]
    with pytest.raises(HTTPException) as ei:
        PollService.cast_vote(db, poll.id, wrong_opt_id, mock_user)
    assert ei.value.status_code == 400


def test_cast_vote_closed_poll(db, mock_user):
    mock_user.id = uuid.uuid4()
    trip, poll, opt_a, _ = _trip_and_poll(mock_user, status=PollStatus.closed)
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=poll),
        exec_result(scalar_one=trip),
        exec_result(scalar_one_or_none=_member(trip.group_id, mock_user.id)),
    ]
    with pytest.raises(HTTPException) as ei:
        PollService.cast_vote(db, poll.id, opt_a.id, mock_user)
    assert ei.value.status_code == 400


def test_close_poll_success(db, mock_user):
    mock_user.id = uuid.uuid4()
    trip, poll, _, _ = _trip_and_poll(mock_user)
    poll.created_by = mock_user.id
    loaded = poll
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=poll),
        exec_result(scalar_one=trip),
        exec_result(scalar_one_or_none=loaded),
        exec_result(scalar_one=0),
        exec_result(scalar_one=0),
    ]
    out = PollService.close_poll(db, poll.id, mock_user)
    assert out.status == PollStatus.closed


def test_close_poll_forbidden(db, mock_user):
    mock_user.id = uuid.uuid4()
    trip, poll, _, _ = _trip_and_poll(mock_user)
    poll.created_by = uuid.uuid4()
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=poll),
        exec_result(scalar_one=trip),
        exec_result(scalar_one_or_none=None),
    ]
    with pytest.raises(HTTPException) as ei:
        PollService.close_poll(db, poll.id, mock_user)
    assert ei.value.status_code == 403


def test_get_poll_results_success(db, mock_user):
    mock_user.id = uuid.uuid4()
    trip, poll, _, _ = _trip_and_poll(mock_user)
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=poll),
        exec_result(scalar_one=trip),
        exec_result(scalar_one_or_none=_member(trip.group_id, mock_user.id)),
        exec_result(scalar_one=1),
        exec_result(scalar_one=2),
    ]
    data = PollService.get_poll_results(db, poll.id, mock_user)
    assert data["poll"] is poll
    assert len(data["results"]) == 2
    assert data["results"][0]["vote_count"] == 1


def test_get_poll_results_poll_not_found(db, mock_user):
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    with pytest.raises(HTTPException) as ei:
        PollService.get_poll_results(db, uuid.uuid4(), mock_user)
    assert ei.value.status_code == 404
