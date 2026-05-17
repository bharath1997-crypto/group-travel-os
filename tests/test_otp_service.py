import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import pytest
from fastapi import HTTPException

from app.models.user import User
from app.services.otp_service import OtpService, consume_verify_otp_rate_slot
from tests.conftest import exec_result


def _hash_otp(plain: str) -> str:
    return hashlib.sha256(plain.encode()).hexdigest()


def _fresh_unverified_user(otp_plain: str = "482910"):
    """ORM-like stub with attributes OtpService mutates."""
    now = datetime.now(timezone.utc)
    u = User(
        email="test@example.com",
        hashed_password="x",
        full_name="Test User",
    )
    u.id = uuid.uuid4()
    u.is_verified = False
    u.verification_otp_hash = _hash_otp(otp_plain)
    u.otp_expires_at = now + timedelta(minutes=10)
    u.otp_attempt_count = 0
    return u


def test_verify_otp_success(db):
    user = _fresh_unverified_user("482910")
    db.execute.return_value = exec_result(scalar_one_or_none=user)

    out = OtpService.verify_otp(db, "test@example.com", "482910")

    assert out.is_verified is True
    assert out.verified_at is not None
    assert user.verification_otp_hash is None
    db.commit.assert_called()


def test_verify_otp_wrong_code(db):
    user = _fresh_unverified_user("482910")
    db.execute.return_value = exec_result(scalar_one_or_none=user)

    with pytest.raises(HTTPException) as exc:
        OtpService.verify_otp(db, "test@example.com", "000000")
    assert exc.value.status_code == 400
    assert user.otp_attempt_count == 1
    db.commit.assert_called()


def test_verify_otp_expired(db):
    user = _fresh_unverified_user()
    user.otp_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.execute.return_value = exec_result(scalar_one_or_none=user)

    with pytest.raises(HTTPException) as exc:
        OtpService.verify_otp(db, "test@example.com", "482910")
    assert exc.value.status_code == 400
    assert "expired" in str(exc.value.detail).lower()


def test_verify_otp_max_attempts_lockout(db):
    user = _fresh_unverified_user("482910")
    user.otp_attempt_count = 2
    db.execute.return_value = exec_result(scalar_one_or_none=user)

    with pytest.raises(HTTPException) as exc:
        OtpService.verify_otp(db, "test@example.com", "000000")
    assert exc.value.status_code == 400
    assert "attempts" in str(exc.value.detail).lower()
    assert user.verification_otp_hash is None


def test_resend_max_limit():
    user = SimpleNamespace(
        otp_resend_count=0,
        otp_resend_reset_at=None,
    )
    OtpService.check_resend_allowed(user)
    OtpService.check_resend_allowed(user)
    OtpService.check_resend_allowed(user)
    assert user.otp_resend_count == 3

    with pytest.raises(HTTPException) as exc:
        OtpService.check_resend_allowed(user)
    assert exc.value.status_code == 429


def test_verify_already_verified(db):
    user = _fresh_unverified_user()
    user.is_verified = True
    db.execute.return_value = exec_result(scalar_one_or_none=user)

    with pytest.raises(HTTPException) as exc:
        OtpService.verify_otp(db, "test@example.com", "482910")
    assert exc.value.status_code == 400
    assert "already verified" in str(exc.value.detail).lower()


def test_consume_verify_otp_rate_slot_allows_then_blocks():
    ip = "198.51.100.9"
    for _ in range(5):
        consume_verify_otp_rate_slot(ip)

    with pytest.raises(HTTPException) as exc:
        consume_verify_otp_rate_slot(ip)
    assert exc.value.status_code == 429

