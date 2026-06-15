"""
Unit tests for Stripe checkout, webhook, and live-access checking.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.models.subscription import Subscription
from app.services.stripe_service import StripeService
from tests.conftest import exec_result


def test_check_live_access_no_subscription(db):
    user_id = uuid.uuid4()
    trip_id = uuid.uuid4()
    
    # Mock no active subscription found
    db.execute.return_value = exec_result(scalars_all=[])
    
    has_access = StripeService.check_live_access(db, user_id, trip_id)
    assert has_access is False


def test_check_live_access_active_subscription(db):
    user_id = uuid.uuid4()
    trip_id = uuid.uuid4()
    
    # Active subscription with expiration in future
    sub = Subscription(
        id=uuid.uuid4(),
        user_id=user_id,
        trip_id=trip_id,
        status="active",
        expires_at=datetime.now(timezone.utc) + timedelta(days=2),
    )
    db.execute.return_value = exec_result(scalars_all=[sub])
    
    has_access = StripeService.check_live_access(db, user_id, trip_id)
    assert has_access is True


def test_check_live_access_expired_subscription(db):
    user_id = uuid.uuid4()
    trip_id = uuid.uuid4()
    
    # Subscription status active but expired
    sub = Subscription(
        id=uuid.uuid4(),
        user_id=user_id,
        trip_id=trip_id,
        status="active",
        expires_at=datetime.now(timezone.utc) - timedelta(days=1),
    )
    db.execute.return_value = exec_result(scalars_all=[sub])
    
    has_access = StripeService.check_live_access(db, user_id, trip_id)
    assert has_access is False


@patch("stripe.checkout.Session.create")
def test_create_checkout_session_success(mock_stripe_create, db):
    user_id = uuid.uuid4()
    trip_id = uuid.uuid4()
    
    from config import settings
    with patch.object(settings, "stripe_secret_key", "sk_test_mockkey"):
        mock_session = MagicMock()
        mock_session.url = "https://checkout.stripe.com/test_session"
        mock_stripe_create.return_value = mock_session
        
        url = StripeService.create_checkout_session(
            db=db,
            user_id=user_id,
            price_id="price_123",
            trip_id=trip_id,
            plan_type="pass_3day"
        )
        
        assert url == "https://checkout.stripe.com/test_session"
        mock_stripe_create.assert_called_once()


def test_handle_payment_success_commits_subscription(db):
    session_data = {
        "customer": "cus_123",
        "subscription": "sub_123",
        "metadata": {
            "user_id": str(uuid.uuid4()),
            "trip_id": str(uuid.uuid4()),
            "price_id": "price_123",
            "plan_type": "pass_3day"
        }
    }
    
    sub = StripeService.handle_payment_success(db, session_data)
    
    assert sub.stripe_customer_id == "cus_123"
    assert sub.plan == "pass_3day"
    db.add.assert_called_once()
    db.commit.assert_called_once()
