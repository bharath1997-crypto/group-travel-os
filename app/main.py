"""
app/main.py — FastAPI application factory

Creates and configures the FastAPI app instance.
All middleware, routers, and startup logic lives here.

Import the app instance via: from app.main import app
"""
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.utils.database import check_db_connection, get_db
from app.utils.db_diagnostics import collect_db_diagnostics, dev_diagnostics_enabled
from app.utils.exceptions import AppException
from config import settings

logger = logging.getLogger(__name__)


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs on startup (before yield) and shutdown (after yield).
    Use for: verifying connections, warming caches, graceful teardown.
    """
    # ── Startup ───────────────────────────────────────────────────────────────
    logger.info("Starting %s v%s [%s]", settings.APP_NAME, settings.APP_VERSION, settings.ENVIRONMENT)

    db_ok = check_db_connection()
    if db_ok:
        logger.info("Database connection verified")
        from app.services.scraper_framework import ScraperFramework
        from app.utils.database import SessionLocal

        _health_db = SessionLocal()
        try:
            ScraperFramework.get_or_create_health(_health_db, "viator")
            ScraperFramework.get_or_create_health(_health_db, "eventbrite")
            ScraperFramework.get_or_create_health(_health_db, "purge")
            ScraperFramework.get_or_create_health(_health_db, "stubhub")
            ScraperFramework.get_or_create_health(_health_db, "seatgeek")
            _health_db.commit()
        finally:
            _health_db.close()
    else:
        # Log but don't crash — health endpoint will surface this
        logger.error("Database connection FAILED on startup — check DATABASE_URL in .env")

    # Verify required production variables for Google Sign-In and security
    if settings.ENVIRONMENT == "production":
        missing_vars = []
        if not settings.GOOGLE_CLIENT_ID:
            missing_vars.append("GOOGLE_CLIENT_ID")
        if not settings.GOOGLE_CLIENT_SECRET:
            missing_vars.append("GOOGLE_CLIENT_SECRET")
        if not settings.SECRET_KEY or len(settings.SECRET_KEY) < 32:
            missing_vars.append("SECRET_KEY (missing or too short)")
        
        if missing_vars:
            logger.error(
                "CRITICAL: Missing or invalid required production environment variables: %s. "
                "This will cause login or security failures!",
                ", ".join(missing_vars)
            )

    # With a custom lifespan, Starlette does not run on_event handlers unless we call this.
    await app.router.startup()

    from app.jobs.scheduler import start_scheduler, scheduler
    from app.jobs.events_prewarm_job import prewarm_events_cache
    from app.services.cart_notification_service import CartNotificationService

    start_scheduler()
    scheduler.add_job(
        prewarm_events_cache,
        "interval",
        hours=6,
        id="events_prewarm",
        replace_existing=True,
    )
    scheduler.add_job(
        CartNotificationService.send_abandoned_notifications,
        trigger="interval",
        minutes=15,
        id="cart_notifications",
        replace_existing=True
    )
    from app.jobs.enrich_event_prices import run_price_enrichment_sync

    scheduler.add_job(
        run_price_enrichment_sync,
        trigger="cron",
        hour=4,
        minute=0,
        id="price_enrichment",
        replace_existing=True,
    )
    from app.jobs.viator_sync import run_viator_sync_sync

    scheduler.add_job(
        run_viator_sync_sync,
        trigger="cron",
        hour=3,
        minute=0,
        id="viator_sync",
        replace_existing=True,
    )


    yield

    # ── Shutdown ──────────────────────────────────────────────────────────────
    from app.jobs.scheduler import stop_scheduler

    stop_scheduler()

    logger.info("Shutting down %s", settings.APP_NAME)


# ── App factory ───────────────────────────────────────────────────────────────
def create_app() -> FastAPI:
    """
    Builds and returns the configured FastAPI application.
    Called once at module level — the result is the ASGI app.
    """
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="Group travel planning and coordination API",
        # Swagger UI and ReDoc are only available in DEBUG mode.
        # In production DEBUG=False hides them — security over convenience.
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    @app.on_event("startup")
    def _firebase_startup() -> None:
        try:
            from app.utils.firebase import get_firebase_app

            get_firebase_app()
            print("Firebase connected successfully", flush=True)
        except Exception as exc:
            print(exc, flush=True)

    _add_middleware(app)
    _register_routes(app)

    return app


def _add_middleware(app: FastAPI) -> None:
    """Register all middleware. Order matters — last added runs first."""
    # Browsers may send Origin as http://[::1]:3000 while dev only listed localhost /
    # 127.0.0.1, which makes fetch() fail with a generic network error. In development,
    # allow any localhost / loopback origin and port.
    cors_kw: dict = {
        "allow_credentials": True,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
    }
    env = (settings.ENVIRONMENT or "").strip().lower()
    if settings.DEBUG or env in ("development", "dev", "local"):
        cors_kw["allow_origin_regex"] = (
            r"https?://"
            r"(localhost|127\.0\.0\.1|\[::1\]|\[::ffff:127\.0\.0\.1\])"
            r"(:\d+)?"
        )
    else:
        # In production, we strictly use settings.allowed_origins but ensure 
        # the primary domains are always included if not already present.
        origins = list(settings.allowed_origins)
        for domain in ["https://rovvy.app", "https://www.rovvy.app"]:
            if domain not in origins:
                origins.append(domain)
        cors_kw["allow_origins"] = origins
    app.add_middleware(CORSMiddleware, **cors_kw)


def _register_routes(app: FastAPI) -> None:
    """
    Mount all routers onto the app.

    Health check is always registered — no auth, no prefix.
    Feature routers are added here as you complete each build step.
    All feature routes share the /api/v1 prefix.
    """

    # ── Health check ──────────────────────────────────────────────────────────
    # No auth. No prefix. Always available. Used by deployment health probes.
    @app.get("/health", tags=["Health"])
    def health_check() -> dict:
        db_ok = check_db_connection()
        return {
            "status": "ok" if db_ok else "degraded",
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "environment": settings.ENVIRONMENT,
            "database": "connected" if db_ok else "unreachable",
        }

    @app.get("/health/db", tags=["Health"])
    def health_db_diagnostics(db: Session = Depends(get_db)):
        """
        Development-only: pool stats, Postgres blockers, timeout settings.
        Use when login/OAuth hangs or fails after idle periods.
        """
        if not dev_diagnostics_enabled():
            AppException.not_found("Not found")

        return collect_db_diagnostics(db)

    # ── Feature routers ───────────────────────────────────────────────────────
    # Uncomment each block as you complete the corresponding build step.
    # Always import inside this function to avoid circular imports.

    # Step 9 — Auth
    from app.routes.auth import router as auth_router
    from app.routes.email_verification import router as email_verification_router

    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(email_verification_router, prefix="/api/v1")

    # Join requests — register before groups so POST /groups/join uses request flow
    from app.routes.join_requests import router as join_requests_router

    app.include_router(join_requests_router, prefix="/api/v1")

    # Step 12 — Groups
    from app.routes.groups import router as groups_router

    app.include_router(groups_router, prefix="/api/v1")

    from app.routes.connect import router as connect_router

    app.include_router(connect_router, prefix="/api/v1")

    # Step 15 — Trips
    from app.routes.trips import group_trips_router, trips_router

    app.include_router(group_trips_router, prefix="/api/v1")
    app.include_router(trips_router, prefix="/api/v1")

    # Step 17 — Locations
    from app.routes.locations import locations_router, trip_locations_router

    app.include_router(locations_router, prefix="/api/v1")
    app.include_router(trip_locations_router, prefix="/api/v1")

    # Step 20 — Polls
    from app.routes.polls import polls_router, trip_polls_router

    app.include_router(trip_polls_router, prefix="/api/v1")
    app.include_router(polls_router, prefix="/api/v1")

    # Step 22 — Expenses
    from app.routes.expenses import currencies_router, expenses_router

    app.include_router(expenses_router, prefix="/api/v1")
    app.include_router(currencies_router, prefix="/api/v1")

    from app.routes.meet_points import trip_meet_points_router, meet_points_router

    app.include_router(trip_meet_points_router, prefix="/api/v1")
    app.include_router(meet_points_router, prefix="/api/v1")

    from app.routes.timers import router as timers_router

    app.include_router(timers_router, prefix="/api/v1")

    from app.routes.feed import router as feed_router

    app.include_router(feed_router, prefix="/api/v1")

    from app.routes.stats import router as stats_router

    app.include_router(stats_router, prefix="/api/v1")

    from app.routes.weather import router as weather_router

    app.include_router(weather_router, prefix="/api/v1")

    from app.routes.geocoding import router as geocoding_router
    from app.routes.places import router as places_router

    app.include_router(geocoding_router, prefix="/api/v1")
    app.include_router(places_router, prefix="/api/v1")

    from app.routes.live_ai import router as live_ai_router

    app.include_router(live_ai_router, prefix="/api/v1")

    from app.routes.place_media import router as place_media_router

    app.include_router(place_media_router, prefix="/api/v1")

    from app.routes.travel_intel import router as travel_intel_router

    app.include_router(travel_intel_router, prefix="/api/v1")

    from app.routes.flights import router as flights_router

    app.include_router(flights_router, prefix="/api/v1")

    from app.routes.routes import router as route_discovery_router

    app.include_router(route_discovery_router, prefix="/api/v1")

    from app.routes.activities import router as activities_router

    app.include_router(activities_router, prefix="/api/v1")

    from app.routes.hotels import router as hotels_router

    app.include_router(hotels_router, prefix="/api/v1")

    from app.routes.buses import router as buses_router

    app.include_router(buses_router, prefix="/api/v1")

    from app.routes.buddy import router as buddy_router

    app.include_router(buddy_router, prefix="/api/v1")

    from app.routes.subscriptions import router as subscriptions_router

    app.include_router(subscriptions_router, prefix="/api/v1")

    from app.routes.payments import router as payments_router

    app.include_router(payments_router, prefix="/api/v1")

    from app.routes.pins import router as pins_router

    app.include_router(pins_router, prefix="/api/v1")

    from app.routes.ai_assistant import router as ai_assistant_router

    app.include_router(ai_assistant_router, prefix="/api/v1")

    from app.routes.notifications import router as notifications_router

    app.include_router(notifications_router, prefix="/api/v1")

    from app.routes.invitations import router as invitations_router

    app.include_router(invitations_router, prefix="/api/v1")

    from app.routes.users import router as users_router

    app.include_router(users_router, prefix="/api/v1")

    from app.routes.social import router as social_router

    app.include_router(social_router, prefix="/api/v1")

    from app.routes.app_settings import router as app_settings_router

    app.include_router(app_settings_router, prefix="/api/v1")

    from app.routes.trip_space import router as trip_space_router
    app.include_router(trip_space_router, prefix="/api/v1")

    from app.routers.explorer import router as explorer_router
    from app.routers.explorer import wayra_router
    from app.routes.explore import router as explore_content_router
    from app.routes.explorer import router as explorer_feed_router
    from app.routes.admin import router as admin_router
    from app.routes.admin_events import router as admin_events_router
    from app.routes.unified_experiences import router as unified_experiences_router

    from app.routes.lounge import router as lounge_router
    app.include_router(lounge_router, prefix="/api/v1")

    from app.routes.cart import router as cart_router
    from app.routes.video_extract import router as video_extract_router
    app.include_router(cart_router, prefix="/api/v1")
    app.include_router(video_extract_router, prefix="/api/v1")

    app.include_router(explore_content_router, prefix="/api/v1", tags=["explore_content"])
    app.include_router(explorer_feed_router, prefix="/api/v1", tags=["explorer_pipeline"])
    app.include_router(explorer_router, prefix="/api/v1", tags=["explorer"])
    app.include_router(wayra_router, prefix="/api/v1", tags=["wayra"])
    app.include_router(admin_router, prefix="/api/v1")
    app.include_router(admin_events_router, prefix="/api/v1")
    app.include_router(
        unified_experiences_router,
        prefix="/api/v1",
        tags=["unified-experiences"],
    )

    from app.routers.explorer_v2 import router as explorer_v2_router

    app.include_router(explorer_v2_router, prefix="/api/v2/explorer")

    from app.routes.data_export import router as data_export_router

    app.include_router(data_export_router, prefix="/api/v1")

    from app.routes.data_import import router as data_import_router

    app.include_router(data_import_router, prefix="/api/v1")

    from app.routes.integrations import router as integrations_router

    app.include_router(integrations_router, prefix="/api/v1")




# ── App instance ──────────────────────────────────────────────────────────────
# This is what uvicorn imports. Do not rename.
app = create_app()
