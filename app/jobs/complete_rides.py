"""Mark departed rides completed and emit split entries."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.models.seats import Ride, RideBooking
from app.services.seats_service import SeatsService
from app.utils.database import SessionLocal

logger = logging.getLogger(__name__)


def run_complete_rides() -> None:
    db = SessionLocal()
    now = datetime.now(timezone.utc)
    try:
        rides = db.execute(
            select(Ride).where(
                Ride.status.in_(("open", "full", "departed")),
                Ride.arrive_est_at.is_not(None),
                Ride.arrive_est_at < now,
            )
        ).scalars().all()

        for ride in rides:
            ride.status = "completed"
            bookings = db.execute(
                select(RideBooking).where(
                    RideBooking.ride_id == ride.id,
                    RideBooking.status == "confirmed",
                )
            ).scalars().all()
            for b in bookings:
                b.status = "completed"
                SeatsService.emit_split_on_complete(db, b.id)

        db.commit()
    except Exception:
        logger.exception("complete_rides failed")
        db.rollback()
    finally:
        db.close()
