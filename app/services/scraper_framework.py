import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.scraper_health import ScraperHealth

logger = logging.getLogger(__name__)

MAX_CONSECUTIVE_FAILURES = 3
BLOCK_DURATION_HOURS = 24

class ScraperFramework:

    @staticmethod
    def get_or_create_health(
        db: Session,
        provider: str
    ) -> ScraperHealth:
        stmt = select(ScraperHealth).where(
            ScraperHealth.provider == provider
        )
        health = db.execute(stmt)\
            .scalar_one_or_none()
        if not health:
            health = ScraperHealth(
                provider=provider,
                status='healthy',
                consecutive_failures=0,
                is_enabled=True
            )
            db.add(health)
            db.flush()
        return health

    @staticmethod
    def is_provider_available(
        db: Session,
        provider: str
    ) -> bool:
        health = ScraperFramework\
            .get_or_create_health(db, provider)

        if not health.is_enabled:
            logger.warning(
                f"{provider} is disabled"
            )
            return False

        if health.blocked_until:
            if datetime.utcnow() < \
                    health.blocked_until:
                logger.warning(
                    f"{provider} blocked until "
                    f"{health.blocked_until}"
                )
                return False
            else:
                # Block expired — reset
                health.blocked_until = None
                health.status = 'healthy'
                health.consecutive_failures = 0
                db.flush()

        return True

    @staticmethod
    def record_success(
        db: Session,
        provider: str,
        events_count: int
    ):
        health = ScraperFramework\
            .get_or_create_health(db, provider)
        now = datetime.utcnow()
        health.status = 'healthy'
        health.last_success_at = now
        health.consecutive_failures = 0
        health.events_fetched_today = \
            (health.events_fetched_today or 0) \
            + events_count
        health.updated_at = now
        db.flush()
        logger.info(
            f"{provider} success: "
            f"{events_count} events fetched"
        )

    @staticmethod
    def record_failure(
        db: Session,
        provider: str,
        error: str,
        is_block: bool = False
    ):
        health = ScraperFramework\
            .get_or_create_health(db, provider)
        now = datetime.utcnow()
        health.last_failure_at = now
        health.last_error = str(error)[:500]
        health.consecutive_failures = \
            (health.consecutive_failures or 0) + 1
        health.updated_at = now

        if is_block or health\
                .consecutive_failures >= \
                MAX_CONSECUTIVE_FAILURES:
            health.status = 'blocked'
            health.blocked_until = now + \
                timedelta(hours=BLOCK_DURATION_HOURS)
            logger.error(
                f"{provider} BLOCKED until "
                f"{health.blocked_until}. "
                f"Error: {error}"
            )
        else:
            health.status = 'degraded'
            logger.warning(
                f"{provider} failure "
                f"({health.consecutive_failures}"
                f"/{MAX_CONSECUTIVE_FAILURES}): "
                f"{error}"
            )
        db.flush()

    @staticmethod
    def reset_daily_counts(db: Session):
        db.execute(
            ScraperHealth.__table__.update()
            .values(events_fetched_today=0)
        )
        db.flush()
