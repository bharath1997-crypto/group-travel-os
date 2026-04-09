"""
app/utils/feature_gate.py — Subscription-based feature access (Phase 3)

Usage:
    _: User = Depends(require_plan("pass_3day"))
"""
from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.subscription_service import SubscriptionService
from app.utils.auth import get_current_user
from app.utils.database import get_db
from app.utils.exceptions import AppException


def require_plan(minimum_plan: str) -> Callable[..., User]:
    """FastAPI dependency: ensures current user has at least ``minimum_plan``."""

    def _check(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
    ) -> User:
        if not SubscriptionService.check_feature_access(
            db, current_user.id, minimum_plan
        ):
            AppException.payment_required(
                f"This feature requires the {minimum_plan} plan or higher",
            )
        return current_user

    return _check
