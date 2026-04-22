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


def resend_configured() -> bool:
    return bool(settings.resend_api_key)


def transactional_email_configured() -> bool:
    """True if either Resend API key or SMTP is configured."""
    return resend_configured() or smtp_configured()


def send_verification_email(to_email: str, full_name: str, token: str) -> None:
    """HTML verification mail via Resend; logs link in dev when API key is unset."""
    import resend

    from config import get_settings

    cfg = get_settings()
    if not cfg.resend_api_key:
        verify_url = f"{cfg.frontend_url}/verify-email?token={token}"
        print(f"[DEV] Verification link: {verify_url}")
        return

    resend.api_key = cfg.resend_api_key
    verify_url = f"{cfg.frontend_url}/verify-email?token={token}"

    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: sans-serif; background: #f9fafb; padding: 40px 0;">
      <div style="max-width: 480px; margin: 0 auto; background: white;
                  border-radius: 16px; padding: 40px; border: 1px solid #e5e7eb;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="font-size: 32px; margin-bottom: 8px;">✈️</div>
          <h1 style="color: #0f172a; font-size: 24px; margin: 0;">
            Welcome to Travello
          </h1>
        </div>
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
          Hi {full_name},
        </p>
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
          Thanks for signing up! Please verify your email address
          to activate your account and start planning trips.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="{verify_url}"
             style="background: #dc2626; color: white; padding: 14px 32px;
                    border-radius: 8px; text-decoration: none;
                    font-size: 16px; font-weight: 600; display: inline-block;">
            Verify my email
          </a>
        </div>
        <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">
          This link expires in 24 hours. If you did not sign up for
          Travello, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">
          Travello — Group Travel OS<br>
          <a href="{cfg.frontend_url}" style="color: #dc2626;">
            {cfg.frontend_url}
          </a>
        </p>
      </div>
    </body>
    </html>
    """

    try:
        resend.Emails.send(
            {
                "from": cfg.from_email,
                "to": to_email,
                "subject": "Verify your Travello account ✈️",
                "html": html,
            }
        )
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send verification email: {e}")


def send_password_reset_email(to_email: str, full_name: str, token: str) -> None:
    """HTML password reset via Resend; logs link in dev when API key is unset."""
    import resend

    from config import get_settings

    cfg = get_settings()
    if not cfg.resend_api_key:
        reset_url = f"{cfg.frontend_url}/reset-password?token={token}"
        print(f"[DEV] Reset link: {reset_url}")
        return

    resend.api_key = cfg.resend_api_key
    reset_url = f"{cfg.frontend_url}/reset-password?token={token}"

    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: sans-serif; background: #f9fafb; padding: 40px 0;">
      <div style="max-width: 480px; margin: 0 auto; background: white;
                  border-radius: 16px; padding: 40px; border: 1px solid #e5e7eb;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="font-size: 32px; margin-bottom: 8px;">🔐</div>
          <h1 style="color: #0f172a; font-size: 24px; margin: 0;">
            Reset your password
          </h1>
        </div>
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
          Hi {full_name}, we received a request to reset your
          Travello password.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="{reset_url}"
             style="background: #dc2626; color: white; padding: 14px 32px;
                    border-radius: 8px; text-decoration: none;
                    font-size: 16px; font-weight: 600; display: inline-block;">
            Reset password
          </a>
        </div>
        <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">
          This link expires in 1 hour. If you did not request a
          password reset, you can safely ignore this email.
        </p>
      </div>
    </body>
    </html>
    """

    try:
        resend.Emails.send(
            {
                "from": cfg.from_email,
                "to": to_email,
                "subject": "Reset your Travello password 🔐",
                "html": html,
            }
        )
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send reset email: {e}")
