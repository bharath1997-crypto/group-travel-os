"""
Ticketmaster connector (Discovery API v2).

Geo-search: lat/lng/radius + look-ahead window.
State search: countryCode=US + stateCode, with time-window bisection when
totalElements exceeds Discovery's deep-paging cap (size * page < 1000).
"""
from __future__ import annotations

import logging
import time
from collections.abc import Callable, Iterator
from datetime import datetime, timedelta, timezone
from typing import Any, ClassVar

import httpx
from pydantic import BaseModel, Field, field_validator, model_validator

from scaper.connectors.base import Connector
from scaper.http import ConnectorError, RetryingClient
from scaper.models import EventRecord, EventStatus, ExtractResult, RawItem, Rejected, VenueRecord

logger = logging.getLogger(__name__)

EVENTS_URL = "https://app.ticketmaster.com/discovery/v2/events.json"
PAGE_SIZE = 200
DEEP_PAGING_LIMIT = 1000
MAX_PAGE_INDEX = DEEP_PAGING_LIMIT // PAGE_SIZE - 1  # pages 0..4
MIN_SPLIT_WINDOW = timedelta(hours=1)
LOOKBACK = timedelta(hours=6)
DESCRIPTION_MAX = 2000
VOLATILE_KEYS = ("distance", "units", "_links")

US_STATE_CODES = frozenset(
    "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT "
    "NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split()
)

SEGMENT_SLUGS: dict[str, str] = {
    "Music": "music",
    "Sports": "sports",
    "Arts & Theatre": "arts",
    "Film": "film",
    "Miscellaneous": "other",
}

_STATUS: dict[str, EventStatus] = {
    "onsale": "scheduled",
    "offsale": "scheduled",
    "rescheduled": "scheduled",
    "postponed": "postponed",
    "cancelled": "cancelled",
    "canceled": "cancelled",
}


class TicketmasterGeoConfig(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    radius_km: int = Field(default=25, ge=1, le=100)
    days_ahead: int = Field(default=14, ge=1, le=60)
    segment_id: str | None = None
    max_pages: int = Field(default=DEEP_PAGING_LIMIT // PAGE_SIZE, ge=1, le=DEEP_PAGING_LIMIT // PAGE_SIZE)


class TicketmasterStateConfig(BaseModel):
    state_code: str = Field(min_length=2, max_length=2)
    days_ahead: int = Field(default=60, ge=1, le=60)
    segment_id: str | None = None

    @field_validator("state_code")
    @classmethod
    def _state(cls, value: str) -> str:
        code = value.strip().upper()
        if code not in US_STATE_CODES:
            raise ValueError(f"invalid US state code: {value}")
        return code


class TicketmasterSourceConfig(BaseModel):
    """Either geo (lat/lng) or state_code — validated by TicketmasterConnector.parse_config."""

    model_config = {"extra": "forbid"}


class TicketmasterConnector(Connector):
    name: ClassVar[str] = "ticketmaster"
    config_model: ClassVar[type[BaseModel]] = TicketmasterSourceConfig

    def __init__(
        self,
        api_key: str,
        client: RetryingClient | None = None,
        *,
        now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
        page_delay: float = 0.25,  # Discovery allows 5 req/s
    ) -> None:
        if not api_key.strip():
            raise ConnectorError("TICKETMASTER_API_KEY is not set")
        self._client = client or RetryingClient(
            httpx.Client(timeout=20.0, params={"apikey": api_key.strip()})
        )
        self._now = now
        self._page_delay = page_delay
        self.api_calls_used = 0

    def parse_config(self, config: dict[str, Any]) -> TicketmasterGeoConfig | TicketmasterStateConfig:
        if config.get("state_code") is not None:
            return TicketmasterStateConfig.model_validate(config)
        if "lat" in config or "lng" in config:
            return TicketmasterGeoConfig.model_validate(config)
        raise ValueError("ticketmaster config requires geo (lat/lng) or state_code")

    def fetch(self, config: dict[str, Any]) -> Iterator[RawItem]:
        cfg = self.parse_config(config)
        self.last_fetch_complete = False
        self.api_calls_used = 0
        now = self._now()
        window_start = now - LOOKBACK
        window_end = now + timedelta(days=cfg.days_ahead)

        if isinstance(cfg, TicketmasterStateConfig):
            base: dict[str, Any] = {
                "countryCode": "US",
                "stateCode": cfg.state_code,
                "size": PAGE_SIZE,
                "sort": "date,asc",
            }
            if cfg.segment_id:
                base["segmentId"] = cfg.segment_id
            complete = yield from self._fetch_window(base, window_start, window_end)
            self.last_fetch_complete = complete
        else:
            params: dict[str, Any] = {
                "latlong": f"{cfg.lat},{cfg.lng}",
                "radius": cfg.radius_km,
                "unit": "km",
                "size": PAGE_SIZE,
                "sort": "date,asc",
                "startDateTime": _tm_time(window_start),
                "endDateTime": _tm_time(window_end),
            }
            if cfg.segment_id:
                params["segmentId"] = cfg.segment_id
            complete = yield from self._page_listing(params, max_pages=cfg.max_pages)
            self.last_fetch_complete = complete

        logger.info("ticketmaster fetch completed (%d API calls)", self.api_calls_used)

    def _fetch_window(
        self, base: dict[str, Any], start: datetime, end: datetime
    ) -> Iterator[RawItem]:
        params = {
            **base,
            "startDateTime": _tm_time(start),
            "endDateTime": _tm_time(end),
        }
        body = self._get_page(params, page=0)
        page = body.get("page") or {}
        total = int(page.get("totalElements") or 0)
        total_pages = int(page.get("totalPages") or 0)

        if total > DEEP_PAGING_LIMIT:
            if end - start < MIN_SPLIT_WINDOW:
                yield from self._yield_page_events(body)
                yield from self._page_listing(params, max_pages=MAX_PAGE_INDEX + 1, first_page=1)
                return False
            mid = start + (end - start) / 2
            left_ok = yield from self._fetch_window(base, start, mid)
            right_ok = yield from self._fetch_window(base, mid, end)
            return left_ok and right_ok

        yield from self._yield_page_events(body)
        if total_pages > 1:
            yield from self._page_listing(params, max_pages=total_pages, first_page=1)
        return True

    def _page_listing(
        self, params: dict[str, Any], *, max_pages: int, first_page: int = 0
    ) -> Iterator[RawItem]:
        """Page through a listing capped at Discovery deep-paging (page index < 5)."""
        capped = min(max_pages, MAX_PAGE_INDEX + 1)
        complete = True
        if first_page == 0:
            body = self._get_page(params, page=0)
            page = body.get("page") or {}
            total = int(page.get("totalElements") or 0)
            total_pages = int(page.get("totalPages") or 0)
            if total > DEEP_PAGING_LIMIT:
                complete = False
            capped = min(total_pages, MAX_PAGE_INDEX + 1)
            yield from self._yield_page_events(body)
            first_page = 1
        for page_number in range(first_page, capped):
            if self._page_delay:
                time.sleep(self._page_delay)
            body = self._get_page(params, page=page_number)
            yield from self._yield_page_events(body)
        return complete

    def _get_page(self, params: dict[str, Any], *, page: int) -> dict[str, Any]:
        if page > MAX_PAGE_INDEX:
            raise ConnectorError(f"ticketmaster page {page} exceeds Discovery deep-paging cap")
        if page and self._page_delay:
            time.sleep(self._page_delay)
        self.api_calls_used += 1
        return self._client.get_json(EVENTS_URL, params={**params, "page": page})

    @staticmethod
    def _yield_page_events(body: dict[str, Any]) -> Iterator[RawItem]:
        events = (body.get("_embedded") or {}).get("events") or []
        for event in events:
            if isinstance(event, dict) and event.get("id"):
                payload = {k: v for k, v in event.items() if k not in VOLATILE_KEYS}
                yield RawItem(external_id=str(event["id"]), payload=payload)

    def extract(self, payload: dict[str, Any]) -> ExtractResult:
        if payload.get("test"):
            return Rejected(reason="test event")
        title = str(payload.get("name") or "").strip()
        if not title:
            return Rejected(reason="missing title")
        dates = payload.get("dates") or {}
        raw_status = str((dates.get("status") or {}).get("code") or "")
        if raw_status not in _STATUS:
            return Rejected(reason=f"status {raw_status or 'missing'}")
        starts_at = _parse_utc((dates.get("start") or {}).get("dateTime"))
        if starts_at is None:
            return Rejected(reason="missing start time")
        venues = (payload.get("_embedded") or {}).get("venues") or []
        venue = _venue(venues[0]) if venues else None
        if venue is None:
            return Rejected(reason="no venue coordinates")

        price_min, price_max, currency = _prices(payload.get("priceRanges"))
        info = payload.get("info") or payload.get("pleaseNote")
        return EventRecord(
            external_id=str(payload["id"]),
            title=title,
            description=str(info)[:DESCRIPTION_MAX] if info else None,
            category=_category(payload.get("classifications")),
            starts_at=starts_at,
            ends_at=_parse_utc((dates.get("end") or {}).get("dateTime")),
            timezone=dates.get("timezone") or (venues[0].get("timezone") if venues else None),
            status=_STATUS[raw_status],
            is_free=None,
            price_min=price_min,
            price_max=price_max,
            currency=currency,
            url=payload.get("url") or None,
            image_url=_image(payload.get("images")),
            venue=venue,
        )


def venue_city_and_state(payload: dict[str, Any]) -> tuple[str | None, str | None]:
    """City slug and state code from the first embedded venue (for state-wide sources)."""
    from scaper.slug import locality_city_slug

    venues = (payload.get("_embedded") or {}).get("venues") or []
    if not venues or not isinstance(venues[0], dict):
        return None, None
    venue = venues[0]
    locality = (venue.get("city") or {}).get("name")
    region = (venue.get("state") or {}).get("stateCode")
    slug = locality_city_slug(locality)
    state = str(region).strip().upper() if region else None
    if state and len(state) != 2:
        state = None
    return slug, state


def _tm_time(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_utc(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else None


def _venue(value: Any) -> VenueRecord | None:
    if not isinstance(value, dict) or not value.get("id"):
        return None
    location = value.get("location") or {}
    try:
        lat = float(str(location.get("latitude")))
        lng = float(str(location.get("longitude")))
    except ValueError:
        return None
    if lat == 0.0 and lng == 0.0:
        return None
    name = str(value.get("name") or "").strip()
    if not name:
        return None
    address = value.get("address") or {}
    line = ", ".join(p for p in (address.get("line1"), address.get("line2")) if p)
    return VenueRecord(
        external_id=str(value["id"]),
        name=name,
        lat=lat,
        lng=lng,
        freeform=line or None,
        locality=(value.get("city") or {}).get("name") or None,
        region=(value.get("state") or {}).get("stateCode") or None,
        postcode=value.get("postalCode") or None,
        country=(value.get("country") or {}).get("countryCode") or None,
    )


def _prices(ranges: Any) -> tuple[float | None, float | None, str | None]:
    if not isinstance(ranges, list):
        return None, None, None
    mins, maxs, currency = [], [], None
    for r in ranges:
        if not isinstance(r, dict):
            continue
        if isinstance(r.get("min"), (int, float)) and r["min"] >= 0:
            mins.append(float(r["min"]))
        if isinstance(r.get("max"), (int, float)) and r["max"] >= 0:
            maxs.append(float(r["max"]))
        currency = currency or r.get("currency")
    return (min(mins) if mins else None), (max(maxs) if maxs else None), currency


def _category(classifications: Any) -> str | None:
    if not isinstance(classifications, list) or not classifications:
        return None
    primary = next(
        (c for c in classifications if isinstance(c, dict) and c.get("primary")),
        classifications[0],
    )
    segment = ((primary or {}).get("segment") or {}).get("name")
    return SEGMENT_SLUGS.get(str(segment)) if segment else None


def _image(images: Any) -> str | None:
    if not isinstance(images, list):
        return None
    candidates = [
        i for i in images
        if isinstance(i, dict) and i.get("url") and not i.get("fallback")
    ] or [i for i in images if isinstance(i, dict) and i.get("url")]
    if not candidates:
        return None
    best = max(candidates, key=lambda i: (i.get("ratio") == "16_9", int(i.get("width") or 0)))
    return str(best["url"])
