"""
app/routes/subscriptions.py — Subscription plan (Phase 3, stub billing)
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.subscription_service import SubscriptionService
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


class PlanOut(BaseModel):
    plan: str
    status: str
    current_period_end: str | None


class UpgradeRequest(BaseModel):
    new_plan: str


@router.get("/me", response_model=PlanOut, summary="Current subscription plan")
def get_my_plan(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return SubscriptionService.get_current_plan(db, current_user.id)


@router.post("/upgrade", response_model=PlanOut, summary="Upgrade subscription plan (stub)")
def upgrade_plan(
    body: UpgradeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    SubscriptionService.upgrade_plan(db, current_user.id, body.new_plan)
    return SubscriptionService.get_current_plan(db, current_user.id)


@router.post("/cancel", response_model=PlanOut, summary="Cancel subscription (stub)")
def cancel_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    SubscriptionService.cancel_subscription(db, current_user.id)
    return SubscriptionService.get_current_plan(db, current_user.id)
