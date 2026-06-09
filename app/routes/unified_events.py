"""
app/routes/unified_events.py — Public search over unified event catalog.
"""
from __future__ import annotations

import math
from datetime import date, datetime, time

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.models.event_provider import EventProvider
from app.models.unified_event import UnifiedEvent
from app.utils.database import get_db

router = APIRouter(prefix="/unified-events", tags=["unified-events"])


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = date.fromisoformat(value)
        return datetime.combine(parsed, time.min)
    except ValueError:
        return None


def _serialize_provider(provider: EventProvider) -> dict:
    return {
        "provider": provider.provider,
        "min_price": provider.min_price,
        "max_price": provider.max_price,
        "currency": provider.currency,
        "price_label": provider.price_label,
        "availability": provider.availability,
        "url": provider.provider_url,
        "affiliate_url": provider.affiliate_url,
    }


@router.get("/search")
def search_unified_events(
    city: str | None = Query(None),
    country_code: str = Query("US"),
    lat: float | None = Query(None),
    lng: float | None = Query(None),
    radius_km: int = Query(50, ge=1, le=500),
    category: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> dict:
    today_start = datetime.combine(date.today(), time.min)

    filters = [
        UnifiedEvent.start_datetime >= today_start,
        UnifiedEvent.status != "cancelled",
    ]

    if city:
        filters.append(func.lower(UnifiedEvent.city) == city.lower().strip())

    if country_code:
        filters.append(
            func.upper(UnifiedEvent.country_code) == country_code.upper().strip()
        )

    if category:
        filters.append(func.lower(UnifiedEvent.category) == category.lower().strip())

    parsed_from = _parse_date(date_from)
    if parsed_from:
        filters.append(UnifiedEvent.start_datetime >= parsed_from)

    parsed_to = _parse_date(date_to)
    if parsed_to:
        filters.append(
            UnifiedEvent.start_datetime
            <= datetime.combine(parsed_to.date(), time.max)
        )

    if lat is not None and lng is not None:
        delta_lat = radius_km / 111.0
        cos_lat = max(abs(math.cos(math.radians(lat))), 0.01)
        delta_lng = radius_km / (111.0 * cos_lat)
        filters.extend([
            UnifiedEvent.lat >= lat - delta_lat,
            UnifiedEvent.lat <= lat + delta_lat,
            UnifiedEvent.lng >= lng - delta_lng,
            UnifiedEvent.lng <= lng + delta_lng,
        ])

    count_stmt = select(func.count()).select_from(UnifiedEvent).where(and_(*filters))
    total = db.execute(count_stmt).scalar_one()

    events_stmt = (
        select(UnifiedEvent)
        .where(and_(*filters))
        .order_by(UnifiedEvent.start_datetime.asc())
        .offset(offset)
        .limit(limit)
    )
    events = db.execute(events_stmt).scalars().all()

    event_ids = [event.id for event in events]
    providers_by_event: dict = {event_id: [] for event_id in event_ids}

    if event_ids:
        providers_stmt = (
            select(EventProvider)
            .where(EventProvider.event_id.in_(event_ids))
            .order_by(
                EventProvider.event_id.asc(),
                EventProvider.min_price.asc().nulls_last(),
            )
        )
        for provider in db.execute(providers_stmt).scalars().all():
            providers_by_event.setdefault(provider.event_id, []).append(provider)

    serialized_events = []
    for event in events:
        providers = providers_by_event.get(event.id, [])
        providers.sort(
            key=lambda p: (p.min_price is None, p.min_price or float("inf"))
        )
        serialized_events.append({
            "id": str(event.id),
            "title": event.title,
            "date": (
                event.start_datetime.isoformat()
                if event.start_datetime else None
            ),
            "venue": event.venue_name,
            "city": event.city,
            "country_code": event.country_code,
            "lat": event.lat,
            "lng": event.lng,
            "category": event.category,
            "image_url": event.image_url,
            "is_free": bool(event.is_free),
            "min_price": event.min_price,
            "currency": event.currency,
            "providers": [_serialize_provider(p) for p in providers],
        })

    return {
        "total": total,
        "events": serialized_events,
    }
