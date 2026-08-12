from __future__ import annotations

import asyncio
import logging
import math
import httpx

from app.schemas.live_routing import (
    RoutePreviewRequest,
    RoutePreviewResponse,
    GeoJSONGeometry,
    RouteManeuverOut,
    BorderCrossingOut,
    RouteAlternativeOut,
)
from app.services.border_crossing_service import BorderCrossingService
from config import settings

logger = logging.getLogger(__name__)

OSRM_BASE_URL = "https://router.project-osrm.org"
GOOGLE_ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"
LAST_MILE_THRESHOLD_M = 25.0
WALKING_SPEED_MPS = 1.3
APPROX_WALK_MAX_M = 80_000.0
LOCAL_LIVE_MAX_M = 100 * 1609.34
CROSS_OCEAN_DIRECT_M = 2_000_000.0
STRAIGHT_LINE_MAX_POINTS = 4
STRAIGHT_LINE_MIN_DIRECT_M = 80_000.0


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    return 2.0 * R * math.asin(math.sqrt(a))


def parse_osrm_instruction(step: dict) -> str:
    m = step.get("maneuver") or {}
    name = step.get("name") or "the route"
    m_type = m.get("type")
    modifier = m.get("modifier")

    if not m:
        return "Follow highlighted route"
    if m_type == "depart":
        return f"Head {modifier or 'straight'} on {name}"
    if m_type == "arrive":
        return "Arrive at destination"
    if m_type == "turn":
        return f"Turn {modifier or ''} onto {name}".replace("  ", " ")
    if m_type == "roundabout":
        return f"Take the roundabout onto {name}"
    if m_type == "merge":
        return f"Merge onto {name}"
    if m_type == "on ramp":
        return f"Take the ramp onto {name}"
    if m_type == "off ramp":
        return f"Take the exit onto {name}"
    if modifier:
        return f"Keep {modifier} toward {name}"
    return f"Continue onto {name}"


def extract_maneuvers(route_data: dict) -> list[RouteManeuverOut]:
    maneuvers = []
    legs = route_data.get("legs", [])
    if legs and len(legs) > 0:
        steps = legs[0].get("steps", [])
        for step in steps:
            maneuver_data = step.get("maneuver")
            if maneuver_data and "location" in maneuver_data:
                maneuvers.append(
                    RouteManeuverOut(
                        instruction=parse_osrm_instruction(step),
                        location=maneuver_data["location"],
                    )
                )
    return maneuvers


def format_last_mile_distance(meters: float) -> str:
    if meters < 160:
        rounded = int(round(meters))
        if rounded <= 0 and meters > 0:
            return "1 m"
        return f"{rounded} m"
    miles = meters / 1609.34
    if miles < 10:
        return f"{miles:.1f} mi"
    return f"{int(round(miles))} mi"


def foot_route_end_gap_m(
    walk_coords: list[list[float]],
    dest_lng: float,
    dest_lat: float,
) -> float:
    if not walk_coords:
        return float("inf")
    end_lng, end_lat = walk_coords[-1]
    return haversine_m(end_lat, end_lng, dest_lat, dest_lng)


def walk_path_length_m(walk_coords: list[list[float]]) -> float:
    if len(walk_coords) < 2:
        return 0.0
    total = 0.0
    for idx in range(len(walk_coords) - 1):
        lng_a, lat_a = walk_coords[idx]
        lng_b, lat_b = walk_coords[idx + 1]
        total += haversine_m(lat_a, lng_a, lat_b, lng_b)
    return total


def is_degenerate_foot_route(
    walk_coords: list[list[float]],
    walk_distance: float,
    dest_lng: float,
    dest_lat: float,
    road_gap_m: float,
) -> bool:
    """OSRM/Google sometimes return a 0 m foot leg while the pin is still off-road."""
    if road_gap_m <= LAST_MILE_THRESHOLD_M:
        return False
    if len(walk_coords) < 2:
        return True
    end_gap = foot_route_end_gap_m(walk_coords, dest_lng, dest_lat)
    span = max(walk_distance, walk_path_length_m(walk_coords))
    if end_gap <= LAST_MILE_THRESHOLD_M:
        return False
    if span >= min(25.0, road_gap_m * 0.2):
        return False
    return True


def extend_walk_geometry_to_dest(
    merged: list[list[float]],
    dest_lng: float,
    dest_lat: float,
) -> tuple[list[list[float]], float, bool]:
    """Ensure the route line reaches the exact selected pin."""
    end_gap = haversine_m(merged[-1][1], merged[-1][0], dest_lat, dest_lng)
    if end_gap <= 8:
        return merged, 0.0, False
    segments = max(8, min(40, int(end_gap / 150)))
    tail = interpolate_great_circle(
        merged[-1][0],
        merged[-1][1],
        dest_lng,
        dest_lat,
        segments=segments,
    )
    return merged + tail[1:], end_gap, True


def interpolate_great_circle(
    start_lng: float,
    start_lat: float,
    end_lng: float,
    end_lat: float,
    segments: int = 48,
) -> list[list[float]]:
    """Approximate off-trail path for map display when no foot graph is available."""
    if segments < 2:
        return [[start_lng, start_lat], [end_lng, end_lat]]
    points: list[list[float]] = []
    lat1 = math.radians(start_lat)
    lng1 = math.radians(start_lng)
    lat2 = math.radians(end_lat)
    lng2 = math.radians(end_lng)
    delta = 2 * math.asin(
        math.sqrt(
            math.sin((lat2 - lat1) / 2) ** 2
            + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
        )
    )
    if delta == 0:
        return [[start_lng, start_lat], [end_lng, end_lat]]
    for step in range(segments + 1):
        f = step / segments
        a = math.sin((1 - f) * delta) / math.sin(delta)
        b = math.sin(f * delta) / math.sin(delta)
        x = a * math.cos(lat1) * math.cos(lng1) + b * math.cos(lat2) * math.cos(lng2)
        y = a * math.cos(lat1) * math.sin(lng1) + b * math.cos(lat2) * math.sin(lng2)
        z = a * math.sin(lat1) + b * math.sin(lat2)
        lat = math.degrees(math.atan2(z, math.sqrt(x * x + y * y)))
        lng = math.degrees(math.atan2(y, x))
        points.append([lng, lat])
    return points


async def fetch_osrm_foot_route(
    client: httpx.AsyncClient,
    start_lng: float,
    start_lat: float,
    end_lng: float,
    end_lat: float,
) -> tuple[list[list[float]], float, float] | None:
    url = (
        f"{OSRM_BASE_URL}/route/v1/foot/{start_lng},{start_lat};"
        f"{end_lng},{end_lat}?overview=full&geometries=geojson&steps=false"
    )
    try:
        resp = await client.get(url)
        if resp.status_code != 200:
            return None
        routes = resp.json().get("routes", [])
        if not routes:
            return None
        route = routes[0]
        geom = route.get("geometry") or {}
        coords = geom.get("coordinates") or []
        if len(coords) < 2:
            return None
        distance = float(route.get("distance") or 0.0)
        duration = float(route.get("duration") or (distance / WALKING_SPEED_MPS))
        if distance <= 0:
            distance = walk_path_length_m(coords)
        if duration <= 0:
            duration = distance / WALKING_SPEED_MPS
        return coords, distance, duration
    except Exception as exc:
        logger.debug("[Rovvy Route Preview Audit] OSRM foot route failed: %s", exc)
        return None


async def fetch_google_walk_route(
    client: httpx.AsyncClient,
    start_lng: float,
    start_lat: float,
    end_lng: float,
    end_lat: float,
) -> tuple[list[list[float]], float, float] | None:
    api_key = (settings.google_routes_api_key or "").strip()
    if not api_key:
        return None
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": (
            "routes.distanceMeters,routes.duration,routes.polyline.geoJsonLinestring"
        ),
    }
    body = {
        "origin": {
            "location": {"latLng": {"latitude": start_lat, "longitude": start_lng}}
        },
        "destination": {
            "location": {"latLng": {"latitude": end_lat, "longitude": end_lng}}
        },
        "travelMode": "WALK",
        "polylineEncoding": "GEO_JSON_LINESTRING",
        "units": "METRIC",
    }
    try:
        resp = await client.post(GOOGLE_ROUTES_URL, json=body, headers=headers)
        if resp.status_code != 200:
            logger.debug(
                "[Rovvy Route Preview Audit] Google walk route HTTP %s",
                resp.status_code,
            )
            return None
        routes = resp.json().get("routes", [])
        if not routes:
            return None
        route = routes[0]
        polyline = route.get("polyline") or {}
        geom = polyline.get("geoJsonLinestring") or {}
        coords = geom.get("coordinates") or []
        if len(coords) < 2:
            return None
        distance = float(route.get("distanceMeters") or 0.0)
        duration_raw = route.get("duration")
        duration = 0.0
        if isinstance(duration_raw, str) and duration_raw.endswith("s"):
            try:
                duration = float(duration_raw[:-1])
            except ValueError:
                duration = distance / WALKING_SPEED_MPS
        if duration <= 0:
            duration = distance / WALKING_SPEED_MPS
        return coords, distance, duration
    except Exception as exc:
        logger.debug("[Rovvy Route Preview Audit] Google walk route failed: %s", exc)
        return None


def _parse_google_duration_seconds(route: dict) -> float:
    duration_raw = route.get("duration")
    if isinstance(duration_raw, str) and duration_raw.endswith("s"):
        try:
            return float(duration_raw[:-1])
        except ValueError:
            return 0.0
    return 0.0


def _google_route_has_tolls(route: dict) -> bool | None:
    advisory = route.get("travelAdvisory")
    if not isinstance(advisory, dict):
        return None
    toll = advisory.get("tollInfo")
    if not isinstance(toll, dict):
        return None
    prices = toll.get("estimatedPrice")
    if isinstance(prices, list) and len(prices) > 0:
        return True
    return False


def _google_route_geometry(route: dict) -> list[list[float]] | None:
    polyline = route.get("polyline") or {}
    geom = polyline.get("geoJsonLinestring") or {}
    coords = geom.get("coordinates") or []
    if len(coords) < 2:
        return None
    return coords


async def fetch_google_drive_route(
    client: httpx.AsyncClient,
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    *,
    avoid_tolls: bool,
) -> dict | None:
    api_key = (settings.google_routes_api_key or "").strip()
    if not api_key:
        return None
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": (
            "routes.distanceMeters,routes.duration,routes.polyline.geoJsonLinestring,"
            "routes.travelAdvisory.tollInfo"
        ),
    }
    body: dict = {
        "origin": {
            "location": {"latLng": {"latitude": origin_lat, "longitude": origin_lng}}
        },
        "destination": {
            "location": {"latLng": {"latitude": dest_lat, "longitude": dest_lng}}
        },
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_AWARE",
        "polylineEncoding": "GEO_JSON_LINESTRING",
        "units": "METRIC",
        "extraComputations": ["TOLLS"],
    }
    if avoid_tolls:
        body["routeModifiers"] = {"avoidTolls": True}
    try:
        resp = await client.post(GOOGLE_ROUTES_URL, json=body, headers=headers, timeout=25.0)
        if resp.status_code != 200:
            logger.debug(
                "[Rovvy Route Preview Audit] Google drive (avoid_tolls=%s) HTTP %s",
                avoid_tolls,
                resp.status_code,
            )
            return None
        routes = resp.json().get("routes", [])
        if not routes:
            return None
        return routes[0]
    except Exception as exc:
        logger.debug(
            "[Rovvy Route Preview Audit] Google drive (avoid_tolls=%s) failed: %s",
            avoid_tolls,
            exc,
        )
        return None


def _coords_signature(coords: list[list[float]]) -> tuple:
    if len(coords) < 2:
        return ()
    return (round(coords[0][0], 4), round(coords[0][1], 4), round(coords[-1][0], 4), round(coords[-1][1], 4), len(coords))


async def fetch_google_drive_alternatives(
    client: httpx.AsyncClient,
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
) -> list[RouteAlternativeOut]:
    """Parallel toll + no-toll Google drive routes (Google Maps style)."""
    default_route, avoid_tolls_route = await asyncio.gather(
        fetch_google_drive_route(
            client, origin_lat, origin_lng, dest_lat, dest_lng, avoid_tolls=False
        ),
        fetch_google_drive_route(
            client, origin_lat, origin_lng, dest_lat, dest_lng, avoid_tolls=True
        ),
    )

    candidates: list[RouteAlternativeOut] = []
    if default_route:
        has_tolls = _google_route_has_tolls(default_route)
        alt = _alt_from_route(
            default_route,
            "with_tolls",
            "Fastest route",
            "Tolls likely" if has_tolls else "Tolls possible",
            has_tolls,
        )
        if alt:
            candidates.append(alt)
    if avoid_tolls_route:
        alt = _alt_from_route(
            avoid_tolls_route,
            "avoid_tolls",
            "Avoid tolls",
            "No tolls",
            False,
        )
        if alt:
            candidates.append(alt)

    seen: set[tuple] = set()
    deduped: list[RouteAlternativeOut] = []
    for item in candidates:
        if not item.geometry:
            continue
        sig = _coords_signature(item.geometry.coordinates)
        if sig in seen:
            continue
        seen.add(sig)
        deduped.append(item)

    deduped.sort(key=lambda row: float(row.durationSeconds or 999999))
    return deduped


def _alt_from_route(
    route: dict,
    alt_id: str,
    label: str,
    toll_label: str,
    has_tolls: bool | None,
) -> RouteAlternativeOut | None:
    coords = _google_route_geometry(route)
    if not coords:
        return None
    return RouteAlternativeOut(
        id=alt_id,
        label=label,
        tollLabel=toll_label,
        hasTolls=has_tolls,
        distanceMeters=float(route.get("distanceMeters") or 0.0),
        durationSeconds=_parse_google_duration_seconds(route),
        geometry=GeoJSONGeometry(type="LineString", coordinates=coords),
        provider="google",
    )


def build_osrm_alternatives(routes: list[dict], primary_coords: list[list[float]]) -> list[RouteAlternativeOut]:
    """Label extra OSRM routes when Google is unavailable."""
    primary_sig = _coords_signature(primary_coords)
    alts: list[RouteAlternativeOut] = []
    for idx, route in enumerate(routes[1:3], start=2):
        geom = route.get("geometry") or {}
        coords = geom.get("coordinates") or []
        if len(coords) < 2:
            continue
        if _coords_signature(coords) == primary_sig:
            continue
        alts.append(
            RouteAlternativeOut(
                id=f"osrm_alt_{idx}",
                label=f"Alternative route {idx - 1}",
                tollLabel="Toll info unavailable",
                hasTolls=None,
                distanceMeters=float(route.get("distance") or 0.0),
                durationSeconds=float(route.get("duration") or 0.0),
                geometry=GeoJSONGeometry(type="LineString", coordinates=coords),
                provider="osrm",
            )
        )
    return alts


async def resolve_last_mile_foot_route(
    client: httpx.AsyncClient,
    start_lng: float,
    start_lat: float,
    dest_lng: float,
    dest_lat: float,
    road_gap_m: float,
) -> tuple[list[list[float]], float, float, str, bool] | None:
    """Try OSRM foot, Google WALK, and snapped foot-network routing."""
    attempts: list[tuple[float, float, float, float, str]] = [
        (start_lng, start_lat, dest_lng, dest_lat, "direct"),
    ]

    foot_dest = await snap_to_nearest_road(client, "foot", dest_lng, dest_lat)
    foot_start = await snap_to_nearest_road(client, "foot", start_lng, start_lat)
    dest_snap_gap = haversine_m(dest_lat, dest_lng, foot_dest[1], foot_dest[0])
    start_snap_gap = haversine_m(start_lat, start_lng, foot_start[1], foot_start[0])

    if dest_snap_gap > 5:
        attempts.append((start_lng, start_lat, foot_dest[0], foot_dest[1], "dest_snap"))
    if start_snap_gap > 5 or dest_snap_gap > 5:
        attempts.append(
            (foot_start[0], foot_start[1], foot_dest[0], foot_dest[1], "both_snap")
        )

    seen: set[tuple[float, float, float, float]] = set()
    for from_lng, from_lat, to_lng, to_lat, label in attempts:
        key = (
            round(from_lng, 5),
            round(from_lat, 5),
            round(to_lng, 5),
            round(to_lat, 5),
        )
        if key in seen:
            continue
        seen.add(key)

        osrm = await fetch_osrm_foot_route(client, from_lng, from_lat, to_lng, to_lat)
        if osrm:
            coords, distance, duration = osrm
            if label == "dest_snap" and dest_snap_gap > LAST_MILE_THRESHOLD_M:
                tail = interpolate_great_circle(
                    to_lng, to_lat, dest_lng, dest_lat, segments=16
                )
                coords = coords + tail[1:]
                distance += dest_snap_gap
                duration += dest_snap_gap / WALKING_SPEED_MPS
            if not is_degenerate_foot_route(
                coords, distance, dest_lng, dest_lat, road_gap_m
            ):
                return coords, distance, duration, "osrm", False

        google = await fetch_google_walk_route(client, from_lng, from_lat, to_lng, to_lat)
        if google:
            coords, distance, duration = google
            if label == "dest_snap" and dest_snap_gap > LAST_MILE_THRESHOLD_M:
                tail = interpolate_great_circle(
                    to_lng, to_lat, dest_lng, dest_lat, segments=16
                )
                coords = coords + tail[1:]
                distance += dest_snap_gap
                duration += dest_snap_gap / WALKING_SPEED_MPS
            if not is_degenerate_foot_route(
                coords, distance, dest_lng, dest_lat, road_gap_m
            ):
                return coords, distance, duration, "google", False

    return None


async def append_last_mile_walk(
    client: httpx.AsyncClient,
    coords: list[list[float]],
    distance: float | None,
    duration: float | None,
    maneuvers: list[RouteManeuverOut],
    dest_lat: float,
    dest_lng: float,
) -> tuple[list[list[float]], float | None, float | None, list[RouteManeuverOut], RoutePreviewResponse | None, int | None]:
    if not coords:
        return coords, distance, duration, maneuvers, None, None

    route_end_lng, route_end_lat = coords[-1]
    gap_m = haversine_m(route_end_lat, route_end_lng, dest_lat, dest_lng)
    if gap_m < LAST_MILE_THRESHOLD_M:
        return coords, distance, duration, maneuvers, None, None

    drive_end_index = len(coords) - 1
    resolved = await resolve_last_mile_foot_route(
        client, route_end_lng, route_end_lat, dest_lng, dest_lat, gap_m
    )
    if resolved:
        walk_coords, walk_distance, walk_duration, provider, approximate = resolved
        merged = coords + walk_coords[1:]
        merged, tail_gap, tail_approx = extend_walk_geometry_to_dest(
            merged, dest_lng, dest_lat
        )
        if tail_gap > 0:
            walk_distance += tail_gap
            walk_duration += tail_gap / WALKING_SPEED_MPS
            approximate = approximate or tail_approx
        if walk_distance <= 0:
            walk_distance = walk_path_length_m(walk_coords) + tail_gap
        if walk_distance < 10 and gap_m > LAST_MILE_THRESHOLD_M:
            walk_distance = gap_m
        total_distance = (distance or 0.0) + walk_distance
        total_duration = (duration or 0.0) + walk_duration
        next_maneuvers = [
            *maneuvers,
            RouteManeuverOut(
                instruction=(
                    f"Walk {format_last_mile_distance(walk_distance)} to destination"
                ),
                location=[dest_lng, dest_lat],
            ),
        ]
        notice = (
            "Driving ends at the nearest road. "
            f"Walk about {format_last_mile_distance(walk_distance)} to reach this exact location."
        )
        if approximate:
            notice += " Trail path is approximate — verify access on the ground."
        extras = RoutePreviewResponse(
            status="ready",
            lastMileMode="walk",
            lastMileDistanceMeters=walk_distance,
            lastMileDurationSeconds=walk_duration,
            lastMileNotice=notice,
            walkStartIndex=drive_end_index,
            lastMileApproximate=approximate,
            provider=provider,
        )
        return merged, total_distance, total_duration, next_maneuvers, extras, drive_end_index

    if gap_m <= APPROX_WALK_MAX_M:
        approx_coords = interpolate_great_circle(
            route_end_lng, route_end_lat, dest_lng, dest_lat
        )
        merged = coords + approx_coords[1:]
        walk_duration = gap_m / WALKING_SPEED_MPS
        notice = (
            "Driving ends at the nearest road. "
            f"Walk about {format_last_mile_distance(gap_m)} to reach this exact location. "
            "Trail routing unavailable — dashed line shows the approximate path."
        )
        extras = RoutePreviewResponse(
            status="ready",
            lastMileMode="walk",
            lastMileDistanceMeters=gap_m,
            lastMileDurationSeconds=walk_duration,
            lastMileNotice=notice,
            walkStartIndex=drive_end_index,
            lastMileApproximate=True,
            provider="approximate",
        )
        next_maneuvers = [
            *maneuvers,
            RouteManeuverOut(
                instruction=f"Walk about {format_last_mile_distance(gap_m)} to destination",
                location=[dest_lng, dest_lat],
            ),
        ]
        return (
            merged,
            (distance or 0.0) + gap_m,
            (duration or 0.0) + walk_duration,
            next_maneuvers,
            extras,
            drive_end_index,
        )

    notice = (
        "Driving ends at the nearest road. "
        f"The exact location is about {format_last_mile_distance(gap_m)} away on foot — "
        "check local access (paths, canals, stairs, or private property may block the way)."
    )
    extras = RoutePreviewResponse(
        status="ready",
        lastMileMode="walk",
        lastMileDistanceMeters=gap_m,
        lastMileDurationSeconds=gap_m / WALKING_SPEED_MPS,
        lastMileNotice=notice,
        walkStartIndex=None,
        lastMileApproximate=None,
    )
    return coords, distance, duration, maneuvers, extras, None


def polyline_length_m(coords: list[list[float]]) -> float:
    total = 0.0
    for idx in range(1, len(coords)):
        lng_a, lat_a = coords[idx - 1][0], coords[idx - 1][1]
        lng_b, lat_b = coords[idx][0], coords[idx][1]
        total += haversine_m(lat_a, lng_a, lat_b, lng_b)
    return total


def is_land_connected_drive_route(
    coords: list[list[float]],
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
) -> bool:
    if not coords or len(coords) < 2:
        return False

    direct_m = haversine_m(origin_lat, origin_lng, dest_lat, dest_lng)
    if direct_m > CROSS_OCEAN_DIRECT_M:
        return False
    if len(coords) <= STRAIGHT_LINE_MAX_POINTS and direct_m > STRAIGHT_LINE_MIN_DIRECT_M:
        return False
    if direct_m > LOCAL_LIVE_MAX_M:
        path_m = polyline_length_m(coords)
        if len(coords) < 8 and path_m < direct_m * 1.08:
            return False
    return True


def land_route_failure_message(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> str:
    direct_m = haversine_m(origin_lat, origin_lng, dest_lat, dest_lng)
    if direct_m > CROSS_OCEAN_DIRECT_M:
        return (
            "No driveable land route between these locations. "
            "Plan this as a future trip instead of Solo Live."
        )
    return (
        "No driveable land route to this location. "
        "It may cross open water — plan it as a future trip."
    )


def build_ready_response(
    coords: list[list[float]],
    distance: float | None,
    duration: float | None,
    maneuvers: list[RouteManeuverOut],
    last_mile: RoutePreviewResponse | None = None,
    border_crossings: list[BorderCrossingOut] | None = None,
    border_notice: str | None = None,
    walk_start_index: int | None = None,
    alternatives: list[RouteAlternativeOut] | None = None,
    provider: str | None = None,
) -> RoutePreviewResponse:
    resolved_provider = provider or (last_mile.provider if last_mile and last_mile.provider else "osrm")
    return RoutePreviewResponse(
        status="ready",
        distanceMeters=distance,
        durationSeconds=duration,
        geometry=GeoJSONGeometry(type="LineString", coordinates=coords),
        maneuvers=maneuvers,
        provider=resolved_provider,
        message=None,
        lastMileMode=last_mile.lastMileMode if last_mile else None,
        lastMileDistanceMeters=last_mile.lastMileDistanceMeters if last_mile else None,
        lastMileDurationSeconds=last_mile.lastMileDurationSeconds if last_mile else None,
        lastMileNotice=last_mile.lastMileNotice if last_mile else None,
        walkStartIndex=(
            last_mile.walkStartIndex
            if last_mile and last_mile.walkStartIndex is not None
            else walk_start_index
        ),
        lastMileApproximate=last_mile.lastMileApproximate if last_mile else None,
        borderCrossings=border_crossings or None,
        borderNotice=border_notice,
        alternatives=alternatives or None,
    )


async def snap_to_nearest_road(
    client: httpx.AsyncClient,
    profile: str,
    lng: float,
    lat: float,
) -> list[float]:
    snap_url = f"{OSRM_BASE_URL}/nearest/v1/{profile}/{lng},{lat}?number=1"
    try:
        resp = await client.get(snap_url)
        if resp.status_code == 200:
            waypoints = resp.json().get("waypoints", [])
            if waypoints and waypoints[0].get("location"):
                return waypoints[0]["location"]
    except Exception as exc:
        logger.debug("[Rovvy Route Preview Audit] Road snap failed: %s", exc)
    return [lng, lat]


class LiveRoutingService:
    @staticmethod
    async def get_route_preview(request: RoutePreviewRequest) -> RoutePreviewResponse:
        origin_lat = request.origin.latitude
        origin_lng = request.origin.longitude
        dest_lat = request.destination.latitude
        dest_lng = request.destination.longitude
        mode = request.travelMode

        if mode == "Drive":
            profile = "driving"
        elif mode == "Bike":
            profile = "cycling"
        else:
            profile = "foot"

        # Logs per Part C requirement:
        # - route-preview endpoint hit
        # - request origin/destination/mode
        logger.debug(
            "[Rovvy Route Preview Audit] Endpoint hit. Origin: (%s, %s, source=%s), Destination: (%s, %s), Mode: %s",
            origin_lat,
            origin_lng,
            request.origin.source,
            dest_lat,
            dest_lng,
            mode,
        )
        logger.info(
            "[Rovvy Route Preview Audit] Route preview requested (mode=%s, origin_source=%s)",
            mode,
            request.origin.source,
        )

        async with httpx.AsyncClient(timeout=35.0) as client:
            try:
                route_origin_lng, route_origin_lat = origin_lng, origin_lat
                route_dest_lng, route_dest_lat = dest_lng, dest_lat
                google_alternatives: list[RouteAlternativeOut] = []

                if mode == "Drive" and (settings.google_routes_api_key or "").strip():
                    google_alternatives = await fetch_google_drive_alternatives(
                        client,
                        origin_lat,
                        origin_lng,
                        dest_lat,
                        dest_lng,
                    )
                    if google_alternatives:
                        pick = google_alternatives[0]
                        coords = list(pick.geometry.coordinates) if pick.geometry else []
                        distance = pick.distanceMeters
                        duration = pick.durationSeconds
                        maneuvers = [
                            RouteManeuverOut(
                                instruction="Follow highlighted route",
                                location=coords[0],
                            )
                        ]
                        (
                            coords,
                            distance,
                            duration,
                            maneuvers,
                            last_mile,
                            walk_start_index,
                        ) = await append_last_mile_walk(
                            client,
                            coords,
                            distance,
                            duration,
                            maneuvers,
                            dest_lat,
                            dest_lng,
                        )
                        if not is_land_connected_drive_route(
                            coords, origin_lat, origin_lng, dest_lat, dest_lng
                        ):
                            return RoutePreviewResponse(
                                status="failed",
                                message=land_route_failure_message(
                                    origin_lat, origin_lng, dest_lat, dest_lng
                                ),
                            )
                        border_crossings = await BorderCrossingService.detect_crossings(
                            coords,
                            request.origin.country,
                            request.destination.country,
                        )
                        border_notice = BorderCrossingService.build_border_notice(
                            border_crossings
                        )
                        return build_ready_response(
                            coords,
                            distance,
                            duration,
                            maneuvers,
                            last_mile,
                            border_crossings,
                            border_notice,
                            walk_start_index,
                            alternatives=google_alternatives
                            if len(google_alternatives) > 1
                            else None,
                            provider="google",
                        )

                if mode == "Drive":
                    snap_orig = await snap_to_nearest_road(
                        client, profile, origin_lng, origin_lat
                    )
                    snap_dest = await snap_to_nearest_road(
                        client, profile, dest_lng, dest_lat
                    )
                    route_origin_lng, route_origin_lat = snap_orig[0], snap_orig[1]
                    route_dest_lng, route_dest_lat = snap_dest[0], snap_dest[1]

                # overview=full — road-following geometry. alternatives=true for route options.
                route_url = (
                    f"{OSRM_BASE_URL}/route/v1/{profile}/"
                    f"{route_origin_lng},{route_origin_lat};{route_dest_lng},{route_dest_lat}"
                    f"?overview=full&geometries=geojson&steps=true"
                )
                if mode == "Drive":
                    route_url += "&alternatives=true"

                response = await client.get(route_url)
                logger.debug(
                    "[Rovvy Route Preview Audit] OSRM Route Request URL: %s, Status Code: %s",
                    route_url,
                    response.status_code,
                )

                if response.status_code == 200:
                    data = response.json()
                    routes = data.get("routes", [])
                    if routes:
                        route = routes[0]
                        distance = route.get("distance")
                        duration = route.get("duration")
                        geom = route.get("geometry")
                        if geom and geom.get("coordinates"):
                            coords = geom.get("coordinates")
                            maneuvers = extract_maneuvers(route)
                            osrm_alts = (
                                build_osrm_alternatives(routes, coords)
                                if mode == "Drive"
                                else []
                            )
                            if mode == "Drive":
                                (
                                    coords,
                                    distance,
                                    duration,
                                    maneuvers,
                                    last_mile,
                                    walk_start_index,
                                ) = await append_last_mile_walk(
                                    client,
                                    coords,
                                    distance,
                                    duration,
                                    maneuvers,
                                    dest_lat,
                                    dest_lng,
                                )
                            else:
                                last_mile = None
                                walk_start_index = None
                            logger.debug(
                                "[Rovvy Route Preview Audit] Success. Provider response status: %s, Geometry coordinate count: %d",
                                data.get("code"),
                                len(coords),
                            )
                            border_crossings = await BorderCrossingService.detect_crossings(
                                coords,
                                request.origin.country,
                                request.destination.country,
                            )
                            border_notice = BorderCrossingService.build_border_notice(
                                border_crossings
                            )
                            if mode == "Drive" and not is_land_connected_drive_route(
                                coords, origin_lat, origin_lng, dest_lat, dest_lng
                            ):
                                return RoutePreviewResponse(
                                    status="failed",
                                    message=land_route_failure_message(
                                        origin_lat, origin_lng, dest_lat, dest_lng
                                    ),
                                )
                            return build_ready_response(
                                coords,
                                distance,
                                duration,
                                maneuvers,
                                last_mile,
                                border_crossings,
                                border_notice,
                                walk_start_index,
                                alternatives=osrm_alts if osrm_alts else None,
                            )

                # Snapping fallback for Drive mode
                if mode == "Drive":
                    logger.debug(
                        "[Rovvy Route Preview Audit] Drive route failed. Attempting nearest-road snapping..."
                    )
                    snap_origin_url = (
                        f"{OSRM_BASE_URL}/nearest/v1/{profile}/{origin_lng},{origin_lat}?number=1"
                    )
                    snap_dest_url = (
                        f"{OSRM_BASE_URL}/nearest/v1/{profile}/{dest_lng},{dest_lat}?number=1"
                    )

                    snap_orig_coords = [origin_lng, origin_lat]
                    snap_dest_coords = [dest_lng, dest_lat]

                    try:
                        resp_orig = await client.get(snap_origin_url)
                        if resp_orig.status_code == 200:
                            orig_data = resp_orig.json()
                            waypoints = orig_data.get("waypoints", [])
                            if waypoints:
                                snap_orig_coords = waypoints[0].get("location")
                    except Exception as e:
                        logger.debug(
                            "[Rovvy Route Preview Audit] Origin snapping failed: %s", e
                        )

                    try:
                        resp_dest = await client.get(snap_dest_url)
                        if resp_dest.status_code == 200:
                            dest_data = resp_dest.json()
                            waypoints = dest_data.get("waypoints", [])
                            if waypoints:
                                snap_dest_coords = waypoints[0].get("location")
                    except Exception as e:
                        logger.debug(
                            "[Rovvy Route Preview Audit] Destination snapping failed: %s", e
                        )

                    retry_url = (
                        f"{OSRM_BASE_URL}/route/v1/{profile}/"
                        f"{snap_orig_coords[0]},{snap_orig_coords[1]};{snap_dest_coords[0]},{snap_dest_coords[1]}"
                        f"?overview=full&geometries=geojson&steps=true"
                    )
                    resp_retry = await client.get(retry_url)
                    logger.debug(
                        "[Rovvy Route Preview Audit] Retry Snapped OSRM Route URL: %s, Status Code: %s",
                        retry_url,
                        resp_retry.status_code,
                    )

                    if resp_retry.status_code == 200:
                        retry_data = resp_retry.json()
                        routes = retry_data.get("routes", [])
                        if routes:
                            route = routes[0]
                            distance = route.get("distance")
                            duration = route.get("duration")
                            geom = route.get("geometry")
                            if geom and geom.get("coordinates"):
                                coords = geom.get("coordinates")
                                maneuvers = extract_maneuvers(route)
                                (
                                    coords,
                                    distance,
                                    duration,
                                    maneuvers,
                                    last_mile,
                                    walk_start_index,
                                ) = await append_last_mile_walk(
                                    client,
                                    coords,
                                    distance,
                                    duration,
                                    maneuvers,
                                    dest_lat,
                                    dest_lng,
                                )
                                logger.debug(
                                    "[Rovvy Route Preview Audit] Success after snapping. Provider status: %s, Coordinate count: %d",
                                    retry_data.get("code"),
                                    len(coords),
                                )
                                border_crossings = await BorderCrossingService.detect_crossings(
                                    coords,
                                    request.origin.country,
                                    request.destination.country,
                                )
                                border_notice = BorderCrossingService.build_border_notice(
                                    border_crossings
                                )
                                if mode == "Drive" and not is_land_connected_drive_route(
                                    coords, origin_lat, origin_lng, dest_lat, dest_lng
                                ):
                                    return RoutePreviewResponse(
                                        status="failed",
                                        message=land_route_failure_message(
                                            origin_lat, origin_lng, dest_lat, dest_lng
                                        ),
                                    )
                                return build_ready_response(
                                    coords,
                                    distance,
                                    duration,
                                    maneuvers,
                                    last_mile,
                                    border_crossings,
                                    border_notice,
                                )

                # Normalize user-safe failure messages
                dist = haversine_m(origin_lat, origin_lng, dest_lat, dest_lng)
                if mode == "Drive":
                    if dist < 300:
                        msg = "This is nearby. Walking route may work better."
                    else:
                        msg = "Drive route unavailable to this exact point. Try walking route or Pick nearby road as destination."
                elif mode in ("Bike", "Walk", "Trek"):
                    msg = "Routing for this mode is not available yet."
                else:
                    msg = "No route found for selected travel mode."

                logger.debug(
                    "[Rovvy Route Preview Audit] Failed. Returning user message: %s", msg
                )
                return RoutePreviewResponse(status="failed", message=msg)

            except httpx.HTTPError as exc:
                logger.error("[Rovvy Route Preview Audit] HTTP request to OSRM failed")
                logger.debug("[Rovvy Route Preview Audit] OSRM HTTP error detail: %s", exc)
                return RoutePreviewResponse(
                    status="failed", message="Directions service unavailable."
                )
            except Exception as exc:
                logger.error("[Rovvy Route Preview Audit] Unexpected routing error")
                logger.debug("[Rovvy Route Preview Audit] Unexpected routing error detail: %s", exc)
                return RoutePreviewResponse(
                    status="failed", message="Directions service unavailable."
                )
