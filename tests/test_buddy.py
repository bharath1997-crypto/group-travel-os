from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.buddy import BuddyJoinRead, BuddyTripRead
from app.utils.auth import get_current_user
from tests.conftest import exec_result

from types import SimpleNamespace

client = TestClient(app)


def _mock_user() -> MagicMock:
    user = MagicMock()
    user.id = uuid.UUID("00000000-0000-0000-0000-000000000033")
    user.email = "buddy@example.com"
    user.full_name = "Buddy Tester"
    user.avatar_url = None
    user.is_active = True
    return user


@pytest.fixture(autouse=True)
def _reset_auth():
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def auth():
    app.dependency_overrides[get_current_user] = _mock_user
    yield {}
    app.dependency_overrides.pop(get_current_user, None)


def _trip_read() -> BuddyTripRead:
    tid = uuid.UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    oid = uuid.UUID("00000000-0000-0000-0000-000000000033")
    now = datetime.now(timezone.utc)
    return BuddyTripRead(
        id=tid,
        organizer_id=oid,
        organizer=None,
        destination="Tokyo",
        date_from=date(2026, 9, 1),
        date_to=date(2026, 9, 12),
        max_size=10,
        current_size=1,
        vibe_tags=["Adventure"],
        description="Shinjuku nights",
        status="open",
        created_at=now,
        updated_at=now,
    )


def test_create_buddy_trip_201(auth, monkeypatch):
    out = _trip_read()

    def fake_create(db, user, data):
        assert user.id == uuid.UUID("00000000-0000-0000-0000-000000000033")
        assert data.destination == "Tokyo"
        return out

    monkeypatch.setattr(
        "app.services.buddy_service.BuddyService.create_buddy_trip",
        fake_create,
    )
    r = client.post(
        "/api/v1/buddy/trips",
        json={
            "destination": "Tokyo",
            "date_from": "2026-09-01",
            "date_to": "2026-09-12",
            "max_size": 10,
            "vibe_tags": ["Adventure"],
            "description": "Shinjuku nights",
        },
    )
    assert r.status_code == 201
    assert r.json()["destination"] == "Tokyo"


def test_list_buddy_trips_200(auth, monkeypatch):
    monkeypatch.setattr(
        "app.services.buddy_service.BuddyService.list_buddy_trips",
        lambda db, user, **kw: [_trip_read()],
    )
    r = client.get("/api/v1/buddy/trips")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_request_to_join_201(auth, monkeypatch):
    jid = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
    tid = uuid.UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")

    def fake_join(db, user, trip_id, body):
        assert trip_id == tid
        return BuddyJoinRead(
            id=jid,
            buddy_trip_id=tid,
            requester_id=user.id,
            status="pending",
            message="Hi!",
            created_at=datetime.now(timezone.utc),
        )

    monkeypatch.setattr(
        "app.services.buddy_service.BuddyService.request_to_join",
        fake_join,
    )
    r = client.post(
        f"/api/v1/buddy/trips/{tid}/join",
        json={"message": "Hi!"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "pending"


def test_approve_request_200(auth, monkeypatch):
    jid = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
    tid = uuid.UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")

    def fake_resp(db, organizer, trip_id, request_id, body):
        assert body.approve is True
        return BuddyJoinRead(
            id=request_id,
            buddy_trip_id=trip_id,
            requester_id=uuid.UUID("cccccccc-cccc-cccc-cccc-cccccccccccc"),
            status="approved",
            message=None,
            created_at=datetime.now(timezone.utc),
        )

    monkeypatch.setattr(
        "app.services.buddy_service.BuddyService.respond_to_request",
        fake_resp,
    )
    r = client.patch(
        f"/api/v1/buddy/trips/{tid}/requests/{jid}",
        json={"approve": True},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "approved"


def test_decline_request_200(auth, monkeypatch):
    jid = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
    tid = uuid.UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")

    def fake_resp(db, organizer, trip_id, request_id, body):
        assert body.approve is False
        return BuddyJoinRead(
            id=request_id,
            buddy_trip_id=trip_id,
            requester_id=uuid.UUID("cccccccc-cccc-cccc-cccc-cccccccccccc"),
            status="declined",
            message=None,
            created_at=datetime.now(timezone.utc),
        )

    monkeypatch.setattr(
        "app.services.buddy_service.BuddyService.respond_to_request",
        fake_resp,
    )
    r = client.patch(
        f"/api/v1/buddy/trips/{tid}/requests/{jid}",
        json={"approve": False},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "declined"


def test_trip_auto_closes_when_full(auth):
    trip_id = uuid.UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")
    req_id = uuid.UUID("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")
    org_id = uuid.UUID("00000000-0000-0000-0000-000000000033")

    trip = SimpleNamespace(
        id=trip_id,
        organizer_id=org_id,
        current_size=2,
        max_size=3,
        status="open",
        updated_at=datetime.now(timezone.utc),
    )

    req = SimpleNamespace(
        id=req_id,
        buddy_trip_id=trip_id,
        status="pending",
        requester_id=uuid.UUID("ffffffff-ffff-ffff-ffff-ffffffffffff"),
        message=None,
        created_at=datetime.now(timezone.utc),
    )

    organizer = MagicMock()
    organizer.id = org_id

    db = MagicMock()
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),
        exec_result(scalar_one_or_none=req),
    ]

    from app.schemas.buddy import BuddyRespondWrite
    from app.services.buddy_service import BuddyService

    out = BuddyService.respond_to_request(
        db,
        organizer,
        trip_id,
        req_id,
        BuddyRespondWrite(approve=True),
    )
    assert trip.status == "full"
    assert trip.current_size == 3
    assert out.status == "approved"


def test_buddy_requires_auth_401():
    r = client.post(
        "/api/v1/buddy/trips",
        json={
            "destination": "Paris",
            "date_from": "2026-10-01",
            "date_to": "2026-10-07",
            "max_size": 6,
            "vibe_tags": [],
        },
    )
    assert r.status_code == 401
