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
        logger.info(
            "[Rovvy Route Preview Audit] Endpoint hit. Origin: (%s, %s, source=%s), Destination: (%s, %s), Mode: %s",
            origin_lat,
            origin_lng,
            request.origin.source,
            dest_lat,
            dest_lng,
            mode,
        )

        route_url = f"{OSRM_BASE_URL}/route/v1/{profile}/{origin_lng},{origin_lat};{dest_lng},{dest_lat}?overview=full&geometries=geojson&steps=true"

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.get(route_url)
                logger.info(
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
                            logger.info(
                                "[Rovvy Route Preview Audit] Success. Provider response status: %s, Geometry coordinate count: %d",
                                data.get("code"),
                                len(coords),
                            )
                            return RoutePreviewResponse(
                                status="ready",
                                distanceMeters=distance,
                                durationSeconds=duration,
                                geometry=GeoJSONGeometry(type="LineString", coordinates=coords),
                                maneuvers=maneuvers,
                                provider="osrm",
                                message=None,
                            )

                # Snapping fallback for Drive mode
                if mode == "Drive":
                    logger.info(
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
                        logger.warning(
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
                        logger.warning(
                            "[Rovvy Route Preview Audit] Destination snapping failed: %s", e
                        )

                    retry_url = f"{OSRM_BASE_URL}/route/v1/{profile}/{snap_orig_coords[0]},{snap_orig_coords[1]};{snap_dest_coords[0]},{snap_dest_coords[1]}?overview=full&geometries=geojson&steps=true"
                    resp_retry = await client.get(retry_url)
                    logger.info(
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
                                logger.info(
                                    "[Rovvy Route Preview Audit] Success after snapping. Provider status: %s, Coordinate count: %d",
                                    retry_data.get("code"),
                                    len(coords),
                                )
                                return RoutePreviewResponse(
                                    status="ready",
                                    distanceMeters=distance,
                                    durationSeconds=duration,
                                    geometry=GeoJSONGeometry(
                                        type="LineString", coordinates=coords
                                    ),
                                    maneuvers=maneuvers,
                                    provider="osrm",
                                    message=None,
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

                logger.info(
                    "[Rovvy Route Preview Audit] Failed. Returning user message: %s", msg
                )
                return RoutePreviewResponse(status="failed", message=msg)

            except httpx.HTTPError as exc:
                logger.error(
                    "[Rovvy Route Preview Audit] HTTP request to OSRM failed: %s", exc
                )
                return RoutePreviewResponse(
                    status="failed", message="Directions service unavailable."
                )
            except Exception as exc:
                logger.error("[Rovvy Route Preview Audit] Unexpected error: %s", exc)
                return RoutePreviewResponse(
                    status="failed", message="Directions service unavailable."
                )
