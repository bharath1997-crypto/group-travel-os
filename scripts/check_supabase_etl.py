"""Quick Supabase health check for running OSM ETL."""
from sqlalchemy import text

from app.scripts.osm_etl import create_etl_session


def main() -> None:
    db = create_etl_session()
    try:
        ok = db.execute(text("SELECT 1")).scalar()
        print(f"connection: {'ok' if ok == 1 else 'failed'}")

        latest = db.execute(text("SELECT MAX(enriched_at) FROM places")).scalar()
        print(f"latest enriched_at: {latest}")

        recent = db.execute(
            text(
                "SELECT COUNT(*) FROM places "
                "WHERE enriched_at > NOW() - INTERVAL '10 minutes'"
            )
        ).scalar()
        print(f"rows enriched in last 10 min: {recent}")

        rows = db.execute(
            text(
                """
                SELECT pid, state, wait_event_type, wait_event,
                       LEFT(query, 120) AS query
                FROM pg_stat_activity
                WHERE datname = current_database()
                  AND pid <> pg_backend_pid()
                  AND state <> 'idle'
                ORDER BY query_start
                LIMIT 10
                """
            )
        ).mappings().all()
        print(f"active queries: {len(rows)}")
        for row in rows:
            print(
                f"  pid={row['pid']} state={row['state']} "
                f"wait={row['wait_event_type']}/{row['wait_event']} "
                f"q={row['query']}"
            )
    finally:
        db.close()


if __name__ == "__main__":
    main()
