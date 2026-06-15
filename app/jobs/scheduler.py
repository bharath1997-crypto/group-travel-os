"""
app/jobs/scheduler.py — APScheduler BackgroundScheduler wiring
"""
from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.jobs.deal_scan_job import run_weekly_scan_job
from app.jobs.feed_refresh import auto_close_expired_polls, recalculate_trending_scores
from app.jobs.daily_events_fetch import run_daily_events_fetch
from app.jobs.eventbrite_sync import run_eventbrite_sync_sync
from app.jobs.foursquare_fetch import run_foursquare_fetch
from app.jobs.osm_fetch import run_osm_fetch
from app.jobs.experience_purge import run_experience_purge
from app.jobs.stubhub_sync import run_stubhub_sync_sync
from app.jobs.seatgeek_sync import run_seatgeek_sync_sync

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def start_scheduler() -> None:
    scheduler.add_job(
        run_experience_purge,
        "cron",
        hour=1,
        minute=0,
        id="experience_purge",
        replace_existing=True,
    )
    scheduler.add_job(
        recalculate_trending_scores,
        "interval",
        weeks=1,
        id="trending_refresh",
        replace_existing=True,
    )
    scheduler.add_job(
        auto_close_expired_polls,
        "interval",
        hours=1,
        id="poll_auto_close",
        replace_existing=True,
    )
    scheduler.add_job(
        run_weekly_scan_job,
        trigger=IntervalTrigger(weeks=1),
        id="flight_deal_scan",
        replace_existing=True,
    )
    scheduler.add_job(
        run_daily_events_fetch,
        "cron",
        hour=2,
        minute=0,
        id="daily_events_fetch",
        replace_existing=True,
    )
    scheduler.add_job(
        run_eventbrite_sync_sync,
        "cron",
        hour=2,
        minute=15,
        id="eventbrite_sync",
        replace_existing=True,
    )
    scheduler.add_job(
        run_foursquare_fetch,
        "cron",
        day_of_week="sun",
        hour=2,
        minute=30,
        id="foursquare_weekly_fetch",
        replace_existing=True,
    )
    scheduler.add_job(
        run_osm_fetch,
        "cron",
        day_of_week="sun",
        hour=3,
        minute=0,
        id="osm_weekly_fetch",
        replace_existing=True,
    )
    scheduler.add_job(
        run_stubhub_sync_sync,
        "cron",
        hour=4,
        minute=0,
        id="stubhub_sync",
        replace_existing=True,
    )
    scheduler.add_job(
        run_seatgeek_sync_sync,
        "cron",
        hour=4,
        minute=15,
        id="seatgeek_sync",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started — 10 jobs registered")




def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")
