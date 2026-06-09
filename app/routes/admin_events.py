"""
app/routes/admin_events.py — Admin endpoints for event migration and scraper health.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.scraper_health import ScraperHealth
from app.services.ticketmaster_migration_service \
    import migrate_ticketmaster_to_unified
from app.utils.auth import get_current_user
from app.utils.database import get_db
from app.utils.exceptions import AppException

router = APIRouter(prefix="/admin", tags=["Admin Events"])


def _require_admin(current_user) -> None:
    if not current_user.is_admin:
        AppException.forbidden("Admin privileges required")


@router.post("/events/dry-run")
async def dry_run_migration(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_admin(current_user)
    result = await \
        migrate_ticketmaster_to_unified(
            db=db,
            north_america_only=True,
            dry_run=True
        )
    return result


@router.post("/events/migrate")
async def run_migration(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _require_admin(current_user)
    result = await \
        migrate_ticketmaster_to_unified(
            db=db,
            north_america_only=True,
            dry_run=False
        )
    return result


@router.get("/scrapers/health")
async def scraper_health(
    db: Session = Depends(get_db),
):
    rows = db.execute(select(ScraperHealth)).scalars().all()
    return {
        "scrapers": [
            {
                "provider": h.provider,
                "status": h.status,
                "last_success": (
                    h.last_success_at.isoformat()
                    if h.last_success_at else None
                ),
                "consecutive_failures": h.consecutive_failures or 0,
                "events_today": h.events_fetched_today or 0,
                "is_enabled": h.is_enabled,
                "blocked_until": (
                    h.blocked_until.isoformat()
                    if h.blocked_until else None
                ),
            }
            for h in rows
        ]
    }
