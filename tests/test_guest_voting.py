"""Tests for guest poll voting (Gap 3)."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from jose import jwt

from app.dependencies.actor import ActorContext
from app.main import app
from app.models.group import Group, GroupMember, MemberRole
from app.models.poll import Poll, PollOption, PollStatus, PollType, Vote
from app.models.trip import Trip, TripStatus
from app.services.invite_service import InviteService
from app.services.poll_service import PollService
from app.utils.guest_token import GUEST_TOKEN_SCOPE, GUEST_TOKEN_TYPE, create_guest_token
from config import settings
from tests.conftest import exec_result


def _member(gid: uuid.UUID, uid: uuid.UUID) -> GroupMember:
    return GroupMember(group_id=gid, user_id=uid, role=MemberRole.member)


def _trip_poll(*, trip_id: uuid.UUID | None = None):
    gid = uuid.uuid4()
    trip = Trip(
        id=trip_id or uuid.uuid4(),
        group_id=gid,
        title="Beach trip",
        status=TripStatus.planning,
        created_by=uuid.uuid4(),
    )
    poll = Poll(
        trip_id=trip.id,
        question="Where?",
        poll_type=PollType.destination,
        status=PollStatus.open,
        created_by=uuid.uuid4(),
    )
    opt_a_id = uuid.uuid4()
    opt_b_id = uuid.uuid4()
    opt_a = PollOption(poll_id=poll.id, label="A", location_id=None)
    opt_b = PollOption(poll_id=poll.id, label="B", location_id=None)
    object.__setattr__(opt_a, "id", opt_a_id)
    object.__setattr__(opt_b, "id", opt_b_id)
    poll.options = [opt_a, opt_b]
    return trip, poll, opt_a, opt_b


def test_guest_can_vote_with_valid_token(db):
    trip, poll, opt_a, _ = _trip_poll()
    guest_id = str(uuid.uuid4())
    actor = ActorContext(
        user_id=None,
        guest_identifier=guest_id,
        trip_id=trip.id,
    )
    loaded = poll
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=poll),
        exec_result(scalar_one=trip),
        exec_result(scalar_one_or_none=None),
        exec_result(scalar_one_or_none=opt_a),
        exec_result(scalar_one_or_none=loaded),
        exec_result(scalar_one=1),
        exec_result(scalar_one=0),
    ]
    out = PollService.cast_vote(db, poll.id, opt_a.id, actor)
    assert out.id == poll.id
    added = db.add.call_args[0][0]
    assert isinstance(added, Vote)
    assert added.guest_identifier == guest_id
    assert added.user_id is None


def test_guest_cannot_vote_without_token():
    client = TestClient(app, raise_server_exceptions=False)
    resp = client.post(
        f"/api/v1/polls/{uuid.uuid4()}/vote",
        json={"option_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 401


def test_guest_token_expired():
    trip_id = uuid.uuid4()
    guest_id = str(uuid.uuid4())
    expire = datetime.now(timezone.utc) - timedelta(days=1)
    token = jwt.encode(
        {
            "trip_id": str(trip_id),
            "guest_identifier": guest_id,
            "scope": GUEST_TOKEN_SCOPE,
            "type": GUEST_TOKEN_TYPE,
            "exp": int(expire.timestamp()),
        },
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    client = TestClient(app, raise_server_exceptions=False)
    resp = client.post(
        f"/api/v1/polls/{uuid.uuid4()}/vote",
        json={"option_id": str(uuid.uuid4())},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 401


def test_guest_vote_counted_in_resolve(db, mock_user):
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
        exec_result(rows_all=[(opt_a_id, 2), (opt_b_id, 1)]),
        exec_result(scalar_one_or_none=poll),
        exec_result(scalar_one=2),
        exec_result(scalar_one=1),
    ]

    out = PollService.resolve_poll(db, poll.id, mock_user)
    assert out.status == PollStatus.resolved
    assert poll.resolved_option_id == opt_a_id


def test_authenticated_user_still_votes_normally(db, mock_user):
    mock_user.id = uuid.uuid4()
    trip, poll, opt_a, _ = _trip_poll()
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
    out = PollService.cast_vote(
        db, poll.id, opt_a.id, ActorContext(user_id=mock_user.id)
    )
    added = db.add.call_args[0][0]
    assert added.user_id == mock_user.id
    assert added.guest_identifier is None
    assert out.id == poll.id


def test_invite_endpoint_returns_context_and_token(db):
    gid = uuid.uuid4()
    trip_id = uuid.uuid4()
    group = Group(
        id=gid,
        name="Adventure Crew",
        invite_code="ABC12345",
        created_by=uuid.uuid4(),
    )
    trip = Trip(
        id=trip_id,
        group_id=gid,
        title="Summer",
        status=TripStatus.planning,
        created_by=uuid.uuid4(),
    )
    poll = Poll(
        trip_id=trip.id,
        question="Dates?",
        poll_type=PollType.date,
        status=PollStatus.open,
        created_by=uuid.uuid4(),
    )
    poll.options = [
        PollOption(
            poll_id=poll.id,
            label="2026-08-01 to 2026-08-10",
            location_id=None,
            start_date=None,
            end_date=None,
        )
    ]

    db.execute.side_effect = [
        exec_result(scalar_one_or_none=group),
        exec_result(scalar_one_or_none=trip),
        exec_result(scalars_all=[poll]),
    ]

    data = InviteService.get_invite_context(db, "ABC12345")
    assert data["group"] is group
    assert data["trip"] is trip
    assert data["polls"] == [poll]
    assert data["guest_token"]
    assert data["guest_identifier"]

    token = create_guest_token(trip_id, data["guest_identifier"])
    assert token.count(".") == 2


def test_invite_route_returns_context_and_token(db):
    gid = uuid.uuid4()
    trip_id = uuid.uuid4()
    group = Group(
        id=gid,
        name="Adventure Crew",
        invite_code="XYZ98765",
        created_by=uuid.uuid4(),
    )
    trip = Trip(
        id=trip_id,
        group_id=gid,
        title="Summer",
        status=TripStatus.planning,
        created_by=uuid.uuid4(),
        description=None,
        start_date=None,
        end_date=None,
    )
    object.__setattr__(trip, "created_at", datetime.now(timezone.utc))
    object.__setattr__(trip, "updated_at", datetime.now(timezone.utc))
    poll = Poll(
        trip_id=trip.id,
        question="Dates?",
        poll_type=PollType.date,
        status=PollStatus.open,
        created_by=uuid.uuid4(),
        closes_at=None,
    )
    object.__setattr__(poll, "id", uuid.uuid4())
    object.__setattr__(poll, "created_at", datetime.now(timezone.utc))
    poll.options = []

    from app.utils.database import get_db

    def _override_db():
        yield db

    app.dependency_overrides[get_db] = _override_db
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=group),
        exec_result(scalar_one_or_none=trip),
        exec_result(scalars_all=[poll]),
    ]

    try:
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/v1/invite/XYZ98765")
        assert resp.status_code == 200
        body = resp.json()
        assert body["group_name"] == "Adventure Crew"
        assert body["guest_token"]
        assert body["guest_identifier"]
        assert body["trip"]["id"] == str(trip_id)
    finally:
        app.dependency_overrides.clear()


def test_guest_can_vote_via_route_with_valid_token(db):
    trip_id = uuid.uuid4()
    poll_id = uuid.uuid4()
    opt_id = uuid.uuid4()
    guest_id = str(uuid.uuid4())
    token = create_guest_token(trip_id, guest_id)

    trip, poll, opt_a, _ = _trip_poll(trip_id=trip_id)
    object.__setattr__(poll, "id", poll_id)
    object.__setattr__(poll, "created_at", datetime.now(timezone.utc))
    object.__setattr__(opt_a, "id", opt_id)
    object.__setattr__(opt_a, "poll_id", poll_id)
    poll.options = [opt_a]
    loaded = poll
    object.__setattr__(loaded, "id", poll_id)

    from app.utils.database import get_db

    def _override_db():
        yield db

    app.dependency_overrides[get_db] = _override_db
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=poll),
        exec_result(scalar_one=trip),
        exec_result(scalar_one_or_none=None),
        exec_result(scalar_one_or_none=opt_a),
        exec_result(scalar_one_or_none=loaded),
        exec_result(scalar_one=1),
        exec_result(scalar_one=0),
    ]
    try:
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post(
            f"/api/v1/polls/{poll_id}/vote",
            json={"option_id": str(opt_id)},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
    finally:
        app.dependency_overrides.clear()
