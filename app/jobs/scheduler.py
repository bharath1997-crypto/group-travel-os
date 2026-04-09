"""
app/jobs/scheduler.py — APScheduler BackgroundScheduler wiring
"""
from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.jobs.feed_refresh import auto_close_expired_polls, recalculate_trending_scores

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def start_scheduler() -> None:
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
    scheduler.start()
    logger.info("Scheduler started — 2 jobs registered")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")
