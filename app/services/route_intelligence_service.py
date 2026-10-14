"""
Route Intelligence Service — deterministic ground-only resolver.

Builds structured RouteOption objects for drive / transit planning hints.
No invented schedules or fares (F15).
"""
from __future__ import annotations

import logging
import math

from app.schemas.route_intelligence import (
    LocationSummary,
    RouteIntelligenceResponse,
    RouteOption,
    RouteOptionType,
    RouteSegment,
    RouteSegmentType,
)

logger = logging.getLogger(__name__)

LOCAL_THRESHOLD_KM = 150
DOMESTIC_TRANSIT_HINT_MAX_KM = 800
MAX_ROAD_ESTIMATE_KM = 1_200
INTERNATIONAL_GROUND_MAX_KM = 800


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _origin_label(origin: LocationSummary) -> str:
    return origin.name.split(",")[0].strip()


def _drive_duration_label(distance_km: float) -> str:
    hours = distance_km / 80.0
    h = int(hours)
    m = int((hours - h) * 60)
    if h > 0:
        return f"{h}h {m}m drive (estimate)"
    return f"{m}m drive (estimate)"


def _road_trip_option(
    origin: LocationSummary,
    destination: LocationSummary,
    distance_km: float,
    *,
    recommended: bool,
) -> RouteOption:
    origin_city = _origin_label(origin)
    dest_name = destination.name
    duration_str = _drive_duration_label(distance_km)
    return RouteOption(
        id="road_trip",
        title="Drive",
        type=RouteOptionType.ROAD_TRIP,
        recommended=recommended,
        **{"bestFor": "private vehicle or rideshare"},
        **{"estimatedDuration": duration_str},
        **{"providerStatus": "estimated"},
        segments=[
            RouteSegment(
                id="road_trip_drive",
                type=RouteSegmentType.DRIVE,
                **{"fromName": origin_city, "toName": dest_name},
                title=f"Drive: {origin_city} → {dest_name}",
                **{"estimatedDuration": duration_str, "providerStatus": "estimated"},
            )
        ],
        notes=["Open Plan → Routes for turn-by-turn driving directions from Google."],
    )


def _transit_hint_option(origin: LocationSummary, destination: LocationSummary) -> RouteOption:
    origin_city = _origin_label(origin)
    dest_name = destination.name
    return RouteOption(
        id="transit_directions",
        title="Transit & multimodal ground",
        type=RouteOptionType.TRAIN_ROUTE,
        recommended=False,
        **{"bestFor": "bus, train, or mixed ground transit"},
        **{"providerStatus": "live_provider_required"},
        segments=[
            RouteSegment(
                id="transit_hint",
                type=RouteSegmentType.LOCAL_TRANSPORT,
                **{"fromName": origin_city, "toName": dest_name},
                title="Search ground directions",
                **{"providerStatus": "live_provider_required"},
                notes=["Use Plan → Routes to compare transit and driving options from Google."],
            )
        ],
    )


def _overland_border_option(
    origin: LocationSummary,
    destination: LocationSummary,
    origin_country: str,
    dest_country: str,
) -> RouteOption:
    origin_city = _origin_label(origin)
    dest_name = destination.name
    return RouteOption(
        id="overland_border",
        title="Overland (border crossing)",
        type=RouteOptionType.ROAD_TRIP,
        recommended=True,
        **{"bestFor": "drive or bus where borders allow"},
        **{"providerStatus": "live_provider_required"},
        segments=[
            RouteSegment(
                id="overland_drive",
                type=RouteSegmentType.DRIVE,
                **{"fromName": origin_city, "toName": dest_name},
                title=f"Ground route: {origin_city} → {dest_name}",
                **{"providerStatus": "live_provider_required"},
            ),
            RouteSegment(
                id="overland_border",
                type=RouteSegmentType.BORDER_CROSSING,
                **{"fromName": origin_country, "toName": dest_country},
                title="Border / immigration",
                notes=[
                    "Confirm visas, permits, and border hours before travel.",
                    "Use Plan → Routes for local driving and transit segments.",
                ],
                **{"providerStatus": "live_provider_required"},
            ),
        ],
    )


class RouteIntelligenceService:
    """Deterministic ground-only resolver — no AI calls."""

    @staticmethod
    def resolve(
        origin: LocationSummary,
        destination: LocationSummary,
        user_preference: str | None = None,
    ) -> RouteIntelligenceResponse:
        _ = user_preference

        distance_km = _haversine_km(
            origin.lat, origin.lng, destination.lat, destination.lng
        )
        origin_country = (origin.country or "").strip()
        dest_country = (destination.country or "").strip()
        origin_country_l = origin_country.lower()
        dest_country_l = dest_country.lower()
        is_international = (
            origin_country_l != dest_country_l
            and bool(origin_country_l)
            and bool(dest_country_l)
        )

        options: list[RouteOption] = []
        requires_border = False
        ground_unavailable_reason: str | None = None

        if is_international and distance_km > INTERNATIONAL_GROUND_MAX_KM:
            ground_unavailable_reason = (
                "Too far for ground directions between these countries. "
                "Rovvy supports drive, walk, and transit via Plan → Routes when Google can route locally."
            )
        elif is_international and distance_km <= INTERNATIONAL_GROUND_MAX_KM:
            requires_border = True
            options.append(
                _overland_border_option(
                    origin,
                    destination,
                    origin_country or "Origin",
                    dest_country or "Destination",
                )
            )
        elif distance_km <= LOCAL_THRESHOLD_KM:
            options.append(
                _road_trip_option(origin, destination, distance_km, recommended=True)
            )
        elif distance_km <= DOMESTIC_TRANSIT_HINT_MAX_KM:
            options.append(
                _road_trip_option(origin, destination, distance_km, recommended=True)
            )
            options.append(_transit_hint_option(origin, destination))
        elif distance_km <= MAX_ROAD_ESTIMATE_KM:
            options.append(
                _road_trip_option(origin, destination, distance_km, recommended=True)
            )
        else:
            ground_unavailable_reason = (
                "Too far for a single ground directions preview. "
                "Try Plan → Routes for segment-by-segment driving or transit where available."
            )

        if not options and ground_unavailable_reason is None:
            ground_unavailable_reason = "No ground route found for this origin and destination."

        return RouteIntelligenceResponse(
            origin=origin,
            destination=destination,
            route_options=options,
            distance_km=round(distance_km, 1),
            is_international=is_international,
            requires_border_crossing=requires_border,
            ground_unavailable_reason=ground_unavailable_reason,
        )
