"""Map Ticketmaster Discovery Feed event objects to staging rows."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from scaper.connectors.ticketmaster import SEGMENT_SLUGS, _parse_utc
from scaper.slug import locality_city_slug

DESCRIPTION_MAX = 2000

_FEED_STATUS: dict[str, str] = {
    "onsale": "scheduled",
    "offsale": "scheduled",
    "rescheduled": "scheduled",
    "postponed": "postponed",
    "cancelled": "cancelled",
    "canceled": "cancelled",
}


def map_feed_event(raw: dict[str, Any], *, fallback_country: str) -> tuple[dict[str, Any] | None, str | None]:
    """
    Return (staging_row, reject_reason). reject_reason is set when the row should not load.
    """
    event_id = str(raw.get("eventId") or "").strip()
    if not event_id:
        return None, "missing eventId"
    title = str(raw.get("eventName") or "").strip()
    if not title:
        return None, "missing title"
    raw_status = str(raw.get("eventStatus") or "").strip().lower()
    if raw_status not in _FEED_STATUS:
        return None, f"status {raw_status or 'missing'}"
    starts_at = _parse_utc(raw.get("eventStartDateTime"))
    if starts_at is None:
        return None, "missing start time"
    venue = raw.get("venue") if isinstance(raw.get("venue"), dict) else {}
    try:
        lat = float(str(venue.get("venueLatitude")))
        lng = float(str(venue.get("venueLongitude")))
    except (TypeError, ValueError):
        return None, "no venue coordinates"
    if lat == 0.0 and lng == 0.0:
        return None, "no venue coordinates"
    venue_name = str(venue.get("venueName") or "").strip()
    if not venue_name:
        return None, "missing venue name"
    venue_id = str(venue.get("venueId") or "").strip() or None
    cc = str(venue.get("venueCountryCode") or fallback_country or "").strip().upper()
    if len(cc) != 2 or not cc.isalpha():
        cc = fallback_country.strip().upper()
    desc = raw.get("eventInfo") or raw.get("pleaseNote")
    segment = raw.get("classificationSegment")
    category = SEGMENT_SLUGS.get(str(segment)) if segment else None
    city = str(venue.get("venueCity") or "").strip()
    state = str(venue.get("venueStateCode") or "").strip().upper() or None
    if state and len(state) != 2:
        state = None
    row = {
        "event_id": event_id,
        "legacy_id": str(raw.get("legacyEventId") or "") or None,
        "title": title,
        "description": str(desc)[:DESCRIPTION_MAX] if desc else None,
        "category": category,
        "start_time": starts_at,
        "end_time": _parse_utc(raw.get("eventEndDateTime")),
        "timezone": venue.get("venueTimezone") or raw.get("venueTimezone"),
        "status": _FEED_STATUS[raw_status],
        "url": raw.get("primaryEventUrl") or raw.get("resaleEventUrl"),
        "image_url": raw.get("eventImageUrl"),
        "venue_id": venue_id,
        "venue_name": venue_name,
        "venue_street": str(venue.get("venueStreet") or "").strip() or None,
        "venue_city": city or None,
        "venue_state": state,
        "venue_zip": str(venue.get("venueZipCode") or "").strip() or None,
        "country_code": cc,
        "lat": lat,
        "lng": lng,
        "city_slug": locality_city_slug(city) if city else None,
    }
    return row, None


def event_expires_at(start: datetime, end: datetime | None) -> datetime:
    if end is not None:
        return end
    return start + timedelta(hours=6)


def within_horizon(start: datetime, *, horizon_days: int, now: datetime | None = None) -> bool:
    ref = now or datetime.now(timezone.utc)
    limit = ref + timedelta(days=horizon_days)
    return start <= limit
