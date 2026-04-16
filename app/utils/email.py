"""
Transactional email via SMTP (stdlib).

Uses ``config.settings`` SMTP_* fields. Prefer this module for new code that needs
``send_email(to, subject, body)``.
"""
from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from config import settings

logger = logging.getLogger(__name__)


def smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_FROM_EMAIL)


def send_email(to: str, subject: str, body: str) -> None:
    """
    Send a plain-text email. Raises if SMTP is not configured or send fails
    (same behavior as ``app.services.email_service.send_plain_email``).
    """
    if not smtp_configured():
        raise RuntimeError("Email is not configured (set SMTP_HOST and SMTP_FROM_EMAIL)")

    host = settings.SMTP_HOST or ""
    port = settings.SMTP_PORT
    user = settings.SMTP_USER
    password = settings.SMTP_PASSWORD
    from_addr = settings.SMTP_FROM_EMAIL or ""

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to
    msg.set_content(body)

    with smtplib.SMTP(host, port, timeout=30) as smtp:
        smtp.ehlo()
        if port == 587:
            smtp.starttls()
            smtp.ehlo()
        if user and password is not None:
            smtp.login(user, password)
        smtp.send_message(msg)
