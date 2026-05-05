"""
app/schemas/auth.py — Auth request and response schemas

Rules:
- Never include hashed_password in any response schema
- All response schemas use model_config = ConfigDict(from_attributes=True)
"""
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.user import User

# ── Request schemas (input) ───────────────────────────────────────────────────

class UserCreate(BaseModel):
    """Body for POST /auth/register"""
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    full_name: str = Field(..., min_length=2, max_length=120)
    username: str | None = Field(None, max_length=50)
    phone: str | None = Field(None, max_length=32)
    country: str | None = Field(None, max_length=80)
    date_of_birth: date

    @field_validator("date_of_birth")
    @classmethod
    def must_be_adult(cls, v: date) -> date:
        today = date.today()
        age = today.year - v.year - ((today.month, today.day) < (v.month, v.day))
        if age < 18:
            raise ValueError("You must be 18 or older to use Travello")
        return v


class UserLogin(BaseModel):
    """Body for POST /auth/login — field `email` accepts email or username."""
    email: str = Field(..., min_length=1, max_length=255)
    password: str


class ForgotPasswordRequest(BaseModel):
    """Body for POST /auth/forgot-password"""
    email: EmailStr


class PhoneSendRequest(BaseModel):
    """Body for POST /auth/phone/send"""
    phone: str = Field(..., min_length=8, max_length=32)


class PhoneVerifyRequest(BaseModel):
    """Body for POST /auth/phone/verify"""
    phone: str = Field(..., min_length=8, max_length=32)
    otp: str = Field(..., min_length=6, max_length=6)


class UserUpdate(BaseModel):
    """Body for PATCH /auth/me — all fields optional"""
    full_name: str | None = Field(None, min_length=2, max_length=120)
    avatar_url: str | None = None
    username: str | None = Field(None, max_length=50)
    phone: str | None = Field(None, max_length=32)
    country: str | None = Field(None, max_length=80)
    recovery_email: EmailStr | None = None
    instagram_handle: str | None = Field(None, max_length=100)
    profile_public: bool | None = None


class ChangePasswordRequest(BaseModel):
    """Body for POST /auth/change-password"""
    old_password: str
    new_password: str = Field(..., min_length=8, max_length=100)


class DeleteAccountRequest(BaseModel):
    """Body for POST /auth/account/deactivate — irreversible soft-deactivate."""

    confirmation: str = Field(..., min_length=1, max_length=32)
    password: str | None = Field(None, max_length=100)


# ── Response schemas (output) ─────────────────────────────────────────────────

class UserOut(BaseModel):
    """Returned whenever user data is exposed. Never includes password."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str
    username: str | None = None
    phone: str | None = None
    whatsapp_number: str | None = None
    whatsapp_verified: bool = False
    country: str | None = None
    recovery_email: str | None = None
    instagram_handle: str | None = None
    avatar_url: str | None
    profile_picture: str | None = None
    google_sub: str | None = None
    is_active: bool
    is_verified: bool
    email_verified: bool
    profile_public: bool = True
    created_at: datetime
    updated_at: datetime
    profile_completion_filled: int = Field(
        0,
        ge=0,
        le=6,
        description=(
            "Count of filled profile fields: full_name, username, phone, "
            "avatar_url, country, recovery_email."
        ),
    )
    profile_completion_total: int = 6


def _recovery_email_counts(user: User) -> bool:
    raw = user.recovery_email
    if not raw or not str(raw).strip():
        return False
    s = str(raw).strip().lower()
    if s == str(user.email).strip().lower():
        return False
    return "@" in s


def build_user_out(user: User) -> UserOut:
    """Map ORM User to UserOut with profile completion counts (6 fields)."""
    filled = 0
    if user.full_name and len(user.full_name.strip()) >= 2:
        filled += 1
    if user.username and user.username.strip():
        filled += 1
    if user.phone and str(user.phone).strip():
        filled += 1
    if user.avatar_url:
        filled += 1
    if user.country and str(user.country).strip():
        filled += 1
    if _recovery_email_counts(user):
        filled += 1

    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        username=user.username,
        phone=user.phone,
        whatsapp_number=user.whatsapp_number,
        whatsapp_verified=bool(user.whatsapp_verified),
        country=user.country,
        recovery_email=user.recovery_email,
        instagram_handle=user.instagram_handle,
        avatar_url=user.avatar_url,
        profile_picture=user.profile_picture,
        google_sub=user.google_sub,
        is_active=user.is_active,
        is_verified=user.is_verified,
        email_verified=user.is_verified,
        profile_public=user.profile_public,
        created_at=user.created_at,
        updated_at=user.updated_at,
        profile_completion_filled=filled,
        profile_completion_total=6,
    )


class VerifyEmailRequest(BaseModel):
    """Body for POST /auth/verify-email"""

    token: str = Field(..., min_length=1)


class ResendVerificationPublicRequest(BaseModel):
    """Body for POST /auth/resend-verification"""

    email: EmailStr


class VerifyEmailSuccessResponse(BaseModel):
    message: str
    user: UserOut


class TokenResponse(BaseModel):
    """Returned on login and register."""
    model_config = ConfigDict(from_attributes=True)

    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class RegisterResponse(BaseModel):
    """Returned on successful registration — user data + token."""
    model_config = ConfigDict(from_attributes=True)

    user: UserOut
    token: TokenResponse
