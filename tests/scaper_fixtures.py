"""Eventbrite v3 payloads shaped like live /organizers/{id}/events/?expand=venue,ticket_availability,category."""
from __future__ import annotations

import copy
from typing import Any

_EVENT: dict[str, Any] = {
    "id": "1000000000001",
    "name": {"text": "Rooftop Jazz Night", "html": "Rooftop Jazz Night"},
    "summary": "Live jazz trio on the roof every Friday.",
    "description": {"text": "Longer description", "html": "<p>Longer description</p>"},
    "url": "https://www.eventbrite.com/e/rooftop-jazz-night-tickets-1000000000001",
    "start": {"timezone": "America/Chicago", "local": "2099-10-02T19:00:00", "utc": "2099-10-03T00:00:00Z"},
    "end": {"timezone": "America/Chicago", "local": "2099-10-02T22:00:00", "utc": "2099-10-03T03:00:00Z"},
    "status": "live",
    "currency": "USD",
    "listed": True,
    "online_event": False,
    "is_free": False,
    "category_id": "103",
    "category": {"id": "103", "name": "Music", "short_name": "Music"},
    "logo": {"url": "https://img.evbuc.com/crop.jpg", "original": {"url": "https://img.evbuc.com/original.jpg"}},
    "organizer_id": "5550001",
    "venue_id": "7770001",
    "venue": {
        "id": "7770001",
        "name": "The Rooftop",
        "latitude": "41.8881",
        "longitude": "-87.6298",
        "address": {
            "address_1": "100 W Wacker Dr",
            "address_2": "",
            "city": "Chicago",
            "region": "IL",
            "postal_code": "60601",
            "country": "US",
            "latitude": "41.8881",
            "longitude": "-87.6298",
        },
    },
    "ticket_availability": {
        "has_available_tickets": True,
        "is_sold_out": False,
        "minimum_ticket_price": {"major_value": "15.00", "currency": "USD"},
        "maximum_ticket_price": {"major_value": "40.00", "currency": "USD"},
    },
}


def eventbrite_event(**overrides: Any) -> dict[str, Any]:
    event = copy.deepcopy(_EVENT)
    event.update(overrides)
    return event


def eventbrite_page(events: list[dict[str, Any]], *, continuation: str | None = None) -> dict[str, Any]:
    return {
        "pagination": {
            "object_count": len(events),
            "page_number": 1,
            "page_size": 50,
            "has_more_items": continuation is not None,
            **({"continuation": continuation} if continuation else {}),
        },
        "events": events,
    }


# Ticketmaster Discovery v2 /events.json shape (live sample 2026-09-26, values synthetic).
_TM_EVENT: dict[str, Any] = {
    "id": "tmEvent0001",
    "name": "Indie Night Live",
    "type": "event",
    "test": False,
    "url": "https://www.ticketmaster.com/event/tmEvent0001",
    "info": "All ages.",
    "distance": 1.84,
    "units": "KILOMETERS",
    "_links": {"self": {"href": "/discovery/v2/events/tmEvent0001"}},
    "images": [
        {"ratio": "3_2", "url": "https://s1.ticketm.net/small.jpg", "width": 305, "fallback": False},
        {"ratio": "16_9", "url": "https://s1.ticketm.net/wide.jpg", "width": 1024, "fallback": False},
        {"ratio": "16_9", "url": "https://s1.ticketm.net/fallback.jpg", "width": 2048, "fallback": True},
    ],
    "dates": {
        "start": {"localDate": "2026-10-02", "localTime": "20:00:00", "dateTime": "2026-10-03T00:00:00Z"},
        "end": {"approximate": False, "noSpecificTime": False},
        "timezone": "America/New_York",
        "status": {"code": "onsale"},
    },
    "priceRanges": [
        {"type": "standard", "currency": "USD", "min": 20.0, "max": 45.5},
        {"type": "standard including fees", "currency": "USD", "min": 24.1, "max": 52.0},
    ],
    "classifications": [
        {"primary": False, "segment": {"name": "Sports"}},
        {"primary": True, "segment": {"name": "Music"}, "genre": {"name": "Rock"}},
    ],
    "_embedded": {
        "venues": [
            {
                "id": "tmVenue0001",
                "name": "Mills Ave Hall",
                "timezone": "America/New_York",
                "location": {"longitude": "-81.3647185", "latitude": "28.5598651"},
                "address": {"line1": "1042 N Mills Ave"},
                "city": {"name": "Orlando"},
                "state": {"name": "Florida", "stateCode": "FL"},
                "postalCode": "32803",
                "country": {"name": "United States Of America", "countryCode": "US"},
            }
        ]
    },
}


def ticketmaster_event(**overrides: Any) -> dict[str, Any]:
    event = copy.deepcopy(_TM_EVENT)
    event.update(overrides)
    return event


def ticketmaster_page(events: list[dict[str, Any]], *, number: int, total_pages: int, total: int) -> dict[str, Any]:
    body: dict[str, Any] = {"page": {"size": 200, "totalElements": total, "totalPages": total_pages, "number": number}}
    if events:
        body["_embedded"] = {"events": events}
    return body
