"""
app/services/auth_service.py — Authentication business logic

Rules:
- Session is always injected — never created here
- All errors raised via AppException
- Never return raw SQLAlchemy errors to the caller
"""
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.auth import UserCreate, UserUpdate, ChangePasswordRequest
from app.utils.auth import hash_password, verify_password, create_access_token
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)


class AuthService:

    @staticmethod
    def register(db: Session, data: UserCreate) -> tuple[User, str, int]:
        """
        Creates a new user account.
        Raises 409 if email already registered.
        Returns (user, access_token, expires_in).
        """
        existing = db.execute(
            select(User).where(User.email == data.email.lower())
        ).scalar_one_or_none()

        if existing:
            AppException.conflict("An account with this email already exists")

        username_to_store: str | None = None
        if data.username is not None:
            stripped = data.username.strip()
            if stripped:
                username_to_store = stripped
                taken = db.execute(
                    select(User).where(User.username == username_to_store)
                ).scalar_one_or_none()
                if taken:
                    AppException.conflict("Username already taken")

        user = User(
            email=data.email.lower(),
            hashed_password=hash_password(data.password),
            full_name=data.full_name,
            username=username_to_store,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        token, expires_in = create_access_token(user.id)
        logger.info("New user registered: %s", user.email)
        return user, token, expires_in

    @staticmethod
    def login(db: Session, email: str, password: str) -> tuple[User, str, int]:
        """
        Authenticates a user with email and password.
        Raises 401 for any failure — never reveal which field is wrong.
        Returns (user, access_token, expires_in).
        """
        user = db.execute(
            select(User).where(User.email == email.lower())
        ).scalar_one_or_none()

        # Same error for wrong email OR wrong password — prevents user enumeration
        if not user or not verify_password(password, user.hashed_password):
            AppException.unauthorized("Invalid email or password")

        if not user.is_active:
            AppException.forbidden("Your account has been deactivated")

        token, expires_in = create_access_token(user.id)
        logger.info("User logged in: %s", user.email)
        return user, token, expires_in

    @staticmethod
    def get_profile(user: User) -> User:
        """Returns the current user. No DB query needed — user already loaded."""
        return user

    @staticmethod
    def update_profile(db: Session, user: User, data: UserUpdate) -> User:
        """Updates full_name and/or avatar_url on the current user."""
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(user, field, value)

        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def change_password(
        db: Session, user: User, data: ChangePasswordRequest
    ) -> None:
        """
        Changes the user's password.
        Raises 401 if old_password is wrong.
        """
        if not verify_password(data.old_password, user.hashed_password):
            AppException.unauthorized("Current password is incorrect")

        user.hashed_password = hash_password(data.new_password)
        db.commit()
        logger.info("Password changed for user: %s", user.email)
