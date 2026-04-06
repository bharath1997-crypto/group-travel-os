"""
app/schemas/auth.py — Auth request and response schemas

Rules:
- Never include hashed_password in any response schema
- All response schemas use model_config = ConfigDict(from_attributes=True)
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ── Request schemas (input) ───────────────────────────────────────────────────

class UserCreate(BaseModel):
    """Body for POST /auth/register"""
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    full_name: str = Field(..., min_length=2, max_length=120)


class UserLogin(BaseModel):
    """Body for POST /auth/login"""
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    """Body for PATCH /auth/me — all fields optional"""
    full_name: str | None = Field(None, min_length=2, max_length=120)
    avatar_url: str | None = None


class ChangePasswordRequest(BaseModel):
    """Body for POST /auth/change-password"""
    old_password: str
    new_password: str = Field(..., min_length=8, max_length=100)


# ── Response schemas (output) ─────────────────────────────────────────────────

class UserOut(BaseModel):
    """Returned whenever user data is exposed. Never includes password."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str
    avatar_url: str | None
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime


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
