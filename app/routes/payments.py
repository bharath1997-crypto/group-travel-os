"""
app/routes/payments.py — Stripe payment and webhook endpoints (Phase 4)
"""
import uuid
import logging
from typing import Any

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.stripe_service import StripeService
from app.utils.auth import get_current_user
from app.utils.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["Payments"])


class CreateCheckoutRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    price_id: str
    trip_id: uuid.UUID
    plan_type: str = "pass_3day"


@router.post(
    "/create-checkout",
    status_code=status.HTTP_200_OK,
    summary="Create a Stripe checkout session",
)
def create_checkout_session(
    payload: CreateCheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    checkout_url = StripeService.create_checkout_session(
        db=db,
        user_id=current_user.id,
        price_id=payload.price_id,
        trip_id=payload.trip_id,
        plan_type=payload.plan_type,
    )
    return {"checkout_url": checkout_url}


@router.post(
    "/webhook",
    status_code=status.HTTP_200_OK,
    summary="Stripe webhook handler",
)
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not sig_header:
        logger.warning("Webhook call missing stripe-signature header")
        return Response(status_code=status.HTTP_400_BAD_REQUEST)

    # Verify signature
    event = StripeService.verify_webhook(payload, sig_header)

    # Handle the event
    if event.type == "checkout.session.completed":
        session = event.data.object
        logger.info("Stripe checkout.session.completed event received for session: %s", session.id)
        StripeService.handle_payment_success(db, session)

    return {"status": "success"}


@router.get(
    "/live-access/{trip_id}",
    status_code=status.HTTP_200_OK,
    summary="Check if current user has live access for a trip",
)
def check_live_access(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, bool]:
    has_access = StripeService.check_live_access(
        db=db,
        user_id=current_user.id,
        trip_id=trip_id,
    )
    return {"has_access": has_access}
