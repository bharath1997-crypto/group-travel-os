"""Scheduled cleanup of expired live report chat nodes in Firebase RTDB."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.models.road_report import RoadReport
from app.utils.database import SessionLocal
from app.utils.firebase import delete_rtdb

logger = logging.getLogger(__name__)


def cleanup_expired_report_chats() -> None:
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        expired_ids = db.execute(
            select(RoadReport.id).where(
                RoadReport.expires_at < now,
                RoadReport.is_active.is_(False),
            )
        ).scalars().all()
        for report_id in expired_ids:
            try:
                delete_rtdb(f"live_reports/{report_id}/chat")
            except Exception as exc:
                logger.debug("Failed to delete chat for report %s: %s", report_id, exc)
    finally:
        db.close()
