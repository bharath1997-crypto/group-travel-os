"""
app/routes/auth.py — Authentication endpoints

Routes are thin. Every route does exactly three things:
1. Accept the request
2. Call the service
3. Return the response

No business logic here.
"""
import logging
import secrets
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from twilio.rest import Client

from config import settings

from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    DeleteAccountRequest,
    ForgotPasswordRequest,
    PhoneSendRequest,
    PhoneVerifyRequest,
    RegisterResponse,
    ResendVerificationPublicRequest,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserOut,
    UserUpdate,
    VerifyEmailRequest,
    VerifyEmailSuccessResponse,
    build_user_out,
)
from app.services.auth_service import AuthService
from app.services.presence_service import PresenceService
from app.services.email_verification_service import (
    confirm_verification_token,
    request_verification_email,
)
from app.services.oauth_service import (
    complete_facebook,
    complete_google,
    facebook_authorize_url,
    google_authorize_url,
    verify_oauth_state,
)
from app.utils.auth import get_current_user
from app.utils.database import get_db
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)

# In-memory OTP storage (dev; replace with SMS / WhatsApp providers in production).
# Keys: "sms:{phone}" and "wa:{phone}" so the same E.164 does not share OTP between channels.
OTP_STORE: dict[str, str] = {}


def _otp_key_sms(phone: str) -> str:
    return f"sms:{phone.strip()}"


def _otp_key_wa(phone: str) -> str:
    return f"wa:{phone.strip()}"


def _generate_otp6() -> str:
    return f"{secrets.randbelow(900_000) + 100_000:06d}"


def _normalize_e164(phone: str) -> str:
    """
    E.164 for Twilio: leading + and digits only.
    Stops mismatches when the client omits + or adds spaces.
    """
    s = (phone or "").strip()
    if not s:
        return ""
    digits = "".join(c for c in s if c.isdigit())
    if not digits:
        return ""
    return f"+{digits}"


router = APIRouter(prefix="/auth", tags=["Auth"])


class ResetPasswordBody(BaseModel):
    """Body for POST /auth/reset-password (defined here to keep routes self-contained)."""

    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=100)


def _frontend() -> str:
    return settings.FRONTEND_URL.rstrip("/")


def _normalize_oauth_start_intent(intent: str | None) -> str:
    """Maps query intent to internal oauth_intent: login | signup."""
    if not intent:
        return "login"
    i = intent.lower().strip()
    if i in ("signup", "register"):
        return "signup"
    return "login"


def _oauth_detail_str(exc: HTTPException) -> str:
    d = exc.detail
    if isinstance(d, str):
        return d
    return str(d)


@router.get("/oauth/google/start", summary="Redirect to Google OAuth")
def oauth_google_start(intent: str = "login"):
    """intent=login: existing accounts only. intent=signup|register: create account if needed."""
    oauth_intent = _normalize_oauth_start_intent(intent)
    return RedirectResponse(
        google_authorize_url(oauth_intent=oauth_intent),
        status_code=status.HTTP_302_FOUND,
    )


@router.get("/oauth/google/callback", summary="Google OAuth callback")
def oauth_google_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    fe = _frontend()
    if error:
        return RedirectResponse(f"{fe}/auth/callback?oauth_error={quote(error)}")
    if not code or not state:
        return RedirectResponse(f"{fe}/auth/callback?oauth_error=missing_params")
    try:
        oauth_intent = verify_oauth_state(state, "google")
    except HTTPException as e:
        return RedirectResponse(
            f"{fe}/auth/callback?oauth_error={quote(_oauth_detail_str(e))}"
        )
    except Exception:
        logger.exception("Google OAuth state verification failed")
        return RedirectResponse(f"{fe}/auth/callback?oauth_error=invalid_state")

    try:
        _user, token, exp, created_new = complete_google(
            db, code, oauth_intent=oauth_intent
        )
    except HTTPException as e:
        return RedirectResponse(
            f"{fe}/auth/callback?oauth_error={quote(_oauth_detail_str(e))}"
            f"&oauth_intent={quote(oauth_intent)}"
        )
    except Exception:
        logger.exception("Google OAuth callback failed")
        return RedirectResponse(
            f"{fe}/auth/callback?oauth_error=server&oauth_intent={quote(oauth_intent)}"
        )
    parts = [
        f"access_token={quote(token)}",
        f"expires_in={int(exp)}",
        f"oauth_intent={quote(oauth_intent)}",
    ]
    if oauth_intent == "signup" and created_new:
        parts.append("oauth_new_user=1")
    q = "&".join(parts)
    return RedirectResponse(
        f"{fe}/auth/callback?{q}",
        status_code=status.HTTP_302_FOUND,
    )


@router.get("/oauth/facebook/start", summary="Redirect to Facebook OAuth")
def oauth_facebook_start(intent: str = "login"):
    oauth_intent = _normalize_oauth_start_intent(intent)
    return RedirectResponse(
        facebook_authorize_url(oauth_intent=oauth_intent),
        status_code=status.HTTP_302_FOUND,
    )


@router.get("/oauth/facebook/callback", summary="Facebook OAuth callback")
def oauth_facebook_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_reason: str | None = None,
    db: Session = Depends(get_db),
):
    fe = _frontend()
    err = error or error_reason
    if err:
        return RedirectResponse(f"{fe}/auth/callback?oauth_error={quote(err)}")
    if not code or not state:
        return RedirectResponse(f"{fe}/auth/callback?oauth_error=missing_params")
    try:
        oauth_intent = verify_oauth_state(state, "facebook")
    except HTTPException as e:
        return RedirectResponse(
            f"{fe}/auth/callback?oauth_error={quote(_oauth_detail_str(e))}"
        )
    except Exception:
        logger.exception("Facebook OAuth state verification failed")
        return RedirectResponse(f"{fe}/auth/callback?oauth_error=invalid_state")

    try:
        _user, token, exp, created_new = complete_facebook(
            db, code, oauth_intent=oauth_intent
        )
    except HTTPException as e:
        return RedirectResponse(
            f"{fe}/auth/callback?oauth_error={quote(_oauth_detail_str(e))}"
            f"&oauth_intent={quote(oauth_intent)}"
        )
    except Exception:
        logger.exception("Facebook OAuth callback failed")
        return RedirectResponse(
            f"{fe}/auth/callback?oauth_error=server&oauth_intent={quote(oauth_intent)}"
        )
    parts = [
        f"access_token={quote(token)}",
        f"expires_in={int(exp)}",
        f"oauth_intent={quote(oauth_intent)}",
    ]
    if oauth_intent == "signup" and created_new:
        parts.append("oauth_new_user=1")
    q = "&".join(parts)
    return RedirectResponse(
        f"{fe}/auth/callback?{q}",
        status_code=status.HTTP_302_FOUND,
    )


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
def register(data: UserCreate, db: Session = Depends(get_db)):
    user, token, expires_in = AuthService.register(
        db,
        data,
    )
    return RegisterResponse(
        user=build_user_out(user),
        token=TokenResponse(access_token=token, expires_in=expires_in),
    )


@router.post(
    "/login",
    response_model=RegisterResponse,
    summary="Login and receive access token",
)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user, token, expires_in = AuthService.login(db, data.email, data.password)
    return RegisterResponse(
        user=build_user_out(user),
        token=TokenResponse(access_token=token, expires_in=expires_in),
    )


@router.post(
    "/verify-email",
    response_model=VerifyEmailSuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify email using token from inbox link",
)
def verify_email_post(data: VerifyEmailRequest, db: Session = Depends(get_db)):
    user = AuthService.verify_email(db, data.token)
    return VerifyEmailSuccessResponse(
        message="Email verified successfully",
        user=build_user_out(user),
    )


@router.post(
    "/resend-verification",
    status_code=status.HTTP_200_OK,
    summary="Resend verification email (no hint if email is unknown)",
)
def resend_verification_public_route(
    data: ResendVerificationPublicRequest,
    db: Session = Depends(get_db),
):
    AuthService.resend_verification_public(db, str(data.email))
    return {"message": "If that email exists, a link was sent"}


@router.get(
    "/me",
    response_model=UserOut,
    summary="Get current user profile",
)
def get_me(current_user: User = Depends(get_current_user)):
    return build_user_out(AuthService.get_profile(current_user))


@router.patch(
    "/me",
    response_model=UserOut,
    summary="Update current user profile",
)
def update_me(
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = AuthService.update_profile(db, current_user, data)
    return build_user_out(user)


@router.post(
    "/presence",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Record web presence for group memberships (last seen)",
)
def post_presence(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    PresenceService.touch_web_presence(db, current_user.id)


@router.post(
    "/change-password",
    status_code=status.HTTP_200_OK,
    summary="Change current user password",
)
def change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    AuthService.change_password(db, current_user, data)
    return {"message": "Password changed successfully"}


@router.post(
    "/account/deactivate",
    status_code=status.HTTP_200_OK,
    summary="Soft-deactivate account (confirmation DELETE; password if not OAuth)",
)
def deactivate_account(
    data: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    AuthService.deactivate_account(db, current_user, data)
    return {"message": "Account deactivated"}


@router.post(
    "/send-verification-email",
    status_code=status.HTTP_200_OK,
    summary="Send or resend email verification link",
)
def send_verification_email_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    request_verification_email(db, current_user)
    return {"message": "Verification email sent"}


@router.get(
    "/verify-email/confirm",
    summary="Confirm email from inbox link; redirects to the app",
)
def verify_email_confirm(
    token: str | None = None,
    db: Session = Depends(get_db),
):
    fe = _frontend()
    if not token:
        return RedirectResponse(f"{fe}/verify-email?error=missing_token")
    try:
        confirm_verification_token(db, token.strip())
    except HTTPException:
        return RedirectResponse(f"{fe}/verify-email?error=invalid_or_expired")
    return RedirectResponse(f"{fe}/verify-email?verified=1")


@router.post(
    "/forgot-password",
    status_code=status.HTTP_200_OK,
    summary="Request a password reset email",
)
def forgot_password(
    data: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """Always returns success to avoid leaking whether an email is registered."""
    AuthService.request_password_reset(db, str(data.email))
    return {
        "message": "If an account exists for that email, we've sent a reset link.",
    }


@router.post(
    "/reset-password",
    status_code=status.HTTP_200_OK,
    summary="Complete password reset using token from email",
)
def reset_password(data: ResetPasswordBody, db: Session = Depends(get_db)):
    AuthService.reset_password_with_token(db, data.token, data.new_password)
    return {"message": "Password has been reset successfully."}


@router.post(
    "/phone/send",
    status_code=status.HTTP_200_OK,
    summary="Send phone OTP (Twilio SMS; console + dev_mode fallback on failure or in development)",
)
def phone_send_otp(data: PhoneSendRequest):
    phone = _normalize_e164(data.phone)
    if not phone or len(phone) < 10:
        AppException.bad_request("Invalid phone number")
    otp = _generate_otp6()
    OTP_STORE[_otp_key_sms(phone)] = otp
    from_num = (settings.twilio_phone_number or "").strip()
    has_twilio = bool(
        settings.twilio_account_sid
        and settings.twilio_auth_token
        and from_num
    )
    if has_twilio:
        if not from_num.startswith("+"):
            from_num = f"+{from_num.lstrip('+')}"
        try:
            client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
            msg = client.messages.create(
                body=f"Your Group Travel OS verification code is: {otp}",
                from_=from_num,
                to=phone,
            )
            logger.info("Twilio SMS API accepted: sid=%s to=%s", msg.sid, phone)
        except Exception:
            logger.exception("Twilio SMS send failed to=%s", phone)
            print(f"[DEV OTP] phone={phone} otp={otp}", flush=True)
            return {"message": "OTP sent", "dev_mode": True}
        if settings.ENVIRONMENT == "development":
            print(f"[DEV OTP] phone={phone} otp={otp}", flush=True)
            return {"message": "OTP sent", "dev_mode": True}
        return {"message": "OTP sent"}
    print(f"[DEV OTP] phone={phone} otp={otp}", flush=True)
    return {"message": "OTP sent", "dev_mode": True}


@router.post(
    "/phone/verify",
    status_code=status.HTTP_200_OK,
    summary="Verify phone OTP and save number on the authenticated user",
)
def phone_verify_otp(
    data: PhoneVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    phone = _normalize_e164(data.phone)
    otp = data.otp.strip()
    key = _otp_key_sms(phone)
    if OTP_STORE.get(key) == otp:
        del OTP_STORE[key]
        current_user.phone = phone
        db.commit()
        db.refresh(current_user)
        return {"message": "Phone verified", "verified": True}
    AppException.bad_request("Invalid or expired OTP")


@router.post(
    "/whatsapp/send",
    status_code=status.HTTP_200_OK,
    summary="Send WhatsApp OTP via Twilio (sandbox; console fallback if not configured)",
)
def whatsapp_send_otp(data: PhoneSendRequest):
    phone = _normalize_e164(data.phone)
    if not phone or len(phone) < 10:
        AppException.bad_request("Invalid phone number")
    otp = _generate_otp6()
    OTP_STORE[_otp_key_wa(phone)] = otp
    if settings.twilio_account_sid and settings.twilio_auth_token:
        try:
            client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
            client.messages.create(
                body=f"Your Group Travel OS verification code is: {otp}",
                from_="whatsapp:+14155238886",
                to=f"whatsapp:{phone}",
            )
        except Exception as e:
            logger.exception("Twilio WhatsApp send failed: %s", e)
            # Do not return 200: clients must know delivery failed (sandbox not joined, wrong number, etc.)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "Could not send WhatsApp. If you use Twilio's sandbox, open WhatsApp, send your "
                    "join message to the Twilio sandbox number (see Twilio Console → Messaging), "
                    "then try again. You must also enter the same mobile number in the WhatsApp "
                    "field on this page (it is separate from the SMS field)."
                ),
            ) from e
    else:
        print(f"[WhatsApp OTP] {phone} -> {otp}", flush=True)
    return {"message": "WhatsApp OTP sent"}


@router.post(
    "/whatsapp/verify",
    status_code=status.HTTP_200_OK,
    summary="Verify WhatsApp OTP and save number on the authenticated user",
)
def whatsapp_verify_otp(
    data: PhoneVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    phone = _normalize_e164(data.phone)
    otp = data.otp.strip()
    key = _otp_key_wa(phone)
    if OTP_STORE.get(key) == otp:
        del OTP_STORE[key]
        current_user.whatsapp_number = phone
        current_user.whatsapp_verified = True
        db.commit()
        db.refresh(current_user)
        return {"message": "Phone verified", "verified": True}
    AppException.bad_request("Invalid or expired OTP")
