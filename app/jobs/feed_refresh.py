"""
app/jobs/feed_refresh.py — Scheduled maintenance for feed and polls

Each job opens its own SessionLocal session; no FastAPI Depends.
"""
from __future__ import annotations

import logging
import random
from datetime import datetime, timezone

from sqlalchemy import select

from app.models.destination import Destination
from app.models.poll import Poll, PollStatus
from app.utils.database import SessionLocal

logger = logging.getLogger(__name__)


def recalculate_trending_scores() -> None:
    session = SessionLocal()
    try:
        rows = list(session.execute(select(Destination)).scalars().all())
        for dest in rows:
            dest.trending_score = round(random.uniform(20.0, 95.0), 2)
        session.commit()
        logger.info("Trending scores recalculated for %s destinations", len(rows))
    except Exception:
        session.rollback()
        logger.exception("recalculate_trending_scores failed")
        raise
    finally:
        session.close()


def auto_close_expired_polls() -> None:
    session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        stmt = select(Poll).where(
            Poll.status == PollStatus.open,
            Poll.closes_at < now,
        )
        polls = list(session.execute(stmt).scalars().all())
        for poll in polls:
            poll.status = PollStatus.closed
        session.commit()
        logger.info("Auto-closed %s expired polls", len(polls))
    except Exception:
        session.rollback()
        logger.exception("auto_close_expired_polls failed")
        raise
    finally:
        session.close()
