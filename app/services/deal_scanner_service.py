"""
Weekly Kiwi deal scan → FCM alerts for subscribed users.

All Kiwi access goes through FlightService; scheduler job never raises uncaught exceptions.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.flight_service import FlightService
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

_DEFAULT_THRESHOLD_USD = 300.0
_DEAL_NOTIFICATION_TYPE = "flight_deal"


class DealScannerService:
    """Proactive scans for fares under each user’s threshold."""

    def scan_deals_for_user(self, db: Session, user: User) -> int:
        if not user.deal_alerts_enabled:
            return 0
        ap = user.home_airport
        if not ap or not str(ap).strip():
            return 0

        threshold = (
            float(user.deal_price_threshold)
            if user.deal_price_threshold is not None
            else _DEFAULT_THRESHOLD_USD
        )

        today = datetime.now(timezone.utc).date()
        start = today + timedelta(days=7)
        end = today + timedelta(days=90)

        try:
            flights = FlightService.search_flights(
                fly_from=str(user.home_airport),
                fly_to="anywhere",
                date_from=start,
                date_to=end,
                adults=1,
                currency="USD",
                cabins="M",
                return_from=None,
                return_to=None,
            )
        except HTTPException as exc:
            logger.warning(
                "Deal scan FlightService error user=%s: %s", user.id, exc.detail,
            )
            return 0
        except ValueError as exc:
            logger.warning(
                "Deal scan validation error user=%s: %s", user.id, exc,
            )
            return 0

        deals = [f for f in flights if f.price <= threshold]
        if not deals:
            return 0

        cheapest_price = min(f.price for f in deals)
        if abs(cheapest_price - round(cheapest_price)) < 0.005:
            price_txt = str(int(round(cheapest_price)))
        else:
            price_txt = f"{cheapest_price:.2f}"
        airport = str(user.home_airport).strip().upper()
        title = "✈️ Flight Deal Alert"
        body = f"Flights from {airport} from ${price_txt}!"
        try:
            NotificationService.create_notification(
                db,
                user_id=user.id,
                notif_type=_DEAL_NOTIFICATION_TYPE,
                title=title,
                body=body,
                data={"deeplink_flights": "1"},
            )
        except Exception as exc:
            logger.warning(
                "Deal notification failed user=%s: %s",
                user.id,
                exc,
            )

        return len(deals)

    def run_weekly_scan(self, db: Session) -> None:
        try:
            stmt = select(User).where(
                User.deal_alerts_enabled.is_(True),
                User.home_airport.is_not(None),
                User.is_active.is_(True),
            )
            subscribers = db.execute(stmt).scalars().all()
            users_n = len(subscribers)
            deals_total = 0
            for user in subscribers:
                try:
                    deals_total += max(0, self.scan_deals_for_user(db, user))
                except (
                    HTTPException,
                    ValueError,
                    KeyError,
                    OSError,
                    RuntimeError,
                ) as exc:
                    logger.warning(
                        "scan_deals_for_user soft-fail user=%s: %s",
                        user.id,
                        exc,
                    )
                except Exception as exc:
                    logger.warning(
                        "scan_deals_for_user unexpected user=%s: %s",
                        user.id,
                        exc,
                    )

            logger.info(
                "Deal weekly scan finished: users=%s deals_found=%s",
                users_n,
                deals_total,
            )
        except Exception:
            logger.exception("run_weekly_scan aborted")
