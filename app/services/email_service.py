"""
SMTP email sending for transactional mail (verification, etc.).

Uses stdlib only — no SendGrid dependency. Configure SMTP_* in .env.
"""
from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from config import settings
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)


def smtp_configured() -> bool:
    return bool(
        settings.SMTP_HOST
        and settings.SMTP_FROM_EMAIL
    )


def send_plain_email(*, to_addr: str, subject: str, body: str) -> None:
    """Send a plain-text email. Raises AppException if SMTP is not configured or send fails."""
    if not smtp_configured():
        AppException.service_unavailable("Email is not configured (set SMTP_HOST and SMTP_FROM_EMAIL)")
    host = settings.SMTP_HOST or ""
    port = settings.SMTP_PORT
    user = settings.SMTP_USER
    password = settings.SMTP_PASSWORD
    from_addr = settings.SMTP_FROM_EMAIL or ""

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_addr
    msg.set_content(body)

    try:
        with smtplib.SMTP(host, port, timeout=30) as smtp:
            smtp.ehlo()
            if port == 587:
                smtp.starttls()
                smtp.ehlo()
            if user and password is not None:
                smtp.login(user, password)
            smtp.send_message(msg)
    except OSError as e:
        logger.warning("SMTP send failed: %s", e)
        AppException.bad_gateway("Could not send email — try again later")
    except smtplib.SMTPException as e:
        logger.warning("SMTP error: %s", e)
        AppException.bad_gateway("Could not send email — try again later")
