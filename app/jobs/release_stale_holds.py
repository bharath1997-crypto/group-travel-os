"""Expire held seat bookings and release seats."""
from __future__ import annotations

import logging

from app.services.seats_booking_service import release_stale_holds
from app.utils.database import SessionLocal

logger = logging.getLogger(__name__)


def run_release_stale_holds() -> None:
    db = SessionLocal()
    try:
        n = release_stale_holds(db)
        if n:
            logger.info("Released %s stale seat holds", n)
    except Exception:
        logger.exception("release_stale_holds failed")
        db.rollback()
    finally:
        db.close()
