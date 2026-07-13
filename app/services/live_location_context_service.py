"""
Live Tab — deterministic Location Context Engine (no AI).

Converts raw user/place inputs into compact structured context for UI warnings
and Rovi AI place explanation.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Any

from app.schemas.live_location_context import (
    LiveLocationContextRequest,
    LiveLocationContextResponse,
    LiveLocationInput,
    LiveSelectedPlaceInput,
    LocationClassification,
    LocationContextTemplate,
)

LOCAL_DISTANCE_MILES = 100.0
METERS_PER_MILE = 1609.34

UNSAFE_ACTIONS = [
    "Search near me",
    "Change destination",
    "Plan Trip",
    "Continue anyway",
]

LOCAL_ACTIONS = ["Make Destination", "Preview route"]

TEMPLATE_COPY: dict[LocationClassification, LocationContextTemplate] = {
    "local_place": LocationContextTemplate(
        summary="This place is near your current area.",
        recommendation="You can make it your destination and start Solo Live when ready.",
    ),
    "far_destination": LocationContextTemplate(
        summary="This place is far from your current area.",
        recommendation="Check the location before starting live travel.",
    ),
    "very_far_destination": LocationContextTemplate(
        summary="This place is far from your current area.",
        recommendation=(
            "This is not a normal Solo Live drive destination. "
            "Search nearby, plan it as a future trip, or continue only if intentional."
        ),
    ),
    "country_mismatch": LocationContextTemplate(
        summary="This destination appears to be in another country.",
        recommendation=(
            "Rovvy recommends planning it as a future trip "
            "instead of starting Solo Live now."
        ),
    ),
    "incomplete_place_data": LocationContextTemplate(
        summary="Some place details are limited.",
        recommendation="Check the address before continuing.",
    ),
}


@dataclass(frozen=True)
class BuiltLocationContext:
    user_location: LiveLocationInput | None
    selected_place: LiveSelectedPlaceInput
    workflow_type: str
    travel_mode: str
    live_stage: str
    distance_miles: float | None
    same_country: bool | None
    same_state: bool | None
    same_city: bool | None
    country_mismatch: bool
    state_mismatch: bool
    missing_address: bool
    missing_hours: bool
    missing_distance: bool
    data_quality_score: float
    user_area: str
    place_area: str


def _normalize_token(value: str | None) -> str:
    return (value or "").strip().lower()


def _normalize_workflow(value: str | None) -> str:
    token = _normalize_token(value).replace(" ", "_")
    if token in {"solo", "group_travel", "seat_share"}:
        return token
    if token == "group":
        return "group_travel"
    return "solo"


def _normalize_travel_mode(value: str | None) -> str:
    token = _normalize_token(value)
    if token in {"drive", "bike", "trek", "walk"}:
        return token
    return "drive"


def _normalize_live_stage(value: str | None) -> str:
    token = _normalize_token(value).replace("-", "_")
    allowed = {
        "static_landing",
        "place_preview",
        "destination_set",
        "long_distance_preview",
        "solo_drive_command",
        "solo_drive_navigation",
        "solo_live_active",
    }
    return token if token in allowed else "place_preview"


def _haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 3958.7613
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(a))


def _parse_address_parts(address: str | None) -> tuple[str | None, str | None, str | None]:
    if not address:
        return None, None, None
    parts = [part.strip() for part in address.split(",") if part.strip()]
    if not parts:
        return None, None, None
    country = parts[-1]
    state = parts[-2] if len(parts) >= 2 else None
    city = parts[-3] if len(parts) >= 3 else parts[0]
    return city, state, country


def _format_area(city: str | None, state: str | None, country: str | None) -> str:
    parts = [part for part in (city, state, country) if part and part.strip()]
    if not parts:
        return "Unknown area"
    return ", ".join(parts)


def _country_code(country: str | None) -> str | None:
    if not country:
        return None
    token = _normalize_token(country)
    aliases = {
        "us": "united states",
        "usa": "united states",
        "u.s.": "united states",
        "u.s.a.": "united states",
        "uk": "united kingdom",
        "u.k.": "united kingdom",
    }
    return aliases.get(token, token)


def _regions_match(a: str | None, b: str | None) -> bool | None:
    if not a or not b:
        return None
    return _country_code(a) == _country_code(b)


def _is_incomplete_place(place: LiveSelectedPlaceInput) -> bool:
    address = (place.address or "").strip()
    if len(address) < 8:
        return True
    if address == place.name.strip():
        return True
    if re.fullmatch(r"[-0-9.,\s]+", address):
        return True
    return False


def _enrich_place(place: LiveSelectedPlaceInput) -> LiveSelectedPlaceInput:
    city, state, country = _parse_address_parts(place.address)
    return LiveSelectedPlaceInput(
        name=place.name,
        address=place.address,
        lat=place.lat,
        lng=place.lng,
        city=place.city or city,
        state=place.state or state,
        country=place.country or country,
        category=place.category,
        source=place.source,
        has_opening_hours=place.has_opening_hours,
    )


def build_location_context(
    user_location: LiveLocationInput | None,
    selected_place: LiveSelectedPlaceInput,
    workflow_type: str | None = None,
    travel_mode: str | None = None,
    live_stage: str | None = None,
) -> BuiltLocationContext:
    place = _enrich_place(selected_place)

    distance_miles: float | None = None
    if (
        user_location
        and user_location.lat is not None
        and user_location.lng is not None
    ):
        distance_miles = round(
            _haversine_miles(
                user_location.lat,
                user_location.lng,
                place.lat,
                place.lng,
            ),
            1,
        )

    same_country = _regions_match(user_location.country if user_location else None, place.country)
    same_state = (
        _normalize_token(user_location.state if user_location else None)
        == _normalize_token(place.state)
        if user_location and user_location.state and place.state
        else None
    )
    same_city = (
        _normalize_token(user_location.city if user_location else None)
        == _normalize_token(place.city)
        if user_location and user_location.city and place.city
        else None
    )

    country_mismatch = same_country is False
    state_mismatch = same_state is False if same_state is not None else False
    missing_address = _is_incomplete_place(place)
    missing_hours = place.has_opening_hours is False
    missing_distance = distance_miles is None

    score = 1.0
    if missing_address:
        score -= 0.35
    if missing_hours:
        score -= 0.1
    if missing_distance:
        score -= 0.2
    if country_mismatch:
        score -= 0.2
    if state_mismatch:
        score -= 0.05
    data_quality_score = max(0.0, min(1.0, round(score, 2)))

    user_area = _format_area(
        user_location.city if user_location else None,
        user_location.state if user_location else None,
        user_location.country if user_location else None,
    )
    place_area = _format_area(place.city, place.state, place.country)

    return BuiltLocationContext(
        user_location=user_location,
        selected_place=place,
        workflow_type=_normalize_workflow(workflow_type),
        travel_mode=_normalize_travel_mode(travel_mode),
        live_stage=_normalize_live_stage(live_stage),
        distance_miles=distance_miles,
        same_country=same_country,
        same_state=same_state,
        same_city=same_city,
        country_mismatch=country_mismatch,
        state_mismatch=state_mismatch,
        missing_address=missing_address,
        missing_hours=missing_hours,
        missing_distance=missing_distance,
        data_quality_score=data_quality_score,
        user_area=user_area,
        place_area=place_area,
    )


def classify_location_context(context: BuiltLocationContext) -> LocationClassification:
    if context.country_mismatch:
        return "country_mismatch"
    if context.missing_address and (
        context.missing_distance or context.data_quality_score < 0.6
    ):
        return "incomplete_place_data"
    miles = context.distance_miles
    if miles is None:
        return "incomplete_place_data"
    if miles > LOCAL_DISTANCE_MILES:
        return "far_destination"
    if context.missing_address:
        return "incomplete_place_data"
    return "local_place"


def _is_future_trip_candidate(
    classification: LocationClassification,
    _context: BuiltLocationContext,
) -> bool:
    return classification == "country_mismatch"


def _is_live_safe(classification: LocationClassification, context: BuiltLocationContext) -> bool:
    if context.country_mismatch:
        return False
    if classification == "country_mismatch":
        return False
    return True


def _recommended_actions(live_safe: bool) -> list[str]:
    return list(UNSAFE_ACTIONS if not live_safe else LOCAL_ACTIONS)


def build_rovi_ai_compact_context(
    context: BuiltLocationContext,
    classification: LocationClassification,
    live_safe: bool,
    recommended_actions: list[str],
) -> dict[str, Any]:
    return {
        "user_area": context.user_area,
        "place_name": context.selected_place.name,
        "place_area": context.place_area,
        "distance_miles": context.distance_miles,
        "classification": classification,
        "travel_mode": context.travel_mode,
        "workflow_type": context.workflow_type,
        "live_safe": live_safe,
        "recommended_actions": recommended_actions,
    }


def resolve_location_context(request: LiveLocationContextRequest) -> LiveLocationContextResponse:
    built = build_location_context(
        request.user_location,
        request.selected_place,
        request.workflow_type,
        request.travel_mode,
        request.live_stage,
    )
    classification = classify_location_context(built)
    live_safe = _is_live_safe(classification, built)
    recommended_actions = _recommended_actions(live_safe)
    template = TEMPLATE_COPY[classification]
    compact = build_rovi_ai_compact_context(
        built,
        classification,
        live_safe,
        recommended_actions,
    )

    return LiveLocationContextResponse(
        distance_miles=built.distance_miles,
        same_country=built.same_country,
        same_state=built.same_state,
        same_city=built.same_city,
        country_mismatch=built.country_mismatch,
        state_mismatch=built.state_mismatch,
        missing_address=built.missing_address,
        missing_hours=built.missing_hours,
        missing_distance=built.missing_distance,
        data_quality_score=built.data_quality_score,
        classification=classification,
        future_trip_candidate=_is_future_trip_candidate(classification, built),
        live_safe=live_safe,
        user_area=built.user_area,
        place_area=built.place_area,
        recommended_actions=recommended_actions,
        template=template,
        compact=compact,
    )
