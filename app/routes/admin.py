"""
app/routes/admin.py — Administration routes for system operations.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.jobs.daily_events_fetch import run_daily_events_fetch
from app.jobs.foursquare_fetch import request_foursquare_fetch_cancel, run_foursquare_fetch
from app.jobs.job_control import foursquare_job, osm_job
from app.jobs.osm_fetch import request_osm_fetch_cancel, run_osm_fetch
from app.services.ticketmaster_migration_service \
    import migrate_ticketmaster_to_unified
from app.utils.auth import get_current_user
from app.utils.database import get_db
from app.utils.exceptions import AppException

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


@router.post("/trigger-foursquare-fetch")
def trigger_foursquare_fetch(background_tasks: BackgroundTasks):
    """Trigger the weekly Foursquare bulk fetch job manually."""
    if foursquare_job.is_running:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "status": "running",
                "message": "Foursquare fetch is already running. POST /admin/cancel-foursquare-fetch to stop it.",
            },
        )

    logger.info("Manual Foursquare fetch job triggered via admin endpoint")
    background_tasks.add_task(run_foursquare_fetch)
    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={"status": "success", "message": "Foursquare fetch triggered"},
    )


@router.post("/cancel-foursquare-fetch", status_code=status.HTTP_202_ACCEPTED)
def cancel_foursquare_fetch() -> dict[str, str]:
    """Request cooperative cancellation of a running Foursquare fetch."""
    if not foursquare_job.is_running:
        return {"status": "idle", "message": "No Foursquare fetch is running."}

    request_foursquare_fetch_cancel()
    logger.info("Foursquare fetch cancellation requested")
    return {"status": "success", "message": "Foursquare fetch cancellation requested."}


@router.post("/trigger-osm-fetch")
def trigger_osm_fetch(background_tasks: BackgroundTasks):
    """Trigger the weekly OSM bulk fetch job manually."""
    if osm_job.is_running:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "status": "running",
                "message": "OSM fetch is already running. POST /admin/cancel-osm-fetch to stop it.",
            },
        )

    logger.info("Manual OSM fetch job triggered via admin endpoint")
    background_tasks.add_task(run_osm_fetch)
    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={"status": "success", "message": "OSM fetch triggered"},
    )


@router.post("/cancel-osm-fetch", status_code=status.HTTP_202_ACCEPTED)
def cancel_osm_fetch() -> dict[str, str]:
    """Request cooperative cancellation of a running OSM fetch."""
    if not osm_job.is_running:
        return {"status": "idle", "message": "No OSM fetch is running."}

    request_osm_fetch_cancel()
    logger.info("OSM fetch cancellation requested")
    return {"status": "success", "message": "OSM fetch cancellation requested."}


@router.post("/migrate-events")
async def run_migration(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not current_user.is_admin:
        AppException.forbidden("Admin privileges required")
    result = await migrate_ticketmaster_to_unified(
        db=db,
        north_america_only=True
    )
    return result
