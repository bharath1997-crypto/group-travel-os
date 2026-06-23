"""Tests for Live Tab spectator mode."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.models.live_session import LiveMode, LiveSession
from app.models.spectator_invite import SpectatorInvite
from app.services.live_service import LiveService
from app.utils.auth import get_current_user
from tests.conftest import exec_result

_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_OTHER_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
_SESSION_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
_TOKEN = "spectator-test-token"


def _mock_user(user_id: uuid.UUID = _USER_ID):
    user = type("User", (), {})()
    user.id = user_id
    user.full_name = "Host User"
    user.avatar_url = "https://example.com/avatar.png"
    user.is_active = True
    return user


def _active_session(
    user_id: uuid.UUID = _USER_ID,
    session_id: uuid.UUID = _SESSION_ID,
    *,
    is_active: bool = True,
) -> LiveSession:
    now = datetime.now(timezone.utc)
    return LiveSession(
        id=session_id,
        trip_id=None,
        started_by=user_id,
        mode=LiveMode.solo,
        is_active=is_active,
        started_at=now - timedelta(minutes=10),
        ended_at=None if is_active else now,
    )


def _invite(
    *,
    host_user_id: uuid.UUID = _USER_ID,
    session_id: uuid.UUID = _SESSION_ID,
    token: str = _TOKEN,
    is_active: bool = True,
    expires_at: datetime | None = None,
) -> SpectatorInvite:
    now = datetime.now(timezone.utc)
    return SpectatorInvite(
        id=uuid.uuid4(),
        session_id=session_id,
        host_user_id=host_user_id,
        invite_token=token,
        is_active=is_active,
        created_at=now,
        expires_at=expires_at or now + timedelta(hours=12),
    )


@pytest.fixture(autouse=True)
def _reset_auth():
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def auth_client():
    app.dependency_overrides[get_current_user] = lambda: _mock_user()
    return TestClient(app, raise_server_exceptions=True)


class TestCreateSpectatorInvite:
    def test_create_spectator_invite_success(self, db, mock_user, monkeypatch):
        session = _active_session()
        db.execute.return_value = exec_result(scalar_one_or_none=session)
        monkeypatch.setattr(
            "app.services.live_service.secrets.token_urlsafe",
            lambda _n: "generated-token",
        )
        result = LiveService.create_spectator_invite(db, mock_user.id)
        assert result["invite_token"] == "generated-token"
        assert result["share_url"] == "https://rovvy.app/live/watch/generated-token"
        assert result["expires_at"] is not None
        db.add.assert_called_once()
        db.commit.assert_called_once()

    def test_create_spectator_invite_no_active_session(self, db, mock_user):
        db.execute.return_value = exec_result(scalar_one_or_none=None)
        with pytest.raises(HTTPException) as exc:
            LiveService.create_spectator_invite(db, mock_user.id)
        assert exc.value.status_code == 404


class TestValidateSpectatorInvite:
    def test_validate_invite_success(self, db, mock_user):
        invite = _invite()
        session = _active_session()
        host = MagicMock()
        host.full_name = "Host User"
        host.avatar_url = "https://example.com/avatar.png"
        db.execute.side_effect = [
            exec_result(scalar_one_or_none=invite),
            exec_result(scalar_one_or_none=session),
            exec_result(scalar_one_or_none=host),
        ]
        result = LiveService.validate_spectator_invite(db, _OTHER_ID, _TOKEN)
        assert result["session_id"] == _SESSION_ID
        assert result["host_name"] == "Host User"
        assert result["host_avatar"] == "https://example.com/avatar.png"
        assert result["firebase_path"] == f"live_locations/{_USER_ID}"

    def test_validate_invite_not_found(self, db, mock_user):
        db.execute.return_value = exec_result(scalar_one_or_none=None)
        with pytest.raises(HTTPException) as exc:
            LiveService.validate_spectator_invite(db, _OTHER_ID, "missing")
        assert exc.value.status_code == 404

    def test_validate_invite_expired(self, db, mock_user):
        invite = _invite(
            expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
        )
        db.execute.return_value = exec_result(scalar_one_or_none=invite)
        with pytest.raises(HTTPException) as exc:
            LiveService.validate_spectator_invite(db, _OTHER_ID, _TOKEN)
        assert exc.value.status_code == 400

    def test_validate_invite_session_ended(self, db, mock_user):
        invite = _invite()
        session = _active_session(is_active=False)
        db.execute.side_effect = [
            exec_result(scalar_one_or_none=invite),
            exec_result(scalar_one_or_none=session),
        ]
        with pytest.raises(HTTPException) as exc:
            LiveService.validate_spectator_invite(db, _OTHER_ID, _TOKEN)
        assert exc.value.status_code == 400


class TestDeactivateSpectatorInvite:
    def test_deactivate_invite_success(self, db, mock_user):
        invite = _invite()
        db.execute.return_value = exec_result(scalar_one_or_none=invite)
        LiveService.deactivate_spectator_invite(db, _USER_ID, _TOKEN)
        assert invite.is_active is False
        db.commit.assert_called_once()

    def test_deactivate_invite_not_host(self, db, mock_user):
        invite = _invite(host_user_id=_OTHER_ID)
        db.execute.return_value = exec_result(scalar_one_or_none=invite)
        with pytest.raises(HTTPException) as exc:
            LiveService.deactivate_spectator_invite(db, _USER_ID, _TOKEN)
        assert exc.value.status_code == 403


class TestEndSessionSpectatorInvites:
    def test_end_session_deactivates_invites(self, db, mock_user):
        session = _active_session()
        db.execute.return_value = exec_result(scalar_one_or_none=session)
        LiveService.end_session(db, _USER_ID, _SESSION_ID)
        assert session.is_active is False
        assert session.ended_at is not None
        assert db.execute.call_count == 2
        db.commit.assert_called_once()


class TestSpectatorRoutes:
    def test_validate_route_success(self, auth_client, monkeypatch):
        now = datetime.now(timezone.utc)
        monkeypatch.setattr(
            LiveService,
            "validate_spectator_invite",
            lambda db, user_id, token: {
                "session_id": _SESSION_ID,
                "host_name": "Host User",
                "host_avatar": "https://example.com/avatar.png",
                "trip_id": None,
                "started_at": now,
                "firebase_path": f"live_locations/{_USER_ID}",
            },
        )
        resp = auth_client.get(f"/api/v1/live/spectator/validate/{_TOKEN}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["host_name"] == "Host User"
        assert body["firebase_path"] == f"live_locations/{_USER_ID}"

    def test_active_count_route_success(self, auth_client, monkeypatch):
        monkeypatch.setattr(
            LiveService,
            "get_spectator_active_count",
            lambda db, user_id, session_id: {"count": 2},
        )
        resp = auth_client.get(f"/api/v1/live/spectator/active-count/{_SESSION_ID}")
        assert resp.status_code == 200
        assert resp.json()["count"] == 2
