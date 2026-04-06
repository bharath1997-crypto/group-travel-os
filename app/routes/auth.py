"""
app/routes/auth.py — Authentication endpoints

Routes are thin. Every route does exactly three things:
1. Accept the request
2. Call the service
3. Return the response

No business logic here.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

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
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
def register(data: UserCreate, db: Session = Depends(get_db)):
    user, token, expires_in = AuthService.register(db, data)
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
