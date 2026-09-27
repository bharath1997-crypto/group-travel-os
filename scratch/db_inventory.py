"""One-off inventory of explore-related DB tables. Run from repo root."""
from sqlalchemy import text

from app.utils.database import SessionLocal


def main() -> None:
    db = SessionLocal()
    try:
        print("=== explore_contents by content_type ===")
        rows = db.execute(
            text(
                """
                SELECT content_type, COUNT(*) AS n, COUNT(DISTINCT city) AS cities
                FROM explore_contents
                GROUP BY content_type
                ORDER BY n DESC
                """
            )
        ).mappings().all()
        if not rows:
            print("(empty)")
        for r in rows:
            print(f"{r['content_type']}: {r['n']} rows across {r['cities']} cities")

        print("\n=== explore_contents top cities ===")
        cities = db.execute(
            text(
                """
                SELECT city, COUNT(*) AS n
                FROM explore_contents
                GROUP BY city
                ORDER BY n DESC
                LIMIT 20
                """
            )
        ).mappings().all()
        if not cities:
            print("(empty)")
        for c in cities:
            print(f"{c['city']}: {c['n']} rows")

        print("\n=== PostGIS explorer tables ===")
        for tbl in ("places", "events", "activities", "explorer_cache"):
            try:
                n = db.execute(text(f"SELECT COUNT(*) FROM {tbl}")).scalar()
                print(f"{tbl}: {n} rows")
            except Exception as exc:
                print(f"{tbl}: unavailable ({exc})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
