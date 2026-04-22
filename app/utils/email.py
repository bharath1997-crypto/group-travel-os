"""
Transactional email via Brevo (Sendinblue) API.
"""
from __future__ import annotations

import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException

from config import get_settings


def _get_api():
    settings = get_settings()
    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key["api-key"] = settings.brevo_api_key
    return sib_api_v3_sdk.TransactionalEmailsApi(
        sib_api_v3_sdk.ApiClient(configuration)
    )


def send_verification_email(to_email: str, full_name: str, token: str) -> None:
    settings = get_settings()
    verify_url = f"{settings.frontend_url}/verify-email?token={token}"

    if not settings.brevo_api_key:
        print(f"[DEV MODE] Verify URL: {verify_url}")
        return

    api = _get_api()
    send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": to_email, "name": full_name}],
        sender={"email": settings.from_email, "name": settings.from_name},
        subject="Verify your Travello account ✈️",
        html_content=_verification_html(full_name, verify_url, settings.frontend_url),
    )
    try:
        api.send_transac_email(send_smtp_email)
    except ApiException as e:
        print(f"[EMAIL ERROR] Brevo failed: {e}")


def send_password_reset_email(to_email: str, full_name: str, token: str) -> None:
    settings = get_settings()
    reset_url = f"{settings.frontend_url}/reset-password?token={token}"

    if not settings.brevo_api_key:
        print(f"[DEV MODE] Reset URL: {reset_url}")
        return

    api = _get_api()
    send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
        to=[{"email": to_email, "name": full_name}],
        sender={"email": settings.from_email, "name": settings.from_name},
        subject="Reset your Travello password 🔐",
        html_content=_reset_html(full_name, reset_url, settings.frontend_url),
    )
    try:
        api.send_transac_email(send_smtp_email)
    except ApiException as e:
        print(f"[EMAIL ERROR] Brevo reset failed: {e}")


def _verification_html(full_name: str, verify_url: str, app_url: str) -> str:
    first_name = full_name.split()[0] if full_name else "Traveler"
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
        <tr><td align="center">
          <table width="520" cellpadding="0" cellspacing="0" style="background:white;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
            
            <!-- HEADER GRADIENT BANNER -->
            <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#dc2626 100%);padding:48px 40px;text-align:center;">
              <div style="font-size:48px;margin-bottom:16px;">✈️</div>
              <h1 style="color:white;font-size:28px;font-weight:700;margin:0;letter-spacing:-0.5px;">
                Welcome to Travello
              </h1>
              <p style="color:rgba(255,255,255,0.75);font-size:15px;margin:8px 0 0;">
                Your group travel companion
              </p>
            </td></tr>
            
            <!-- BODY -->
            <tr><td style="padding:40px;">
              <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">
                Hey {first_name} 👋
              </p>
              <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 32px;">
                You're one step away from planning unforgettable trips with your crew.
                Just verify your email to activate your account.
              </p>
              
              <!-- CTA BUTTON -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td align="center" style="padding:8px 0 32px;">
                  <a href="{verify_url}" 
                     style="display:inline-block;background:#dc2626;color:white;
                            padding:16px 48px;border-radius:12px;font-size:16px;
                            font-weight:600;text-decoration:none;letter-spacing:0.2px;">
                    Verify my email →
                  </a>
                </td></tr>
              </table>
              
              <!-- FEATURES PREVIEW -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td width="33%" style="text-align:center;padding:16px 8px;">
                    <div style="font-size:24px;margin-bottom:8px;">🗺️</div>
                    <div style="font-size:12px;color:#6b7280;font-weight:500;">Plan Trips</div>
                  </td>
                  <td width="33%" style="text-align:center;padding:16px 8px;">
                    <div style="font-size:24px;margin-bottom:8px;">💰</div>
                    <div style="font-size:12px;color:#6b7280;font-weight:500;">Split Expenses</div>
                  </td>
                  <td width="33%" style="text-align:center;padding:16px 8px;">
                    <div style="font-size:24px;margin-bottom:8px;">📍</div>
                    <div style="font-size:12px;color:#6b7280;font-weight:500;">Live Location</div>
                  </td>
                </tr>
              </table>
              
              <!-- DIVIDER -->
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px;">
              
              <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0;">
                This link expires in <strong>24 hours</strong>. 
                Didn't sign up? You can safely ignore this email.
              </p>
            </td></tr>
            
            <!-- FOOTER -->
            <tr><td style="background:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="color:#9ca3af;font-size:12px;margin:0;">
                © 2026 Travello · Group Travel OS<br>
                <a href="{app_url}" style="color:#dc2626;text-decoration:none;">
                  {app_url}
                </a>
              </p>
            </td></tr>
            
          </table>
        </td></tr>
      </table>
    </body>
    </html>
    """


def _reset_html(full_name: str, reset_url: str, app_url: str) -> str:
    first_name = full_name.split()[0] if full_name else "Traveler"
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
        <tr><td align="center">
          <table width="520" cellpadding="0" cellspacing="0" style="background:white;border-radius:24px;overflow:hidden;">
            <tr><td style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:48px 40px;text-align:center;">
              <div style="font-size:48px;margin-bottom:16px;">🔐</div>
              <h1 style="color:white;font-size:28px;font-weight:700;margin:0;">Reset password</h1>
            </td></tr>
            <tr><td style="padding:40px;">
              <p style="color:#374151;font-size:16px;line-height:1.6;">Hey {first_name},</p>
              <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 32px;">
                We received a request to reset your Travello password. Click below to choose a new one.
              </p>
              <table width="100%"><tr><td align="center" style="padding-bottom:32px;">
                <a href="{reset_url}" style="display:inline-block;background:#dc2626;color:white;padding:16px 48px;border-radius:12px;font-size:16px;font-weight:600;text-decoration:none;">
                  Reset my password →
                </a>
              </td></tr></table>
              <p style="color:#9ca3af;font-size:13px;">Expires in 1 hour. Didn't request this? Ignore safely.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
    """
