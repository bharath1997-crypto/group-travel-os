"""Read verified Scaper events for the main Explore hub without a distance cutoff."""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.explore_cache_freshness import explore_freshness_meta


def _event_row(row: dict[str, Any], city: str) -> dict[str, Any]:
    start: datetime = row["start_time"]
    try:
        start = start.astimezone(ZoneInfo(row.get("timezone") or "UTC"))
    except ZoneInfoNotFoundError:
        start = start.astimezone(timezone.utc)
    price_min = float(row["price_min"]) if row["price_min"] is not None else None
    price_max = float(row["price_max"]) if row["price_max"] is not None else None
    if row["is_free"] is True:
        price_min = price_max = 0.0
    event = {
        "id": f"scaper:{row['id']}",
        "name": row["title"],
        "category": row["category"] or "Event",
        "date": start.date().isoformat(),
        "time": start.strftime("%H:%M"),
        "venue": row["venue_name"] or "Venue unknown",
        "city": city,
        "country": "US",
        "image_url": row["image_url"],
        "ticket_url": row["ticket_url"] or "",
        "price_min": price_min,
        "price_max": price_max,
        "status": row["status"],
        "source": row["provider"],
        "venue_lat": row["lat"],
        "venue_lon": row["lng"],
    }
    event.update(
        title=event["name"], imageUrl=event["image_url"], url=event["ticket_url"],
        start_date=event["date"], sourceType=event["source"],
    )
    return event


def scaper_events_for_city(
    db: Session,
    *,
    city: str,
    category: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = 1,
    per_page: int = 200,
) -> dict[str, Any]:
    """Use the source's city stamp, never a radius or browser GPS coordinate."""
    if db.bind is None or db.bind.dialect.name != "postgresql":
        raise RuntimeError("Scaper events require PostgreSQL")
    city_slug = city.split(",")[0].strip().lower()
    from_day = date.fromisoformat(date_from) if date_from else None
    to_day = date.fromisoformat(date_to) if date_to else None
    per_page = max(1, min(per_page, 500))
    page = max(1, page)
    params = {
        "city": city_slug,
        "now": datetime.now(timezone.utc),
        "category": category.lower() if category else None,
        "from_day": from_day,
        "to_day": to_day,
        "limit": per_page,
        "offset": (page - 1) * per_page,
    }
    where = """
        source_id IS NOT NULL AND city_slug = :city AND duplicate_of IS NULL
        AND status IN ('scheduled', 'sold_out', 'postponed')
        AND COALESCE(expires_at, end_time, start_time) > :now
        AND (:category IS NULL OR lower(category) = :category)
        AND (:from_day IS NULL OR (start_time AT TIME ZONE COALESCE(NULLIF(timezone, ''), 'UTC'))::date >= :from_day)
        AND (:to_day IS NULL OR (start_time AT TIME ZONE COALESCE(NULLIF(timezone, ''), 'UTC'))::date <= :to_day)
    """
    with db.begin_nested():
        total = db.execute(text(f"SELECT count(*) FROM public.events WHERE {where}"), params).scalar_one()
        rows = db.execute(
            text(f"""
                SELECT id, title, category, start_time, venue_name, image_url,
                       ticket_url, price_min, price_max, is_free, status, provider,
                       lat, lng, timezone, fetched_at
                FROM public.events WHERE {where}
                ORDER BY start_time ASC, id ASC
                LIMIT :limit OFFSET :offset
            """), params,
        ).mappings().all()
    events = [_event_row(dict(row), city) for row in rows]
    refreshed_at = max((row["fetched_at"] for row in rows if row["fetched_at"]), default=None)
    return {
        "city": city,
        "display_city": city,
        "total": total,
        "page": page,
        "per_page": per_page,
        "events": events,
        "fetch_mode": "scaper_city",
        "radius_miles": None,
        "radius_used": None,
        "nearby_cities": [],
        "freshness": explore_freshness_meta(
            refreshed_at=refreshed_at,
            cache_status="fresh_cache" if events else "empty",
        ),
    }


def scaper_event_detail(db: Session, event_id: str) -> dict[str, Any] | None:
    """Resolve a Scaper card without inventing rating, distance, time or price."""
    if db.bind is None or db.bind.dialect.name != "postgresql":
        return None
    try:
        event_uuid = UUID(event_id.removeprefix("scaper:"))
    except ValueError:
        return None
    row = db.execute(
        text("""
            SELECT id, title, category, start_time, venue_name, image_url,
                   ticket_url, price_min, price_max, is_free, status, provider,
                   lat, lng, city_slug, timezone
            FROM public.events
            WHERE id = :id AND source_id IS NOT NULL AND duplicate_of IS NULL
              AND status IN ('scheduled', 'sold_out', 'postponed')
              AND COALESCE(expires_at, end_time, start_time) > :now
        """),
        {"id": event_uuid, "now": datetime.now(timezone.utc)},
    ).mappings().first()
    if row is None:
        return None
    city = (row["city_slug"] or "").replace("-", " ").title()
    event = _event_row(dict(row), city)
    return {
        "id": event["id"],
        "title": event["name"],
        "category": event["category"],
        "venue": event["venue"],
        "city": city,
        "state": "Florida" if row["city_slug"] == "orlando" else None,
        "start_date": event["date"],
        "start_time": event["time"],
        "price_min": event["price_min"],
        "price_max": event["price_max"],
        "image_url": event["image_url"],
        "ticket_url": event["ticket_url"],
        "source": event["source"],
        "status": event["status"],
        "rating": None,
        "distance_miles": None,
    }
