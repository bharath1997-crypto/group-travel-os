from __future__ import annotations

import logging
import math
import httpx

from app.schemas.live_routing import (
    RoutePreviewRequest,
    RoutePreviewResponse,
    GeoJSONGeometry,
    RouteManeuverOut,
)

logger = logging.getLogger(__name__)

OSRM_BASE_URL = "https://router.project-osrm.org"
LAST_MILE_THRESHOLD_M = 25.0
WALKING_SPEED_MPS = 1.3


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
        return f"{int(round(meters))} m"
    miles = meters / 1609.34
    if miles < 10:
        return f"{miles:.1f} mi"
    return f"{int(round(miles))} mi"


async def append_last_mile_walk(
    client: httpx.AsyncClient,
    coords: list[list[float]],
    distance: float | None,
    duration: float | None,
    maneuvers: list[RouteManeuverOut],
    dest_lat: float,
    dest_lng: float,
) -> tuple[list[list[float]], float | None, float | None, list[RouteManeuverOut], RoutePreviewResponse | None]:
    if not coords:
        return coords, distance, duration, maneuvers, None

    route_end_lng, route_end_lat = coords[-1]
    gap_m = haversine_m(route_end_lat, route_end_lng, dest_lat, dest_lng)
    if gap_m < LAST_MILE_THRESHOLD_M:
        return coords, distance, duration, maneuvers, None

    walk_url = (
        f"{OSRM_BASE_URL}/route/v1/foot/{route_end_lng},{route_end_lat};"
        f"{dest_lng},{dest_lat}?overview=full&geometries=geojson&steps=false"
    )
    try:
        walk_resp = await client.get(walk_url)
        if walk_resp.status_code == 200:
            walk_data = walk_resp.json()
            walk_routes = walk_data.get("routes", [])
            if walk_routes:
                walk_route = walk_routes[0]
                walk_geom = walk_route.get("geometry") or {}
                walk_coords = walk_geom.get("coordinates") or []
                if len(walk_coords) >= 2:
                    walk_distance = float(walk_route.get("distance") or gap_m)
                    walk_duration = float(
                        walk_route.get("duration") or (walk_distance / WALKING_SPEED_MPS)
                    )
                    merged = coords + walk_coords[1:]
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
                    extras = RoutePreviewResponse(
                        status="ready",
                        lastMileMode="walk",
                        lastMileDistanceMeters=walk_distance,
                        lastMileDurationSeconds=walk_duration,
                        lastMileNotice=notice,
                    )
                    return merged, total_distance, total_duration, next_maneuvers, extras
    except Exception as exc:
        logger.debug("[Rovvy Route Preview Audit] Last-mile walk routing failed: %s", exc)

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
    )
    # Do not draw a straight line through buildings — end route at the road.
    return coords, distance, duration, maneuvers, extras


def build_ready_response(
    coords: list[list[float]],
    distance: float | None,
    duration: float | None,
    maneuvers: list[RouteManeuverOut],
    last_mile: RoutePreviewResponse | None = None,
) -> RoutePreviewResponse:
    return RoutePreviewResponse(
        status="ready",
        distanceMeters=distance,
        durationSeconds=duration,
        geometry=GeoJSONGeometry(type="LineString", coordinates=coords),
        maneuvers=maneuvers,
        provider="osrm",
        message=None,
        lastMileMode=last_mile.lastMileMode if last_mile else None,
        lastMileDistanceMeters=last_mile.lastMileDistanceMeters if last_mile else None,
        lastMileDurationSeconds=last_mile.lastMileDurationSeconds if last_mile else None,
        lastMileNotice=last_mile.lastMileNotice if last_mile else None,
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

        async with httpx.AsyncClient(timeout=90.0) as client:
            try:
                route_origin_lng, route_origin_lat = origin_lng, origin_lat
                route_dest_lng, route_dest_lat = dest_lng, dest_lat
                if mode == "Drive":
                    snap_orig = await snap_to_nearest_road(
                        client, profile, origin_lng, origin_lat
                    )
                    snap_dest = await snap_to_nearest_road(
                        client, profile, dest_lng, dest_lat
                    )
                    route_origin_lng, route_origin_lat = snap_orig[0], snap_orig[1]
                    route_dest_lng, route_dest_lat = snap_dest[0], snap_dest[1]

                # overview=full — road-following geometry. simplified can collapse to 2 points (straight line).
                route_url = (
                    f"{OSRM_BASE_URL}/route/v1/{profile}/"
                    f"{route_origin_lng},{route_origin_lat};{route_dest_lng},{route_dest_lat}"
                    f"?overview=full&geometries=geojson&steps=true"
                )

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
                            if mode == "Drive":
                                (
                                    coords,
                                    distance,
                                    duration,
                                    maneuvers,
                                    last_mile,
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
                            logger.debug(
                                "[Rovvy Route Preview Audit] Success. Provider response status: %s, Geometry coordinate count: %d",
                                data.get("code"),
                                len(coords),
                            )
                            return build_ready_response(
                                coords, distance, duration, maneuvers, last_mile
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
                                return build_ready_response(
                                    coords, distance, duration, maneuvers, last_mile
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
