from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, func
from datetime import datetime
from typing import Optional
from app.utils.database import get_db
from app.models.unified_event import UnifiedEvent
from app.models.event_provider import EventProvider

router = APIRouter()

@router.get("/unified-events/search")
async def search_unified_events(
    city: Optional[str] = Query(None),
    country_code: Optional[str] = Query("US"),
    category: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db)
):
    filters = [
        UnifiedEvent.status != 'cancelled',
        UnifiedEvent.start_datetime >= datetime.utcnow()
    ]

    if city:
        filters.append(
            func.lower(UnifiedEvent.city)
            == city.lower().strip()
        )
    if country_code:
        filters.append(
            func.upper(UnifiedEvent.country_code)
            == country_code.upper()
        )
    if category:
        filters.append(
            func.lower(UnifiedEvent.category)
            == category.lower()
        )
    if date_from:
        filters.append(
            UnifiedEvent.start_datetime
            >= datetime.fromisoformat(date_from)
        )
    if date_to:
        filters.append(
            UnifiedEvent.start_datetime
            <= datetime.fromisoformat(date_to)
        )

    stmt = select(UnifiedEvent).where(
        and_(*filters)
    ).order_by(
        UnifiedEvent.start_datetime.asc()
    ).limit(limit).offset(offset)

    events = db.execute(stmt).scalars().all()

    result = []
    for event in events:
        providers_stmt = select(EventProvider)\
            .where(
                EventProvider.event_id == event.id
            ).order_by(
                EventProvider.min_price.asc().nulls_last()
            )
        providers = db.execute(providers_stmt)\
            .scalars().all()

        provider_prices = [
            p.min_price for p in providers
            if p.min_price is not None
        ]
        cheapest_price = min(provider_prices) if provider_prices else None

        result.append({
            "id": str(event.id),
            "title": event.title,
            "date": event.start_datetime\
                .isoformat() \
                if event.start_datetime else None,
            "venue": event.venue_name,
            "city": event.city,
            "state": event.state_province,
            "country_code": event.country_code,
            "lat": event.lat,
            "lng": event.lng,
            "category": event.category,
            "image_url": event.image_url,
            "is_free": event.is_free,
            "min_price": event.min_price,
            "cheapest_price": cheapest_price,
            "currency": event.currency or "USD",
            "providers": [
                {
                    "provider": p.provider,
                    "min_price": p.min_price,
                    "max_price": p.max_price,
                    "currency": p.currency,
                    "price_label": p.price_label,
                    "availability": p.availability,
                    "url": p.provider_url,
                    "affiliate_url": \
                        p.affiliate_url
                }
                for p in providers
            ]
        })

    return {
        "total": len(result),
        "offset": offset,
        "limit": limit,
        "events": result
    }
