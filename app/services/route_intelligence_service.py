"""
Route Intelligence Service — deterministic backend resolver.

Classifies origin→destination distance, detects international travel,
builds structured RouteOption objects with realistic segment plans.

Rules:
- No Google Maps data stored.
- No invented flight numbers, exact prices, or schedules.
- Segment plans use known geographic hubs (airport city names, not codes).
- All pricing is "estimated" or "live_provider_required".
"""
from __future__ import annotations

import logging
import math
from typing import Any

from app.schemas.route_intelligence import (
    LocationSummary,
    ProviderStatus,
    RouteIntelligenceResponse,
    RouteOption,
    RouteOptionType,
    RouteSegment,
    RouteSegmentType,
)

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────

# Approximate known air hub cities keyed by country ISO-3166 (lowercase).
# Used to suggest realistic connection hubs for international routes.
_AIR_HUBS: dict[str, list[str]] = {
    "india": ["Delhi", "Mumbai", "Kolkata", "Chennai", "Bengaluru", "Hyderabad"],
    "united states": ["New York", "Los Angeles", "Chicago", "Houston", "Dallas", "San Francisco", "Atlanta", "Seattle", "Boston", "Miami"],
    "united kingdom": ["London"],
    "germany": ["Frankfurt", "Munich"],
    "france": ["Paris"],
    "netherlands": ["Amsterdam"],
    "uae": ["Dubai"],
    "united arab emirates": ["Dubai"],
    "qatar": ["Doha"],
    "singapore": ["Singapore"],
    "japan": ["Tokyo", "Osaka"],
    "china": ["Beijing", "Shanghai", "Guangzhou"],
    "australia": ["Sydney", "Melbourne", "Brisbane"],
    "canada": ["Toronto", "Vancouver", "Montreal"],
    "thailand": ["Bangkok"],
    "malaysia": ["Kuala Lumpur"],
    "turkey": ["Istanbul"],
    "south korea": ["Seoul"],
    "hong kong": ["Hong Kong"],
}

# Known Indian city → nearest major airport city
_INDIA_CITY_HUB_MAP: dict[str, str] = {
    "bhubaneswar": "Kolkata",  # nearest major int'l hub
    "puri": "Bhubaneswar",
    "cuttack": "Bhubaneswar",
    "visakhapatnam": "Hyderabad",
    "vijayawada": "Hyderabad",
    "varanasi": "Delhi",
    "agra": "Delhi",
    "jaipur": "Delhi",
    "lucknow": "Delhi",
    "patna": "Delhi",
    "ranchi": "Kolkata",
    "guwahati": "Kolkata",
    "coimbatore": "Chennai",
    "madurai": "Chennai",
    "thiruvananthapuram": "Bengaluru",
    "kochi": "Bengaluru",
}

LOCAL_THRESHOLD_KM = 150
FAR_THRESHOLD_KM = 800
INTERNATIONAL_THRESHOLD_KM = 2000


# ── Haversine ─────────────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Hub resolution ────────────────────────────────────────────────────────────

def _get_country_hubs(country: str | None) -> list[str]:
    if not country:
        return []
    return _AIR_HUBS.get(country.strip().lower(), [])


def _get_destination_hubs(dest: LocationSummary) -> list[str]:
    """
    Returns 1–3 realistic connecting hub cities for a destination.
    Checks city-level override map first, then country hubs.
    """
    name_lower = dest.name.strip().lower()
    if name_lower in _INDIA_CITY_HUB_MAP:
        override = _INDIA_CITY_HUB_MAP[name_lower]
        country_hubs = _get_country_hubs(dest.country)
        hubs = [override]
        for h in country_hubs:
            if h != override and len(hubs) < 3:
                hubs.append(h)
        return hubs

    country_hubs = _get_country_hubs(dest.country)
    return country_hubs[:3] if country_hubs else []


def _get_origin_city(origin: LocationSummary) -> str:
    """Best short label for the origin city."""
    return origin.name.split(",")[0].strip()


# ── Segment builders ──────────────────────────────────────────────────────────

def _local_transfer_segment(city: str, id_prefix: str) -> RouteSegment:
    return RouteSegment(
        id=f"{id_prefix}_local_transfer",
        type=RouteSegmentType.LOCAL_TRANSPORT,
        **{"fromName": f"{city} airport", "toName": "Final destination"},
        title=f"Local transfer in {city}",
        **{"estimatedDuration": "30–60 min", "providerStatus": "estimated"},
    )


def _origin_airport_segment(origin_city: str, id_prefix: str) -> RouteSegment:
    return RouteSegment(
        id=f"{id_prefix}_origin_drive",
        type=RouteSegmentType.DRIVE,
        **{"fromName": f"Current location ({origin_city})", "toName": f"{origin_city} airport"},
        title=f"Drive or rideshare to {origin_city} airport",
        **{"estimatedDuration": "30–60 min", "providerStatus": "estimated"},
    )


def _flight_segment(frm: str, to: str, id_prefix: str, status: ProviderStatus = "live_provider_required") -> RouteSegment:
    return RouteSegment(
        id=f"{id_prefix}_flight_{frm.lower().replace(' ', '_')}_{to.lower().replace(' ', '_')}",
        type=RouteSegmentType.FLIGHT,
        **{"fromName": f"{frm}", "toName": f"{to}"},
        title=f"Flight: {frm} → {to}",
        **{"providerStatus": status},
    )


def _connection_transfer_segment(hub: str, id_prefix: str) -> RouteSegment:
    return RouteSegment(
        id=f"{id_prefix}_transit_{hub.lower().replace(' ', '_')}",
        type=RouteSegmentType.TRANSFER,
        **{"fromName": f"{hub} airport", "toName": f"{hub} airport (connecting terminal)"},
        title=f"Connection transfer in {hub}",
        **{"estimatedDuration": "1–3 hours", "providerStatus": "estimated"},
    )


def _domestic_flight_segment(hub: str, dest: str, id_prefix: str) -> RouteSegment:
    return RouteSegment(
        id=f"{id_prefix}_domestic_{hub.lower().replace(' ', '_')}_{dest.lower().replace(' ', '_')}",
        type=RouteSegmentType.FLIGHT,
        **{"fromName": hub, "toName": dest},
        title=f"Domestic flight: {hub} → {dest}",
        **{"providerStatus": "live_provider_required"},
    )


def _train_bus_segment(frm: str, to: str, id_prefix: str) -> RouteSegment:
    return RouteSegment(
        id=f"{id_prefix}_train_bus_{frm.lower().replace(' ', '_')}_{to.lower().replace(' ', '_')}",
        type=RouteSegmentType.TRAIN,
        **{"fromName": frm, "toName": to},
        title=f"Train, bus, or private car: {frm} → {to}",
        **{"estimatedDuration": "2–6 hours", "providerStatus": "live_provider_required"},
        notes=["Check Indian Railways or bus operators for exact times and fares."],
    )


def _train_segment(
    frm: str,
    to: str,
    id_prefix: str,
    *,
    duration: str = "3–5 hours",
) -> RouteSegment:
    return RouteSegment(
        id=f"{id_prefix}_train_{frm.lower().replace(' ', '_')}_{to.lower().replace(' ', '_')}",
        type=RouteSegmentType.TRAIN,
        **{"fromName": frm, "toName": to},
        title=f"Train: {frm} → {to}",
        **{"estimatedDuration": duration, "providerStatus": "live_provider_required"},
        notes=["Check IRCTC or Indian Railways for live schedules and fares."],
    )


def _bus_segment(
    frm: str,
    to: str,
    id_prefix: str,
    *,
    duration: str = "1–2 hours",
) -> RouteSegment:
    return RouteSegment(
        id=f"{id_prefix}_bus_{frm.lower().replace(' ', '_')}_{to.lower().replace(' ', '_')}",
        type=RouteSegmentType.BUS,
        **{"fromName": frm, "toName": to},
        title=f"Bus: {frm} → {to}",
        **{"estimatedDuration": duration, "providerStatus": "live_provider_required"},
        notes=["Check APSRTC or local operators for village bus timings."],
    )


def _drive_segment(
    frm: str,
    to: str,
    id_prefix: str,
    *,
    duration: str = "2–4 hours",
) -> RouteSegment:
    return RouteSegment(
        id=f"{id_prefix}_drive_{frm.lower().replace(' ', '_')}_{to.lower().replace(' ', '_')}",
        type=RouteSegmentType.DRIVE,
        **{"fromName": frm, "toName": to},
        title=f"Private vehicle: {frm} → {to}",
        **{"estimatedDuration": duration, "providerStatus": "estimated"},
    )


def _matches_ap_village_destination(dest: LocationSummary) -> bool:
    """Villages and mandals in Guntur / Prakasam districts (Andhra Pradesh)."""
    if (dest.country or "").strip().lower() not in ("india", "in"):
        return False
    blob = dest.name.strip().lower()
    markers = (
        "guntur",
        "prakasam",
        "prakasam",
        "pennandipadu",
        "rajupala",
        "andhra",
        "amaravati",
        "tenali",
        "ongole",
        "vijayawada",
        "mandals",
        "mandal",
    )
    return any(marker in blob for marker in markers)


def _ap_village_public_option(
    origin_city: str,
    dest_name: str,
    *,
    arrival_hub: str = "Hyderabad",
    prefer_public: bool,
) -> RouteOption:
    option_id = "ap_public_transport"
    return RouteOption(
        id=option_id,
        title="Flight + train + bus (public transport)",
        type=RouteOptionType.FLIGHT_MULTIMODAL,
        recommended=prefer_public,
        **{"bestFor": "no private vehicle after landing in India"},
        **{"estimatedDuration": "24–36 hours total"},
        **{"providerStatus": "live_provider_required"},
        segments=[
            _origin_airport_segment(origin_city, option_id),
            _flight_segment(origin_city, arrival_hub, option_id),
            _train_segment(arrival_hub, "Guntur", option_id, duration="4–6 hours"),
            _bus_segment("Guntur", "Pennandipadu", option_id, duration="1–2 hours"),
            _bus_segment("Pennandipadu", dest_name, option_id, duration="30–90 min"),
        ],
        notes=[
            "Search international flights on the Travel → Flights tab.",
            "After Hyderabad, use Indian Railways for Guntur and APSRTC/local buses to the village.",
        ],
    )


def _ap_village_private_option(
    origin_city: str,
    dest_name: str,
    *,
    arrival_hub: str = "Hyderabad",
    prefer_public: bool,
) -> RouteOption:
    option_id = "ap_private_vehicle"
    return RouteOption(
        id=option_id,
        title="Flight + private vehicle in India",
        type=RouteOptionType.PRIVATE_VEHICLE,
        recommended=not prefer_public,
        **{"bestFor": "your own car or hired taxi after landing"},
        **{"estimatedDuration": "22–30 hours total"},
        **{"providerStatus": "live_provider_required"},
        segments=[
            _origin_airport_segment(origin_city, option_id),
            _flight_segment(origin_city, arrival_hub, option_id),
            _drive_segment(arrival_hub, dest_name, option_id, duration="4–6 hours"),
        ],
        notes=[
            "Book flights on the Travel → Flights tab, then drive or hire a car from Hyderabad.",
        ],
    )


def _border_crossing_segment(from_country: str, to_country: str, id_prefix: str) -> RouteSegment:
    return RouteSegment(
        id=f"{id_prefix}_border_{from_country.lower().replace(' ', '_')}",
        type=RouteSegmentType.BORDER_CROSSING,
        **{"fromName": f"{from_country} border", "toName": f"{to_country} entry"},
        title=f"Border / immigration crossing",
        notes=[
            "Ensure valid passport and required visa for destination country.",
            "Processing time varies — allow 1–3 hours.",
        ],
        **{"providerStatus": "estimated"},
    )


def _road_trip_option(origin: LocationSummary, destination: LocationSummary, distance_km: float) -> RouteOption:
    hours = distance_km / 80.0
    h = int(hours)
    m = int((hours - h) * 60)
    duration_str = f"{h}h {m}m drive" if h > 0 else f"{m}m drive"
    origin_city = _get_origin_city(origin)
    dest_name = destination.name

    return RouteOption(
        id="road_trip",
        title="Road trip",
        type=RouteOptionType.ROAD_TRIP,
        recommended=False,
        **{"bestFor": "scenic drive or when no flights available"},
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
    )


# ── Main resolver ─────────────────────────────────────────────────────────────

class RouteIntelligenceService:
    """
    Deterministic backend resolver.
    No AI calls — pure geographic reasoning.
    """

    @staticmethod
    def resolve(
        origin: LocationSummary,
        destination: LocationSummary,
        user_preference: str | None = None,
    ) -> RouteIntelligenceResponse:
        distance_km = _haversine_km(
            origin.lat, origin.lng, destination.lat, destination.lng
        )

        origin_country = (origin.country or "").strip().lower()
        dest_country = (destination.country or "").strip().lower()
        is_international = (
            origin_country != dest_country
            and bool(origin_country)
            and bool(dest_country)
        )

        options: list[RouteOption] = []
        requires_border = False

        # ── Local / Regional (< 150 km) ───────────────────────────────────────
        if distance_km <= LOCAL_THRESHOLD_KM:
            options.append(_road_trip_option(origin, destination, distance_km))

        # ── Far domestic / regional (150–800 km) ─────────────────────────────
        elif distance_km <= FAR_THRESHOLD_KM and not is_international:
            options.append(_road_trip_option(origin, destination, distance_km))
            origin_city = _get_origin_city(origin)
            dest_name = destination.name
            dest_hubs = _get_destination_hubs(destination)
            if dest_hubs:
                hub = dest_hubs[0]
                options.append(
                    RouteOption(
                        id="domestic_flight",
                        title=f"Direct or connecting flight",
                        type=RouteOptionType.FLIGHT_CONNECTION,
                        recommended=True,
                        **{"bestFor": "fastest option"},
                        **{"providerStatus": "live_provider_required"},
                        segments=[
                            _origin_airport_segment(origin_city, "domestic_flight"),
                            _flight_segment(origin_city, dest_name, "domestic_flight"),
                            _local_transfer_segment(dest_name, "domestic_flight"),
                        ],
                    )
                )
            options.append(
                RouteOption(
                    id="train_bus",
                    title="Train or bus",
                    type=RouteOptionType.TRAIN_ROUTE,
                    recommended=False,
                    **{"bestFor": "budget travel"},
                    **{"providerStatus": "live_provider_required"},
                    segments=[
                        _train_bus_segment(origin_city, dest_name, "train_bus"),
                        _local_transfer_segment(dest_name, "train_bus"),
                    ],
                )
            )

        # ── International / Long-distance (> 800 km or cross-country) ─────────
        else:
            origin_city = _get_origin_city(origin)
            dest_name = destination.name
            dest_hubs = _get_destination_hubs(destination)
            prefer_public = (user_preference or "").strip().lower() == "public"

            if is_international and _matches_ap_village_destination(destination):
                options.append(
                    _ap_village_public_option(
                        origin_city,
                        dest_name,
                        arrival_hub="Hyderabad",
                        prefer_public=prefer_public,
                    )
                )
                options.append(
                    _ap_village_private_option(
                        origin_city,
                        dest_name,
                        arrival_hub="Hyderabad",
                        prefer_public=prefer_public,
                    )
                )

            # Check if road crossing international border is involved
            if is_international and distance_km <= INTERNATIONAL_THRESHOLD_KM:
                requires_border = True

            if not dest_hubs:
                # No known hubs — generic direct flight option
                options.append(
                    RouteOption(
                        id="direct_flight",
                        title="Direct or connecting flight",
                        type=RouteOptionType.FLIGHT_CONNECTION,
                        recommended=True,
                        **{"bestFor": "fastest international connection"},
                        **{"providerStatus": "live_provider_required"},
                        segments=[
                            _origin_airport_segment(origin_city, "direct_flight"),
                            _flight_segment(origin_city, dest_name, "direct_flight"),
                            _local_transfer_segment(dest_name, "direct_flight"),
                        ],
                    )
                )
            else:
                # Build up to 3 hub-based options
                option_index = 0
                for i, hub in enumerate(dest_hubs[:3]):
                    is_hub_same_as_dest = hub.lower() == dest_name.lower()
                    option_id = f"via_{hub.lower().replace(' ', '_')}"
                    is_recommended = i == 0

                    if is_hub_same_as_dest:
                        # Direct flight to destination (it IS the hub)
                        seg_list = [
                            _origin_airport_segment(origin_city, option_id),
                            _flight_segment(origin_city, dest_name, option_id),
                            _local_transfer_segment(dest_name, option_id),
                        ]
                        option_type = RouteOptionType.FLIGHT_CONNECTION
                        best_for = "direct connection" if i == 0 else f"alternative via {hub}"
                    else:
                        # Hub-and-spoke: origin → hub → destination
                        # Check if last segment can be train/bus (budget option)
                        last_is_ground = i == len(dest_hubs) - 1 and i > 0

                        if last_is_ground:
                            # Budget option: flight to hub, then train/bus to destination
                            seg_list = [
                                _origin_airport_segment(origin_city, option_id),
                                _flight_segment(origin_city, hub, option_id),
                                _train_bus_segment(hub, dest_name, option_id),
                                _local_transfer_segment(dest_name, option_id),
                            ]
                            option_type = RouteOptionType.BUDGET_ROUTE
                            best_for = f"budget or local travel inside {dest_country.title() or 'destination country'}"
                        else:
                            seg_list = [
                                _origin_airport_segment(origin_city, option_id),
                                _flight_segment(origin_city, hub, option_id),
                                _connection_transfer_segment(hub, option_id),
                                _domestic_flight_segment(hub, dest_name, option_id),
                                _local_transfer_segment(dest_name, option_id),
                            ]
                            option_type = RouteOptionType.FLIGHT_CONNECTION
                            best_for = (
                                "fastest international connection"
                                if i == 0
                                else f"alternative connection via {hub}"
                            )

                    options.append(
                        RouteOption(
                            id=option_id,
                            title=f"Flight via {hub}" if not is_hub_same_as_dest else "Direct flight",
                            type=option_type,
                            recommended=is_recommended,
                            **{"bestFor": best_for},
                            **{"providerStatus": "live_provider_required"},
                            segments=seg_list,
                        )
                    )
                    option_index += 1

            # Always add border segment note if crossing country by road is relevant
            if requires_border and is_international:
                options.append(
                    RouteOption(
                        id="road_crossing",
                        title="Overland / road crossing",
                        type=RouteOptionType.ROAD_TRIP,
                        recommended=False,
                        **{"bestFor": "adventurous overland route (check border regulations)"},
                        **{"providerStatus": "estimated"},
                        segments=[
                            RouteSegment(
                                id="road_crossing_drive",
                                type=RouteSegmentType.DRIVE,
                                **{"fromName": origin_city, "toName": dest_name},
                                title=f"Drive: {origin_city} → {dest_name}",
                                **{"providerStatus": "estimated"},
                            ),
                            _border_crossing_segment(
                                origin_country.title(), dest_country.title(), "road_crossing"
                            ),
                        ],
                        notes=["Visa and border permit required. Check current border status before travel."],
                    )
                )

        return RouteIntelligenceResponse(
            origin=origin,
            destination=destination,
            route_options=options,
            distance_km=round(distance_km, 1),
            is_international=is_international,
            requires_border_crossing=requires_border,
        )
