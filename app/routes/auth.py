"""
app/routes/auth.py — Authentication endpoints

Routes are thin. Every route does exactly three things:
1. Accept the request
2. Call the service
3. Return the response

No business logic here.
"""
import logging
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from config import settings

from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    RegisterResponse,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserOut,
    UserUpdate,
)
from app.services.auth_service import AuthService
from app.services.oauth_service import (
    complete_facebook,
    complete_google,
    facebook_authorize_url,
    google_authorize_url,
    verify_oauth_state,
)
from app.utils.auth import get_current_user
from app.utils.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])


def _frontend() -> str:
    return settings.FRONTEND_URL.rstrip("/")


@router.get("/oauth/google/start", summary="Redirect to Google OAuth")
def oauth_google_start():
    return RedirectResponse(
        google_authorize_url(),
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
        verify_oauth_state(state, "google")
        _user, token, exp = complete_google(db, code)
    except HTTPException as e:
        return RedirectResponse(
            f"{fe}/auth/callback?oauth_error={quote(str(e.detail))}"
        )
    except Exception:
        logger.exception("Google OAuth callback failed")
        return RedirectResponse(f"{fe}/auth/callback?oauth_error=server")
    return RedirectResponse(
        f"{fe}/auth/callback?access_token={quote(token)}&expires_in={int(exp)}",
        status_code=status.HTTP_302_FOUND,
    )


@router.get("/oauth/facebook/start", summary="Redirect to Facebook OAuth")
def oauth_facebook_start():
    return RedirectResponse(
        facebook_authorize_url(),
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
        verify_oauth_state(state, "facebook")
        _user, token, exp = complete_facebook(db, code)
    except HTTPException as e:
        return RedirectResponse(
            f"{fe}/auth/callback?oauth_error={quote(str(e.detail))}"
        )
    except Exception:
        logger.exception("Facebook OAuth callback failed")
        return RedirectResponse(f"{fe}/auth/callback?oauth_error=server")
    return RedirectResponse(
        f"{fe}/auth/callback?access_token={quote(token)}&expires_in={int(exp)}",
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
        user=UserOut.model_validate(user),
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
        user=UserOut.model_validate(user),
        token=TokenResponse(access_token=token, expires_in=expires_in),
    )


@router.get(
    "/me",
    response_model=UserOut,
    summary="Get current user profile",
)
def get_me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(AuthService.get_profile(current_user))


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
    return UserOut.model_validate(user)


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
