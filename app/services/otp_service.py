"""
Email verification OTP generation, storage, brute-force limits, and resend quotas.
"""
from __future__ import annotations

import hashlib
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User
from app.utils.exceptions import AppException

_OTP_VERIFY_IP_BUCKETS: dict[str, deque[float]] = defaultdict(deque)


def _sha256_otp_plain(otp: str) -> str:
    return hashlib.sha256(otp.encode()).hexdigest()


def _otp_now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _clear_stored_otp_only(user: User) -> None:
    user.verification_otp_hash = None
    user.otp_expires_at = None


def consume_verify_otp_rate_slot(client_ip: str) -> None:
    """Raise 429 when more than 5 verification attempts/minute per IP (process-local)."""
    now = time.monotonic()
    dq = _OTP_VERIFY_IP_BUCKETS[client_ip]
    window = 60.0
    while dq and (now - dq[0]) > window:
        dq.popleft()
    if len(dq) >= 5:
        AppException.rate_limit("Too many verification attempts. Try again in a minute.")
    dq.append(now)


class OtpService:

    OTP_TTL = timedelta(minutes=15)

    @staticmethod
    def generate_plain_otp() -> str:
        n = secrets.randbelow(1_000_000)
        return str(n).zfill(6)

    @classmethod
    def issue_email_otp_for_user(cls, db: Session, user: User) -> str:
        """
        Persist a fresh OTP hash and expiry; reset brute-force attempts.
        Returns plaintext OTP for the email body only — never persisted.
        """
        plain = cls.generate_plain_otp()
        now = _otp_now_utc()
        user.verification_otp_hash = _sha256_otp_plain(plain)
        user.otp_expires_at = now + cls.OTP_TTL
        user.otp_attempt_count = 0
        db.flush()
        return plain

    @staticmethod
    def clear_all_otp_fields(user: User) -> None:
        user.verification_otp_hash = None
        user.otp_expires_at = None
        user.otp_attempt_count = 0
        user.otp_resend_count = 0
        user.otp_resend_reset_at = None

    @staticmethod
    def check_resend_allowed(user: User) -> None:
        """
        Enforce max 3 email OTP sends per rolling hour window.
        Mutates otp_resend_count / otp_resend_reset_at on allowed path.
        """
        now = _otp_now_utc()
        reset_at = user.otp_resend_reset_at
        if reset_at is None or reset_at <= now:
            user.otp_resend_count = 0

        if user.otp_resend_count >= 3:
            AppException.too_many_requests(
                "Maximum resends reached. Try again in 1 hour."
            )

        prev = user.otp_resend_count
        user.otp_resend_count = prev + 1
        if prev == 0:
            user.otp_resend_reset_at = now + timedelta(hours=1)

    @staticmethod
    def verify_otp(db: Session, email: str, otp_input: str) -> User:
        normalized_email = email.strip().lower()
        raw_otp = (otp_input or "").strip()
        if len(raw_otp) != 6 or not raw_otp.isdigit():
            AppException.bad_request("Invalid code")

        user = db.execute(select(User).where(User.email == normalized_email)).scalar_one_or_none()

        if not user:
            AppException.bad_request("Invalid code")

        if user.is_verified:
            AppException.bad_request("Already verified")

        now = _otp_now_utc()
        expiry = user.otp_expires_at
        if user.verification_otp_hash is None or expiry is None or now > expiry:
            AppException.bad_request("OTP expired")

        if user.otp_attempt_count >= 3:
            _clear_stored_otp_only(user)
            user.otp_attempt_count = 0
            AppException.bad_request(
                "Too many attempts. Request a new code."
            )

        if _sha256_otp_plain(raw_otp) != user.verification_otp_hash:
            user.otp_attempt_count += 1
            exceeded = user.otp_attempt_count >= 3
            if exceeded:
                _clear_stored_otp_only(user)
                user.otp_attempt_count = 0
            db.commit()
            if exceeded:
                AppException.bad_request(
                    "Too many attempts. Request a new code."
                )
            AppException.bad_request("Invalid code")

        user.is_verified = True
        user.verified_at = now
        OtpService.clear_all_otp_fields(user)
        db.commit()
        db.refresh(user)
        return user
