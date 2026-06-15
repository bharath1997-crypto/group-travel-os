from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.lounge import ChatOut, MemberOut, ContactOut
from app.utils.auth import get_current_user
from tests.conftest import exec_result

client = TestClient(app)

# Test User
def _mock_user() -> MagicMock:
    user = MagicMock()
    user.id = uuid.UUID("00000000-0000-0000-0000-000000000099")
    user.email = "lounge@example.com"
    user.full_name = "Lounge Tester"
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


def _chat_out(cid: uuid.UUID, ctype: str = "direct", name: str | None = None) -> ChatOut:
    return ChatOut(
        id=cid,
        type=ctype,
        name=name,
        trip_id=None,
        created_by=uuid.UUID("00000000-0000-0000-0000-000000000099"),
        created_at=datetime.now(timezone.utc).replace(tzinfo=None),
        last_message_preview=None,
        last_message_at=None,
        avatar_url=None,
        members=[
            MemberOut(
                id=uuid.uuid4(),
                user_id=uuid.UUID("00000000-0000-0000-0000-000000000099"),
                full_name="Lounge Tester",
                is_admin=True,
            )
        ],
    )


# --- ROUTE TESTS ---

def test_get_user_chats_200(auth, monkeypatch):
    cid = uuid.uuid4()
    monkeypatch.setattr(
        "app.services.lounge_service.LoungeService.get_user_chats",
        lambda db, user_id: [_chat_out(cid)],
    )

    res = client.get("/api/v1/lounge/chats")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["id"] == str(cid)


def test_create_direct_chat_201(auth, monkeypatch):
    cid = uuid.uuid4()
    target_uid = uuid.uuid4()

    def fake_create(db, creator_id, target_id):
        assert target_id == target_uid
        return _chat_out(cid)

    monkeypatch.setattr(
        "app.services.lounge_service.LoungeService.create_direct_chat",
        fake_create,
    )

    res = client.post(
        "/api/v1/lounge/chats/direct",
        json={"user_id": str(target_uid)},
    )
    assert res.status_code == 201
    assert res.json()["id"] == str(cid)


def test_create_group_chat_201(auth, monkeypatch):
    cid = uuid.uuid4()
    members = [uuid.uuid4(), uuid.uuid4()]

    def fake_create(db, creator_id, name, member_ids):
        assert name == "Test Group"
        assert len(member_ids) == 2
        return _chat_out(cid, "group", name)

    monkeypatch.setattr(
        "app.services.lounge_service.LoungeService.create_group_chat",
        fake_create,
    )

    res = client.post(
        "/api/v1/lounge/chats/group",
        json={
            "name": "Test Group",
            "member_ids": [str(m) for m in members],
        },
    )
    assert res.status_code == 201
    assert res.json()["id"] == str(cid)
    assert res.json()["name"] == "Test Group"


def test_get_chat_members_200(auth, monkeypatch):
    cid = uuid.uuid4()
    m_out = MemberOut(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        full_name="Jane Doe",
        is_admin=False,
    )
    monkeypatch.setattr(
        "app.services.lounge_service.LoungeService.get_chat_members",
        lambda db, chat_id, user_id: [m_out],
    )

    res = client.get(f"/api/v1/lounge/chats/{cid}/members")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["full_name"] == "Jane Doe"


def test_leave_chat_204(auth, monkeypatch):
    cid = uuid.uuid4()
    called = []

    def fake_leave(db, chat_id, user_id):
        called.append(chat_id)

    monkeypatch.setattr(
        "app.services.lounge_service.LoungeService.leave_chat",
        fake_leave,
    )

    res = client.delete(f"/api/v1/lounge/chats/{cid}/leave")
    assert res.status_code == 204
    assert len(called) == 1
    assert called[0] == cid


def test_get_contacts_200(auth, monkeypatch):
    monkeypatch.setattr(
        "app.services.lounge_service.LoungeService.get_contacts",
        lambda db, user_id: [
            ContactOut(
                id=uuid.uuid4(),
                full_name="Alice Smith",
                username="alice",
            )
        ],
    )

    res = client.get("/api/v1/lounge/contacts")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["full_name"] == "Alice Smith"


def test_drive_sync_200(auth, monkeypatch):
    cid = uuid.uuid4()
    called = []

    def fake_sync(db, user_id, chat_id, messages, drive_file_id):
        called.append((chat_id, messages))

    monkeypatch.setattr(
        "app.services.lounge_service.LoungeService.sync_drive",
        fake_sync,
    )

    res = client.post(
        "/api/v1/lounge/drive/sync",
        json={
            "chat_id": str(cid),
            "messages": [{"id": "1", "text": "hello"}],
        },
    )
    assert res.status_code == 200
    assert len(called) == 1
    assert called[0][0] == cid
    assert called[0][1] == [{"id": "1", "text": "hello"}]


def test_drive_restore_200(auth, monkeypatch):
    cid = uuid.uuid4()
    monkeypatch.setattr(
        "app.services.lounge_service.LoungeService.restore_drive",
        lambda db, user_id, chat_id: [{"id": "1", "text": "restored"}],
    )

    res = client.get(f"/api/v1/lounge/drive/restore/{cid}")
    assert res.status_code == 200
    body = res.json()
    assert "messages" in body
    assert body["messages"] == [{"id": "1", "text": "restored"}]


def test_update_backup_settings_200(auth, monkeypatch):
    called = []

    def fake_update(db, user_id, interval, wifi_only):
        called.append((interval, wifi_only))

    monkeypatch.setattr(
        "app.services.lounge_service.LoungeService.update_backup_settings",
        fake_update,
    )

    res = client.patch(
        "/api/v1/lounge/settings/backup",
        json={"interval": "12h", "wifi_only": True},
    )
    assert res.status_code == 200
    assert len(called) == 1
    assert called[0] == ("12h", True)


# --- UNIT/SERVICE TESTS WITH EPHEMERAL DRIVE CACHE ---

def test_lounge_service_sync_and_restore_drive_ephemeral():
    from app.services.lounge_service import LoungeService

    db_mock = MagicMock()
    # Mock membership check
    db_mock.execute.return_value = exec_result(scalar_one_or_none=MagicMock())

    uid = uuid.uuid4()
    cid = uuid.uuid4()
    msgs = [{"id": "1", "text": "hello from unit test"}]

    # Sync
    LoungeService.sync_drive(db_mock, uid, cid, msgs, "drive-file-123")
    # Restore
    restored = LoungeService.restore_drive(db_mock, uid, cid)

    assert restored == msgs
