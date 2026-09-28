"""Extended cloud DB inventory."""
from sqlalchemy import text

from app.utils.database import SessionLocal


def main() -> None:
    db = SessionLocal()
    try:
        print("=== Database connection ===")
        url = db.execute(text("SELECT current_database(), current_user")).one()
        print(f"database={url[0]} user={url[1]}")

        print("\n=== places columns ===")
        cols = db.execute(
            text(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'places'
                ORDER BY ordinal_position
                """
            )
        ).scalars().all()
        print(", ".join(cols))

        print("\n=== places by category (top 10) ===")
        cats = db.execute(
            text(
                """
                SELECT COALESCE(category, '(null)') AS category, COUNT(*) AS n
                FROM places
                GROUP BY 1
                ORDER BY n DESC
                LIMIT 10
                """
            )
        ).mappings().all()
        for c in cats:
            print(f"{c['category']}: {c['n']}")

        print("\n=== explore_contents city + content_type matrix (non-empty city) ===")
        matrix = db.execute(
            text(
                """
                SELECT city, content_type, COUNT(*) AS n
                FROM explore_contents
                WHERE city IS NOT NULL AND TRIM(city) <> ''
                GROUP BY city, content_type
                ORDER BY city, content_type
                """
            )
        ).mappings().all()
        for m in matrix:
            print(f"{m['city']} / {m['content_type']}: {m['n']}")

        print("\n=== blank-city explore_contents content_types ===")
        blank = db.execute(
            text(
                """
                SELECT content_type, COUNT(*) AS n
                FROM explore_contents
                WHERE city IS NULL OR TRIM(city) = ''
                GROUP BY content_type
                ORDER BY n DESC
                """
            )
        ).mappings().all()
        for b in blank:
            print(f"(no city) / {b['content_type']}: {b['n']}")

        print("\n=== major app tables (row counts) ===")
        tables = [
            "users",
            "trips",
            "groups",
            "group_members",
            "wayra_intents",
            "wayra_intent_variants",
            "flight_searches",
            "explore_contents",
        ]
        for tbl in tables:
            try:
                n = db.execute(text(f"SELECT COUNT(*) FROM {tbl}")).scalar()
                print(f"{tbl}: {n}")
            except Exception as exc:
                print(f"{tbl}: unavailable ({exc})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
