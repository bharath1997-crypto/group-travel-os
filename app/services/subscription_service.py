"""
app/services/subscription_service.py — Subscription plans (Phase 3, stub billing)

Session is always injected — never created here.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.subscription import Subscription
from app.utils.exceptions import AppException

_PLAN_RANK: dict[str, int] = {
    "free": 0,
    "pass_3day": 1,
    "pass_7day": 2,
    "pro": 3,
    "enterprise": 4,
}

_ALLOWED_PLANS: frozenset[str] = frozenset(_PLAN_RANK.keys())

_REQUIRED_FOR_FEATURES: frozenset[str] = frozenset(
    ("pass_3day", "pass_7day", "pro", "enterprise"),
)


class SubscriptionService:
    @staticmethod
    def get_or_create_subscription(db: Session, user_id: uuid.UUID) -> Subscription:
        row = db.execute(
            select(Subscription).where(Subscription.user_id == user_id),
        ).scalar_one_or_none()
        if row is None:
            row = Subscription(user_id=user_id, plan="free", status="active")
            db.add(row)
            db.commit()
            db.refresh(row)
        return row

    @staticmethod
    def get_current_plan(db: Session, user_id: uuid.UUID) -> dict:
        sub = SubscriptionService.get_or_create_subscription(db, user_id)
        end = sub.current_period_end
        end_iso: str | None = end.isoformat() if end is not None else None
        return {
            "plan": sub.plan,
            "status": sub.status,
            "current_period_end": end_iso,
        }

    @staticmethod
    def check_feature_access(db: Session, user_id: uuid.UUID, required_plan: str) -> bool:
        if required_plan not in _REQUIRED_FOR_FEATURES:
            return False
        sub = SubscriptionService.get_or_create_subscription(db, user_id)
        if sub.status not in ("active", "past_due"):
            return False
        have = _PLAN_RANK.get(sub.plan, -1)
        need = _PLAN_RANK[required_plan]
        return have >= need

    @staticmethod
    def upgrade_plan(db: Session, user_id: uuid.UUID, new_plan: str) -> Subscription:
        if new_plan not in _ALLOWED_PLANS:
            AppException.bad_request("Invalid plan")

        sub = SubscriptionService.get_or_create_subscription(db, user_id)
        now = datetime.now(timezone.utc)

        sub.plan = new_plan
        sub.status = "active"

        if new_plan == "pass_3day":
            sub.current_period_end = now + timedelta(days=3)
        elif new_plan == "pass_7day":
            sub.current_period_end = now + timedelta(days=7)
        else:
            sub.current_period_end = None

        db.commit()
        db.refresh(sub)
        return sub

    @staticmethod
    def cancel_subscription(db: Session, user_id: uuid.UUID) -> Subscription:
        sub = SubscriptionService.get_or_create_subscription(db, user_id)
        sub.status = "cancelled"
        sub.plan = "free"
        sub.current_period_end = None
        db.commit()
        db.refresh(sub)
        return sub
