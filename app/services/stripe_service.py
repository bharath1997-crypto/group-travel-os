"""
app/services/stripe_service.py — Stripe billing and access check service (Phase 4)
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta

import stripe
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.subscription import Subscription
from app.utils.exceptions import AppException
from config import settings

logger = logging.getLogger(__name__)

stripe.api_key = settings.stripe_secret_key


class StripeService:

    @staticmethod
    def create_checkout_session(
        db: Session,
        user_id: uuid.UUID,
        price_id: str,
        trip_id: uuid.UUID,
        plan_type: str = "pass_3day",
    ) -> str:
        """Create a Stripe checkout session for a day pass or subscription."""
        if not settings.stripe_secret_key:
            logger.error("STRIPE_SECRET_KEY is not configured")
            AppException.internal("Billing system is misconfigured")

        # Determine mode (pass is a one-time payment, subscription is recurring)
        is_subscription = plan_type in ("pro", "group")
        mode = "subscription" if is_subscription else "payment"

        try:
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                mode=mode,
                line_items=[
                    {
                        "price": price_id,
                        "quantity": 1,
                    }
                ],
                success_url=f"{settings.frontend_url}/trip-live/{trip_id}?success=true",
                cancel_url=f"{settings.frontend_url}/trip-live/{trip_id}?canceled=true",
                metadata={
                    "user_id": str(user_id),
                    "trip_id": str(trip_id),
                    "price_id": price_id,
                    "plan_type": plan_type,
                },
            )
            return session.url
        except Exception as exc:
            logger.error("Stripe session creation failed: %s", exc)
            AppException.bad_request(f"Stripe session creation failed: {exc}")

    @staticmethod
    def verify_webhook(payload: bytes, sig_header: str) -> stripe.Event:
        """Verify the Stripe webhook signature."""
        if not settings.stripe_webhook_secret:
            logger.error("STRIPE_WEBHOOK_SECRET is not configured")
            AppException.internal_server_error("Webhook configuration error")

        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.stripe_webhook_secret
            )
            return event
        except ValueError as exc:
            logger.warning("Invalid webhook payload: %s", exc)
            AppException.bad_request("Invalid payload")
        except stripe.error.SignatureVerificationError as exc:
            logger.warning("Invalid webhook signature: %s", exc)
            AppException.bad_request("Invalid signature")

    @staticmethod
    def handle_payment_success(db: Session, session: dict) -> Subscription:
        """Handle checkout.session.completed event and create/update subscription in DB."""
        metadata = session.get("metadata", {})
        user_id_str = metadata.get("user_id")
        trip_id_str = metadata.get("trip_id")
        plan_type = metadata.get("plan_type", "pass_3day")
        price_id = metadata.get("price_id")

        if not user_id_str or not trip_id_str:
            logger.error("Stripe session metadata missing user_id or trip_id")
            AppException.bad_request("Missing user_id or trip_id in metadata")

        try:
            user_id = uuid.UUID(user_id_str)
            trip_id = uuid.UUID(trip_id_str)
        except ValueError as exc:
            logger.error("Invalid UUID format in Stripe metadata: %s", exc)
            AppException.bad_request("Invalid UUID format in metadata")

        now = datetime.now(timezone.utc)

        # Calculate expiration based on plan_type
        if plan_type == "pass_3day":
            expires_at = now + timedelta(days=3)
        elif plan_type == "pass_7day":
            expires_at = now + timedelta(days=7)
        elif plan_type == "pass_14day":
            expires_at = now + timedelta(days=14)
        elif plan_type == "pro":
            expires_at = now + timedelta(days=30)
        else:
            expires_at = now + timedelta(days=3)  # default fallback

        subscription = Subscription(
            id=uuid.uuid4(),
            user_id=user_id,
            trip_id=trip_id,
            plan=plan_type,
            plan_type=plan_type,
            status="active",
            stripe_customer_id=session.get("customer"),
            stripe_subscription_id=session.get("subscription"),
            expires_at=expires_at,
            created_at=now,
        )

        db.add(subscription)
        try:
            db.commit()
            db.refresh(subscription)
        except Exception as exc:
            db.rollback()
            logger.error("Failed to commit stripe subscription: %s", exc)
            AppException.internal("Could not save subscription")

        return subscription

    @staticmethod
    def check_live_access(db: Session, user_id: uuid.UUID, trip_id: uuid.UUID) -> bool:
        """Check if user has an active, non-expired subscription for the given trip."""
        now = datetime.now(timezone.utc)

        # SQLAlchemy 2.0 style select
        stmt = select(Subscription).where(
            Subscription.user_id == user_id,
            Subscription.trip_id == trip_id,
            Subscription.status == "active",
        )
        subs = db.execute(stmt).scalars().all()

        for sub in subs:
            if sub.expires_at is None:
                return True
            # Handle naive datetime comparisons
            expires_at = sub.expires_at
            if expires_at.tzinfo is None:
                now_naive = now.replace(tzinfo=None)
                if expires_at > now_naive:
                    return True
            else:
                if expires_at > now:
                    return True

        return False
