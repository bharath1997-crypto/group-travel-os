"""Read-only F27 verification against Postgres when DATABASE_URL is set."""
from __future__ import annotations

import os
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.services.explore_scaper_events import city_slug, scaper_events_for_city
from app.services.scaper_event_visibility import visible_events_cte
from config import settings


def main() -> None:
    # Prefer Settings (.env) — shell DATABASE_URL is often sqlite for pytest.
    url = (settings.DATABASE_URL or "").strip()
    if not url.startswith("postgres"):
        url = os.environ.get("SCAPER_PG_TEST_URL") or ""
    if not url.startswith("postgres"):
        print("pg_url_configured=False")
        return
    print("pg_url_configured=True")
    engine = create_engine(url)
    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        today = date.today()
        to_day = today + timedelta(days=14)
        now = datetime.now(timezone.utc)
        for city in ("Chicago", "Orlando"):
            res = scaper_events_for_city(
                db,
                city=city,
                date_from=today.isoformat(),
                date_to=to_day.isoformat(),
                page=1,
                per_page=24,
            )
            first = res["events"][:24]
            eb = sum(1 for e in first if (e.get("source") or "").lower() == "eventbrite")
            tm = sum(1 for e in first if (e.get("source") or "").lower() == "ticketmaster")
            print(
                f"{city}: total={res['total']} first24 eventbrite={eb} ticketmaster={tm} "
                f"sample={[(e.get('source'), e.get('date'), e.get('time')) for e in first[:6]]}"
            )
            slug = city_slug(city)
            params = {
                "city": slug,
                "now": now,
                "from_day": today,
                "to_day": to_day,
                "category": None,
            }
            cte = visible_events_cte(
                """
                AND source_id IS NOT NULL AND city_slug = :city
                AND (CAST(:from_day AS date) IS NULL
                     OR (start_time AT TIME ZONE COALESCE(NULLIF(timezone, ''), 'UTC'))::date >= :from_day)
                AND (CAST(:to_day AS date) IS NULL
                     OR (start_time AT TIME ZONE COALESCE(NULLIF(timezone, ''), 'UTC'))::date <= :to_day)
                """
            )
            rows = db.execute(
                text(cte + " SELECT provider FROM visible ORDER BY start_time ASC, id ASC LIMIT 24"),
                params,
            ).all()
            eb_old = sum(1 for (provider,) in rows if provider == "eventbrite")
            print(f"{city}: start_time_only first24 eventbrite={eb_old}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
