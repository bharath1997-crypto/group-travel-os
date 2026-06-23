"""
app/utils/db_diagnostics.py — Dev DB health: blockers, pool stats, timeouts

Used by GET /health/db (development only) and scripts/check_db_blockers.py.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from config import settings


def dev_diagnostics_enabled() -> bool:
    env = (settings.ENVIRONMENT or "").strip().lower()
    return settings.DEBUG or env in ("development", "dev", "local")


def apply_interactive_db_timeouts(db: Session) -> None:
    """
    Fast-fail user-facing DB work (OAuth, login) instead of waiting for the
    global statement_timeout (often 120s on Supabase while blocked on a lock).
    """
    bind = db.get_bind()
    if bind.dialect.name != "postgresql":
        return
    db.execute(text("SET LOCAL lock_timeout = '10s'"))
    db.execute(text("SET LOCAL statement_timeout = '30s'"))


def _pool_status(engine: Engine) -> dict[str, Any]:
    pool = engine.pool
    status: dict[str, Any] = {
        "driver": engine.dialect.name,
        "pool_size": getattr(pool, "size", lambda: None)(),
        "checked_in": getattr(pool, "checkedin", lambda: None)(),
        "checked_out": getattr(pool, "checkedout", lambda: None)(),
        "overflow": getattr(pool, "overflow", lambda: None)(),
    }
    return {k: v for k, v in status.items() if v is not None}


def collect_db_diagnostics(db: Session) -> dict[str, Any]:
    """Return connection, timeout, blocker, and pool diagnostics."""
    bind = db.get_bind()
    result: dict[str, Any] = {
        "environment": settings.ENVIRONMENT,
        "debug": settings.DEBUG,
        "connected": False,
        "pool": _pool_status(bind),
        "timeouts": {},
        "blockers": [],
        "idle_in_transaction": [],
        "recommendations": [],
    }

    ping = db.execute(text("SELECT 1")).scalar()
    result["connected"] = ping == 1

    if bind.dialect.name != "postgresql":
        result["recommendations"].append(
            "PostgreSQL diagnostics unavailable — using non-Postgres driver."
        )
        return result

    timeout_row = db.execute(
        text(
            "SELECT "
            "current_setting('statement_timeout') AS statement_timeout, "
            "current_setting('lock_timeout') AS lock_timeout, "
            "current_setting('idle_in_transaction_session_timeout') "
            "AS idle_in_transaction_session_timeout"
        )
    ).mappings().one()
    result["timeouts"] = dict(timeout_row)

    blockers = db.execute(
        text(
            """
            SELECT
                a.pid,
                a.usename,
                a.state,
                a.wait_event_type,
                a.wait_event,
                EXTRACT(EPOCH FROM (now() - a.query_start))::int AS running_seconds,
                LEFT(a.query, 200) AS query
            FROM pg_stat_activity a
            WHERE a.datname = current_database()
              AND a.pid <> pg_backend_pid()
              AND (
                a.state = 'active'
                OR a.wait_event_type = 'Lock'
              )
            ORDER BY a.query_start NULLS LAST
            LIMIT 20
            """
        )
    ).mappings().all()
    result["blockers"] = [dict(row) for row in blockers]

    idle_tx = db.execute(
        text(
            """
            SELECT
                pid,
                usename,
                EXTRACT(EPOCH FROM (now() - xact_start))::int AS xact_seconds,
                LEFT(query, 200) AS query
            FROM pg_stat_activity
            WHERE datname = current_database()
              AND pid <> pg_backend_pid()
              AND state = 'idle in transaction'
            ORDER BY xact_start
            LIMIT 10
            """
        )
    ).mappings().all()
    result["idle_in_transaction"] = [dict(row) for row in idle_tx]

    if blockers:
        result["recommendations"].append(
            "Active queries or lock waits detected — OAuth and login may hang "
            "until statement_timeout. Run scripts/check_db_blockers.py or finish "
            "stuck migrations/jobs."
        )
    if idle_tx:
        result["recommendations"].append(
            "Sessions idle-in-transaction hold locks — restart uvicorn or "
            "terminate stale backends in Supabase SQL editor."
        )
    if not result["recommendations"]:
        result["recommendations"].append("No blockers detected.")

    return result
