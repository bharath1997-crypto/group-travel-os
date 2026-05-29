"""
app/routes/admin.py — Administration routes for system operations.
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, BackgroundTasks, status

from app.jobs.daily_events_fetch import run_daily_events_fetch

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post("/trigger-daily-fetch", status_code=status.HTTP_202_ACCEPTED)
def trigger_daily_fetch(background_tasks: BackgroundTasks) -> dict[str, str]:
    """
    Trigger the daily Ticketmaster bulk fetch job manually.
    Runs asynchronously in a background task to prevent request timeout.
    """
    logger.info("Manual daily events fetch job triggered via admin endpoint")
    background_tasks.add_task(run_daily_events_fetch)
    return {
        "status": "success",
        "message": "Daily Ticketmaster events fetch job triggered in the background.",
    }
