"""
app/utils/database.py — Database engine, session factory, and Base model

Rules:
- All models inherit from Base (imported from here)
- get_db() is used as a FastAPI dependency via Depends(get_db)
- Never create sessions manually outside of get_db()
- Never import SessionLocal directly in routes or services
"""
import logging
from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from config import settings

logger = logging.getLogger(__name__)


# ── Engine ────────────────────────────────────────────────────────────────────
_url = make_url(settings.DATABASE_URL)
_driver = _url.drivername
_engine_kw: dict = {
    # Log every SQL statement when DEBUG=True. Never enable in production.
    "echo": settings.DEBUG,
}
# PostgreSQL (and other server DBs): pooling + stale connection checks.
if not _driver.startswith("sqlite"):
    _engine_kw.update(
        {
            # Drop and re-test stale connections before handing to a request.
            # Prevents "server closed connection unexpectedly" after idle periods.
            "pool_pre_ping": True,
            # Connections kept open in the pool at all times.
            "pool_size": 10,
            # Extra connections allowed above pool_size under load, then discarded.
            "max_overflow": 20,
        },
    )
# SQLite + Starlette TestClient: requests run in a thread pool on Linux; without this,
# sqlite3 raises "SQLite objects created in a thread can only be used in that same thread".
if _driver.startswith("sqlite"):
    _engine_kw["connect_args"] = {"check_same_thread": False}

engine = create_engine(settings.DATABASE_URL, **_engine_kw)


# ── Session factory ───────────────────────────────────────────────────────────
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,   # Explicit commits only — we control transactions
    autoflush=False,    # Flush manually before queries that need fresh data
)


# ── Declarative base ──────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    """
    All SQLAlchemy models must inherit from this Base.

    Import pattern in every model file:
        from app.utils.database import Base
    """
    pass


# ── FastAPI dependency ────────────────────────────────────────────────────────
def get_db() -> Generator[Session, None, None]:
    """
    Yields a database session scoped to a single HTTP request.

    Usage in any route:
        from fastapi import Depends
        from app.utils.database import get_db

        @router.get("/example")
        def example(db: Session = Depends(get_db)):
            ...

    The session is always closed — even if the route raises an exception.
    Never call this outside of Depends().
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Health check helper ───────────────────────────────────────────────────────
def check_db_connection() -> bool:
    """
    Verifies the database is reachable.
    Called by the /health endpoint on startup and per-request.
    Returns True if connected, False otherwise.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.error("Database health check failed: %s", exc)
        return False
