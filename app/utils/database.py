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


def _normalize_database_url(url: str) -> str:
    """
    Supabase transaction pooler (6543) is incompatible with SQLAlchemy + psycopg2
    (prepared statements / SSL drops). Session pooler on 5432 works reliably.
    """
    parsed = make_url(url)
    host = parsed.host or ""
    if parsed.port == 6543 and "pooler.supabase.com" in host:
        parsed = parsed.set(port=5432)
        logger.info(
            "DATABASE_URL uses Supabase transaction pooler (6543); "
            "switching to session pooler (5432) for SQLAlchemy"
        )
    return parsed.render_as_string(hide_password=False)


# ── Engine ────────────────────────────────────────────────────────────────────
_url = make_url(_normalize_database_url(settings.DATABASE_URL))
_driver = _url.drivername
_engine_kw: dict = {
    # Log every SQL statement when DEBUG=True. Never enable in production.
    "echo": settings.DEBUG,
}
# PostgreSQL (and other server DBs): pooling + stale connection checks.
if not _driver.startswith("sqlite"):
    is_dev = settings.ENVIRONMENT == "development" or settings.DEBUG
    _engine_kw.update(
        {
            # Drop and re-test stale connections before handing to a request.
            # Prevents "server closed connection unexpectedly" after idle periods.
            "pool_pre_ping": True,
            # Recycle connections before Supabase/pooler closes idle sockets (~30–60 min).
            "pool_recycle": 1800,
            # Connections kept open in the pool at all times.
            "pool_size": 6 if is_dev else 10,
            # Extra connections allowed above pool_size under load, then discarded.
            "max_overflow": 4 if is_dev else 20,
            # Max seconds to wait for a free pooled connection.
            "pool_timeout": 30,
            # Timeout for connecting to the database (in seconds).
            "connect_args": {"connect_timeout": 15},
        },
    )
    if "supabase.com" in (_url.host or ""):
        _engine_kw["connect_args"]["sslmode"] = "require"
# SQLite + Starlette TestClient: requests run in a thread pool on Linux; without this,
# sqlite3 raises "SQLite objects created in a thread can only be used in that same thread".
if _driver.startswith("sqlite"):
    _engine_kw["connect_args"] = {"check_same_thread": False}

engine = create_engine(_url, **_engine_kw)


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
    except Exception:
        # Release row/table locks if a route or service failed mid-transaction.
        db.rollback()
        raise
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
