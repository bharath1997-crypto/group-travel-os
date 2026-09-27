from sqlalchemy import text
from app.utils.database import SessionLocal

db = SessionLocal()
try:
    tables = db.execute(
        text(
            "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename"
        )
    ).scalars().all()
    print(f"Public tables ({len(tables)}):")
    for t in tables:
        print(f"  - {t}")

    print("\nSample events_aggregated payload sizes:")
    rows = db.execute(
        text(
            """
            SELECT city, jsonb_array_length(data) AS items, fetched_at
            FROM explore_contents
            WHERE content_type = 'events_aggregated'
            ORDER BY city
            """
        )
    ).mappings().all()
    for r in rows:
        print(f"  {r['city']}: {r['items']} events (fetched {r['fetched_at']})")

    print("\nSample places_attractions_v6 payload sizes:")
    rows2 = db.execute(
        text(
            """
            SELECT city, jsonb_array_length(data) AS items, fetched_at
            FROM explore_contents
            WHERE content_type = 'places_attractions_v6'
            ORDER BY city
            """
        )
    ).mappings().all()
    for r in rows2:
        print(f"  {r['city']}: {r['items']} places (fetched {r['fetched_at']})")

    print("\nexplore_events by city (top 15):")
    ev = db.execute(
        text(
            """
            SELECT city, COUNT(*) AS n
            FROM explore_events
            GROUP BY city
            ORDER BY n DESC
            LIMIT 15
            """
        )
    ).mappings().all()
    for r in ev:
        print(f"  {r['city']}: {r['n']}")

    print("\nunified_experiences by city (top 10):")
    ux = db.execute(
        text(
            """
            SELECT city, COUNT(*) AS n
            FROM unified_experiences
            GROUP BY city
            ORDER BY n DESC
            LIMIT 10
            """
        )
    ).mappings().all()
    for r in ux:
        print(f"  {r['city']}: {r['n']}")
finally:
    db.close()
