"""
Eventbrite connector (official API v3).

Eventbrite removed public event search (/v3/events/search/ returns 404), so
discovery is target-based: each ingest.sources row names an organizer or a
venue, and we list its public events. Verified 2026-09-26 against the live API.
"""
from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime
from typing import Any, ClassVar, Literal

import httpx
from pydantic import BaseModel, Field

from scaper.connectors.base import Connector
from scaper.http import ConnectorError, RetryingClient
from scaper.models import EventRecord, EventStatus, ExtractResult, RawItem, Rejected, VenueRecord

BASE_URL = "https://www.eventbriteapi.com/v3"
EXPAND = "venue,ticket_availability,category"
DESCRIPTION_MAX = 2000

# Eventbrite top-level category id -> Rovvy category slug.
CATEGORY_SLUGS: dict[str, str] = {
    "101": "business",
    "102": "tech",
    "103": "music",
    "104": "film",
    "105": "arts",
    "106": "fashion",
    "107": "wellness",
    "108": "sports",
    "109": "outdoors",
    "110": "food",
    "111": "charity",
    "112": "community",
    "113": "community",
    "114": "community",
    "115": "family",
    "116": "holiday",
    "117": "lifestyle",
    "118": "auto",
    "119": "hobbies",
    "120": "family",
    "199": "other",
}

_STATUS: dict[str, EventStatus] = {
    "live": "scheduled",
    "started": "scheduled",
    "canceled": "cancelled",
    "ended": "completed",
    "completed": "completed",
}


class EventbriteSourceConfig(BaseModel):
    kind: Literal["organizer", "venue"]
    id: str = Field(pattern=r"^\d+$")
    max_pages: int = Field(default=10, ge=1, le=50)


class EventbriteConnector(Connector):
    name: ClassVar[str] = "eventbrite"
    config_model: ClassVar[type[BaseModel]] = EventbriteSourceConfig

    def __init__(self, token: str, client: RetryingClient | None = None) -> None:
        if not token.strip():
            raise ConnectorError("EVENTBRITE_TOKEN is not set")
        self._client = client or RetryingClient(
            httpx.Client(
                timeout=20.0,
                headers={"Authorization": f"Bearer {token.strip()}"},
            )
        )

    def fetch(self, config: dict[str, Any]) -> Iterator[RawItem]:
        cfg = EventbriteSourceConfig.model_validate(config)
        self.last_fetch_complete = False
        url = f"{BASE_URL}/{cfg.kind}s/{cfg.id}/events/"
        # 'started' keeps in-progress events ("happening now"); 'canceled' lets
        # cancellations overwrite rows we already published.
        params: dict[str, Any] = {
            "status": "live,started,canceled",
            "order_by": "start_asc",
            "expand": EXPAND,
        }

        for _ in range(cfg.max_pages):
            body = self._client.get_json(url, params=params)
            for event in body.get("events") or []:
                if isinstance(event, dict) and event.get("id"):
                    yield RawItem(external_id=str(event["id"]), payload=event)
            pagination = body.get("pagination") or {}
            if not pagination.get("has_more_items"):
                self.last_fetch_complete = True
                return
            continuation = pagination.get("continuation")
            if continuation:
                params = {**params, "continuation": continuation}
            else:
                params = {**params, "page": int(pagination.get("page_number") or 1) + 1}

    def extract(self, payload: dict[str, Any]) -> ExtractResult:
        if payload.get("online_event"):
            return Rejected(reason="online event")
        if payload.get("listed") is False:
            return Rejected(reason="unlisted event")
        raw_status = str(payload.get("status") or "")
        if raw_status not in _STATUS:
            return Rejected(reason=f"status {raw_status or 'missing'}")

        title = _text(payload.get("name"))
        if not title:
            return Rejected(reason="missing title")
        start = payload.get("start") or {}
        starts_at = _parse_utc(start.get("utc"))
        if starts_at is None:
            return Rejected(reason="missing start time")
        venue = _venue(payload.get("venue"))
        if venue is None:
            return Rejected(reason="no venue coordinates")

        tickets = payload.get("ticket_availability") or {}
        status = _STATUS[raw_status]
        if status == "scheduled" and tickets.get("is_sold_out"):
            status = "sold_out"
        is_free = payload.get("is_free")
        price_min = _price(tickets.get("minimum_ticket_price"))
        price_max = _price(tickets.get("maximum_ticket_price"))
        if is_free:
            price_min = price_max = 0.0

        description = payload.get("summary") or _text(payload.get("description"))
        return EventRecord(
            external_id=str(payload["id"]),
            title=title,
            description=description[:DESCRIPTION_MAX] if description else None,
            category=_category(payload),
            starts_at=starts_at,
            ends_at=_parse_utc((payload.get("end") or {}).get("utc")),
            timezone=start.get("timezone"),
            status=status,
            is_free=bool(is_free) if is_free is not None else None,
            price_min=price_min,
            price_max=price_max,
            currency=payload.get("currency") or None,
            url=payload.get("url") or None,
            image_url=_image(payload.get("logo")),
            venue=venue,
        )


def _text(value: Any) -> str:
    if isinstance(value, dict):
        value = value.get("text")
    return str(value).strip() if value else ""


def _parse_utc(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else None


def _price(value: Any) -> float | None:
    if not isinstance(value, dict) or value.get("major_value") in (None, ""):
        return None
    try:
        return float(value["major_value"])
    except (TypeError, ValueError):
        return None


def _venue(value: Any) -> VenueRecord | None:
    if not isinstance(value, dict) or not value.get("id"):
        return None
    address = value.get("address") or {}
    try:
        lat = float(str(value.get("latitude") or address.get("latitude")))
        lng = float(str(value.get("longitude") or address.get("longitude")))
    except ValueError:
        return None
    if lat == 0.0 and lng == 0.0:
        return None
    name = str(value.get("name") or "").strip()
    if not name:
        return None
    line = ", ".join(p for p in (address.get("address_1"), address.get("address_2")) if p)
    return VenueRecord(
        external_id=str(value["id"]),
        name=name,
        lat=lat,
        lng=lng,
        freeform=line or None,
        locality=address.get("city") or None,
        region=address.get("region") or None,
        postcode=address.get("postal_code") or None,
        country=address.get("country") or None,
    )


def _category(payload: dict[str, Any]) -> str | None:
    category = payload.get("category") or {}
    category_id = str(payload.get("category_id") or category.get("id") or "")
    if category_id in CATEGORY_SLUGS:
        return CATEGORY_SLUGS[category_id]
    short = category.get("short_name")
    return str(short).strip().lower() if short else None


def _image(logo: Any) -> str | None:
    if not isinstance(logo, dict):
        return None
    original = logo.get("original")
    if isinstance(original, dict) and original.get("url"):
        return str(original["url"])
    return str(logo["url"]) if logo.get("url") else None
