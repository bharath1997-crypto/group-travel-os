"""One-off: report Postgres database size (no secrets printed)."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from config import settings


def pretty(b: int | None) -> str:
    if b is None:
        return "0 bytes"
    for unit, div in (("TiB", 1024**4), ("GiB", 1024**3), ("MiB", 1024**2), ("KiB", 1024)):
        if b >= div:
            return f"{b / div:.2f} {unit} ({b:,} bytes)"
    return f"{b} bytes"


def main() -> None:
    url = make_url(settings.DATABASE_URL)
    dialect = url.drivername
    base = dialect.split("+")[0] if "+" in dialect else dialect
    print("dialect:", base)
    if not base.startswith("postgresql"):
        print("NOT_POSTGRES: configured DATABASE_URL is not Supabase/Postgres.")
        return

    engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    with engine.connect() as conn:
        db_name = conn.execute(text("SELECT current_database()")).scalar()
        db_bytes = conn.execute(text("SELECT pg_database_size(current_database())")).scalar()
        total_user = conn.execute(
            text(
                """
                SELECT COALESCE(SUM(pg_total_relation_size(c.oid)), 0)
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relkind = 'r'
                  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
                """
            )
        ).scalar()
        rows = conn.execute(
            text(
                """
                SELECT n.nspname AS schema,
                       c.relname AS table,
                       pg_total_relation_size(c.oid) AS bytes,
                       c.reltuples::bigint AS est_rows
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relkind = 'r'
                  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
                ORDER BY bytes DESC NULLS LAST
                LIMIT 30
                """
            )
        ).mappings().all()
        conn_count = conn.execute(
            text(
                "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()"
            )
        ).scalar()
        # places table if present
        places_stats = None
        try:
            places_stats = conn.execute(
                text(
                    """
                    SELECT COUNT(*) AS row_count,
                           pg_total_relation_size('public.places'::regclass) AS bytes
                    FROM public.places
                    """
                )
            ).mappings().first()
        except Exception:
            places_stats = None

    print("database:", db_name)
    print("total_database_size:", pretty(int(db_bytes or 0)))
    print("user_tables_total:", pretty(int(total_user or 0)))
    print("active_connections:", conn_count)
    if places_stats:
        print(
            "public.places:",
            f"{places_stats['row_count']:,} rows",
            pretty(int(places_stats["bytes"] or 0)),
        )
    print("--- top tables ---")
    for r in rows:
        est = r["est_rows"]
        est_s = f"~{est:,} rows" if est is not None else "rows n/a"
        print(f"  {r['schema']}.{r['table']}: {pretty(int(r['bytes'] or 0))} ({est_s})")


if __name__ == "__main__":
    main()
