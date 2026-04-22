"""Unit tests for app.services.auth_service.AuthService — mocked Session only."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
import uuid
import pytest
from fastapi import HTTPException

from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, UserCreate, UserUpdate
from app.services import auth_service
from app.services.auth_service import AuthService, _hash_password_reset_token
from app.utils.auth import hash_password
from tests.conftest import exec_result


@pytest.fixture
def sample_user() -> User:
    return User(
        email="member@example.com",
        hashed_password=hash_password("correcthorse123"),
        full_name="Member User",
        is_active=True,
    )


def test_register_creates_user_and_returns_token(db, monkeypatch):
    db.execute.return_value = exec_result(scalar_one_or_none=None)

    captured: dict = {}

    def fake_token(uid: uuid.UUID):
        captured["uid"] = uid
        return "tok", 3600

    monkeypatch.setattr(auth_service, "create_access_token", fake_token)
    monkeypatch.setattr(
        auth_service,
        "send_verification_email",
        lambda *_a, **_k: None,
    )

    data = UserCreate(
        email="NEW@example.com",
        password="password12345",
        full_name="New Person",
        date_of_birth=date(1990, 1, 1),
    )
    user, token, expires = AuthService.register(db, data)

    assert user.email == "new@example.com"
    assert token == "tok"
    assert expires == 3600
    assert captured["uid"] == user.id
    db.add.assert_called_once()
    # register + _issue_verification_token each commit/refresh
    assert db.commit.call_count == 2
    assert db.refresh.call_count == 2


def test_register_conflict_when_email_exists(db, sample_user: User):
    db.execute.return_value = exec_result(scalar_one_or_none=sample_user)

    data = UserCreate(
        email=sample_user.email,
        password="password12345",
        full_name="Xy",
        date_of_birth=date(1990, 1, 1),
    )
    with pytest.raises(HTTPException) as ei:
        AuthService.register(db, data)
    assert ei.value.status_code == 409


def test_login_success(db, sample_user: User, monkeypatch):
    db.execute.return_value = exec_result(scalar_one_or_none=sample_user)

    monkeypatch.setattr(
        auth_service,
        "create_access_token",
        lambda uid: ("access", 7200),
    )

    user, token, expires = AuthService.login(db, sample_user.email, "correcthorse123")
    assert user is sample_user
    assert token == "access"
    assert expires == 7200


def test_login_unauthorized_when_password_wrong(db, sample_user: User):
    db.execute.return_value = exec_result(scalar_one_or_none=sample_user)

    with pytest.raises(HTTPException) as ei:
        AuthService.login(db, sample_user.email, "wrong-password-xxx")
    assert ei.value.status_code == 401
    assert "Invalid email or password" in ei.value.detail


def test_login_forbidden_when_user_inactive(db, sample_user: User):
    sample_user.is_active = False
    db.execute.return_value = exec_result(scalar_one_or_none=sample_user)

    with pytest.raises(HTTPException) as ei:
        AuthService.login(db, sample_user.email, "correcthorse123")
    assert ei.value.status_code == 403


def test_get_profile_returns_same_user(sample_user: User):
    assert AuthService.get_profile(sample_user) is sample_user


def test_update_profile_applies_fields(db, sample_user: User):
    data = UserUpdate(full_name="Updated Name", avatar_url="https://x.test/a.png")
    out = AuthService.update_profile(db, sample_user, data)
    assert out.full_name == "Updated Name"
    assert out.avatar_url == "https://x.test/a.png"
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(sample_user)


def test_change_password_success(db, sample_user: User):
    sample_user.hashed_password = hash_password("oldsecret12345")
    data = ChangePasswordRequest(old_password="oldsecret12345", new_password="newsecret12345")
    AuthService.change_password(db, sample_user, data)
    assert auth_service.verify_password("newsecret12345", sample_user.hashed_password)
    assert not auth_service.verify_password("oldsecret12345", sample_user.hashed_password)
    db.commit.assert_called_once()


def test_change_password_unauthorized_when_old_password_wrong(db, sample_user: User):
    sample_user.hashed_password = hash_password("real-old-pass123")
    data = ChangePasswordRequest(old_password="nope-not-this", new_password="newsecret12345")
    with pytest.raises(HTTPException) as ei:
        AuthService.change_password(db, sample_user, data)
    assert ei.value.status_code == 401


def test_request_password_reset_unknown_email_no_commit(db):
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    AuthService.request_password_reset(db, "missing@example.com")
    db.commit.assert_not_called()


def test_request_password_reset_empty_email_no_commit(db):
    AuthService.request_password_reset(db, "   ")
    db.commit.assert_not_called()


def test_request_password_reset_without_smtp_uses_dev_link(
    db, sample_user: User, monkeypatch
):
    db.execute.return_value = exec_result(scalar_one_or_none=sample_user)
    monkeypatch.setattr(auth_service, "smtp_configured", lambda: False)
    monkeypatch.setattr(auth_service.settings, "resend_api_key", "")
    monkeypatch.setattr(
        auth_service,
        "send_password_reset_email",
        lambda *_a, **_k: None,
    )
    monkeypatch.setattr(auth_service.secrets, "token_urlsafe", lambda n=32: "dev-token")
    AuthService.request_password_reset(db, sample_user.email)
    db.commit.assert_called_once()
    assert sample_user.password_reset_token == _hash_password_reset_token("dev-token")


def test_request_password_reset_stores_token_and_sends_email(db, sample_user: User, monkeypatch):
    db.execute.return_value = exec_result(scalar_one_or_none=sample_user)
    monkeypatch.setattr(auth_service.settings, "resend_api_key", "")
    monkeypatch.setattr(auth_service, "smtp_configured", lambda: True)
    monkeypatch.setattr(auth_service.secrets, "token_urlsafe", lambda n=32: "known-token")
    sent: list[tuple[str, str, str]] = []

    def capture(to: str, subject: str, body: str) -> None:
        sent.append((to, subject, body))

    monkeypatch.setattr(auth_service, "send_email", capture)
    AuthService.request_password_reset(db, sample_user.email)
    db.commit.assert_called_once()
    assert len(sent) == 1
    assert sent[0][0] == sample_user.email
    assert "reset-password" in sent[0][2]
    assert "known-token" in sent[0][2]
    assert sample_user.password_reset_token == _hash_password_reset_token("known-token")


def test_reset_password_with_token_success(db, sample_user: User):
    raw = "reset-secret-token"
    sample_user.password_reset_token = _hash_password_reset_token(raw)
    sample_user.password_reset_expires = datetime.now(timezone.utc) + timedelta(minutes=30)
    db.execute.return_value = exec_result(scalar_one_or_none=sample_user)

    AuthService.reset_password_with_token(db, raw, "brandnewpass12345")

    assert auth_service.verify_password("brandnewpass12345", sample_user.hashed_password)
    assert sample_user.password_reset_token is None
    assert sample_user.password_reset_expires is None
    db.commit.assert_called_once()


def test_reset_password_invalid_token(db):
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    with pytest.raises(HTTPException) as ei:
        AuthService.reset_password_with_token(db, "bad-token", "newpassword12345")
    assert ei.value.status_code == 400


def test_reset_password_expired_token(db, sample_user: User):
    sample_user.password_reset_token = _hash_password_reset_token("t")
    sample_user.password_reset_expires = datetime.now(timezone.utc) - timedelta(hours=1)
    db.execute.return_value = exec_result(scalar_one_or_none=sample_user)
    with pytest.raises(HTTPException) as ei:
        AuthService.reset_password_with_token(db, "t", "newpassword12345")
    assert ei.value.status_code == 400


def test_reset_password_too_short(db):
    with pytest.raises(HTTPException) as ei:
        AuthService.reset_password_with_token(db, "any-token", "short")
    assert ei.value.status_code == 400
