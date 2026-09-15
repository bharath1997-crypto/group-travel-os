"""Future-event questions backed by event feed data — not model invention."""

from __future__ import annotations

import re
from typing import Any

from app.schemas.ai_assistant import AIAssistantResponse, WayraSource
from app.services.events_service import get_events_for_place
from app.services.wayra_intent import normalize_query

_FUTURE_EVENT_RE = re.compile(
    r"\b(parade|festival|festivals|upcoming|this month|next weekend|"
    r"events planned|event is going|victory day|celebration|will there be|"
    r"are there upcoming|what events|what will .+ look like in 20)\b",
    re.I,
)


def is_future_event_question(message: str) -> bool:
    return bool(_FUTURE_EVENT_RE.search(normalize_query(message)))


def _city_label(place: dict[str, Any]) -> str:
    city = place.get("city")
    country = place.get("country")
    if isinstance(city, str) and city.strip():
        if isinstance(country, str) and country.strip():
            return f"{city.strip()}, {country.strip()}"
        return city.strip()
    return str(place.get("name") or "this location")


def try_future_events_reply(
    message: str,
    place: dict[str, Any] | None,
) -> AIAssistantResponse | None:
    if not is_future_event_question(message) or not place:
        return None

    label = str(place.get("name") or "this location")
    city_s = _city_label(place)

    if not place.get("city") and not (place.get("lat") and place.get("lng")):
        return AIAssistantResponse(
            message=(
                f"I can't search upcoming events until a city is resolved for {label}. "
                "Pick a city-level pin or attach a clearer place label."
            ),
            sources=[],
            summary={
                "intent": "future_events",
                "local": True,
                "provider": "local",
                "time_sensitive_data_available": False,
            },
        )

    events = get_events_for_place(place)
    if not events:
        return AIAssistantResponse(
            message=(
                f"No upcoming events were found in Rovvy's event feed for {city_s} right now. "
                "Check official city or venue calendars for parades, festivals, and Kremlin schedules."
            ),
            sources=[],
            summary={
                "intent": "future_events",
                "local": True,
                "provider": "local",
                "time_sensitive_data_available": False,
            },
        )

    lines = [f"Upcoming events near {label} from Rovvy's event feed:"]
    sources: list[WayraSource] = []
    for ev in events[:5]:
        name = str(ev.get("name") or "Event")
        date_s = str(ev.get("date") or "date TBA")
        venue = str(ev.get("venue") or "")
        url = str(ev.get("url") or "")
        venue_part = f" at {venue}" if venue else ""
        lines.append(f"• {name} — {date_s}{venue_part}")
        if url:
            sources.append(
                WayraSource(
                    label=f"Event · {name[:40]}",
                    url=url,
                    source_type="event",
                    snippet=date_s,
                )
            )

    lines.append(
        f"These listings are within the search radius of {label}. "
        "Dates can change — open an event link to confirm."
    )
    return AIAssistantResponse(
        message="\n".join(lines)[:1200],
        sources=sources[:5],
        summary={
            "intent": "future_events",
            "local": True,
            "provider": "local",
            "time_sensitive_data_available": True,
        },
    )
