"""
app/main.py — FastAPI application factory

Creates and configures the FastAPI app instance.
All middleware, routers, and startup logic lives here.

Import the app instance via: from app.main import app
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.utils.database import check_db_connection
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
    else:
        # Log but don't crash — health endpoint will surface this
        logger.error("Database connection FAILED on startup — check DATABASE_URL in .env")

    # With a custom lifespan, Starlette does not run on_event handlers unless we call this.
    await app.router.startup()

    from app.jobs.scheduler import start_scheduler

    start_scheduler()

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
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


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

    # ── Feature routers ───────────────────────────────────────────────────────
    # Uncomment each block as you complete the corresponding build step.
    # Always import inside this function to avoid circular imports.

    # Step 9 — Auth
    from app.routes.auth import router as auth_router

    app.include_router(auth_router, prefix="/api/v1")

    # Join requests — register before groups so POST /groups/join uses request flow
    from app.routes.join_requests import router as join_requests_router

    app.include_router(join_requests_router, prefix="/api/v1")

    # Step 12 — Groups
    from app.routes.groups import router as groups_router

    app.include_router(groups_router, prefix="/api/v1")

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
    from app.routes.expenses import expenses_router

    app.include_router(expenses_router, prefix="/api/v1")

    from app.routes.location_shares import router as location_shares_router

    app.include_router(location_shares_router, prefix="/api/v1")

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

    from app.routes.subscriptions import router as subscriptions_router

    app.include_router(subscriptions_router, prefix="/api/v1")

    from app.routes.pins import router as pins_router

    app.include_router(pins_router, prefix="/api/v1")

    from app.routes.ai_assistant import router as ai_assistant_router

    app.include_router(ai_assistant_router, prefix="/api/v1")

    from app.routes.notifications import router as notifications_router

    app.include_router(notifications_router, prefix="/api/v1")

    from app.routes.social import router as social_router

    app.include_router(social_router, prefix="/api/v1")


# ── App instance ──────────────────────────────────────────────────────────────
# This is what uvicorn imports. Do not rename.
app = create_app()
