"""Assess whether continuous ground navigation is realistic between user and pin."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.services.places_nearby_service import calculate_distance_miles


def _norm_country(value: Any) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    token = value.strip().lower()
    aliases = {
        "us": "united states",
        "usa": "united states",
        "u.s.": "united states",
        "u.s.a.": "united states",
        "uk": "united kingdom",
        "u.k.": "united kingdom",
    }
    return aliases.get(token, token)


@dataclass(frozen=True)
class DriveFeasibility:
    feasible: bool
    reason: str | None = None
    message: str | None = None


def assess_drive_feasibility(
    ctx: dict[str, Any] | None,
    place: dict[str, Any] | None,
) -> DriveFeasibility:
    if not ctx or not place:
        return DriveFeasibility(feasible=True)

    user = ctx.get("userLocation")
    if not isinstance(user, dict):
        return DriveFeasibility(feasible=True)

    u_lat, u_lng = user.get("lat"), user.get("lng")
    p_lat, p_lng = place.get("lat"), place.get("lng")
    if not all(isinstance(v, (int, float)) for v in (u_lat, u_lng, p_lat, p_lng)):
        return DriveFeasibility(feasible=True)

    miles = calculate_distance_miles(float(u_lat), float(u_lng), float(p_lat), float(p_lng))
    user_country = _norm_country(user.get("country"))
    place_country = _norm_country(place.get("country"))
    user_label = str(user.get("city") or user.get("country") or "your location")
    place_label = str(place.get("name") or "the destination")
    dest_city = str(place.get("city") or place.get("country") or "your destination")

    route = ctx.get("routePreview")
    if isinstance(route, dict):
        dist_m = route.get("distanceMeters")
        if isinstance(dist_m, (int, float)) and float(dist_m) > 0:
            return DriveFeasibility(feasible=True)

    if user_country and place_country and user_country != place_country and miles > 200:
        return DriveFeasibility(
            feasible=False,
            reason="international_separation",
            message=(
                f"A continuous driving route from {user_label} to {place_label} is not available — "
                f"you are in different countries separated by long distance ({miles:,.0f} mi as the crow flies). "
                f"Fly to {dest_city}, then use Solo Live on the map for local ground navigation."
            ),
        )

    if miles > 8000:
        return DriveFeasibility(
            feasible=False,
            reason="extreme_distance",
            message=(
                f"{place_label} is about {miles:,.0f} mi from {user_label} — too far for a single continuous drive. "
                "Use flights for the long-haul segment, then navigate locally on Live."
            ),
        )

    return DriveFeasibility(feasible=True)


def is_drive_navigation_question(message: str) -> bool:
    q = message.lower()
    return any(
        k in q
        for k in (
            "how long is the drive",
            "best route",
            "how do i get to",
            "how is traffic",
            "navigate",
            "reroute",
            "start navigation",
            "accessible by car",
        )
    )
