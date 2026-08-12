"""Default Wayra answer behavior — product defaults without user sign-off per question."""

from __future__ import annotations

import re
from typing import Any

from app.services.places_nearby_service import calculate_distance_miles
from app.services.wayra_intent import normalize_query

_POLAR_QUESTION_RE = re.compile(
    r"\b("
    r"six months.{0,60}(sun|daylight|night|dark|open|closed)|"
    r"polar (day|night)|midnight sun|"
    r"sun never sets|sun never rises|"
    r"full sunlight.{0,40}(full night|nighttime)|"
    r"fully open for six months|fully closed for six months|"
    r"never sets for months|never rises for months"
    r")\b",
    re.I,
)


def is_polar_day_night_question(message: str) -> bool:
    return bool(_POLAR_QUESTION_RE.search(normalize_query(message)))

_SURVIVE_RE = re.compile(r"\b(survive|survival)\b", re.I)
_DAYS_HERE_RE = re.compile(r"\bhow many days\b", re.I)
_CERT_RE = re.compile(r"\b(certification|certified|permit|visa)\b", re.I)
_WHATS_HERE_RE = re.compile(
    r"\b(what s here|what's here|whats here|what is here|what can i do here)\b",
    re.I,
)
_TEMP_HERE_RE = re.compile(
    r"\b(temperature|weather).{0,30}\b(here|from here)\b|\bfrom here\b.{0,20}\b(temperature|weather)\b",
    re.I,
)


def _place_from_ctx(ctx: dict[str, Any] | None) -> dict[str, Any] | None:
    if not ctx:
        return None
    for key in ("selectedPlace", "activeMapPin"):
        row = ctx.get(key)
        if isinstance(row, dict) and row.get("lat") is not None:
            return row
    return None


def separation_miles(ctx: dict[str, Any] | None, place: dict[str, Any] | None) -> float | None:
    if not ctx or not place:
        return None
    user = ctx.get("userLocation")
    if not isinstance(user, dict):
        return None
    u_lat, u_lng = user.get("lat"), user.get("lng")
    p_lat, p_lng = place.get("lat"), place.get("lng")
    if not all(isinstance(v, (int, float)) for v in (u_lat, u_lng, p_lat, p_lng)):
        return None
    return calculate_distance_miles(float(u_lat), float(u_lng), float(p_lat), float(p_lng))


def is_extreme_destination(ctx: dict[str, Any] | None, place: dict[str, Any] | None) -> bool:
    miles = separation_miles(ctx, place)
    if miles is not None and miles > 2000:
        return True
    if not place:
        return False
    country = str(place.get("country") or "").lower()
    if "antarctica" in country:
        return True
    lat = place.get("lat")
    if isinstance(lat, (int, float)) and abs(float(lat)) > 66:
        return True
    return False


def is_polar_region_pin(place: dict[str, Any] | None) -> bool:
    if not place:
        return False
    lat = place.get("lat")
    if isinstance(lat, (int, float)) and abs(float(lat)) >= 60:
        return True
    country = str(place.get("country") or "").lower()
    return any(k in country for k in ("antarctica", "arctic", "greenland"))


def is_composite_whats_here_question(message: str) -> bool:
    q = normalize_query(message)
    if not _WHATS_HERE_RE.search(q):
        return False
    return bool(
        re.search(r"\bhow far|how to prepare|how do i prepare|prepare for\b", q)
        or "how far is it" in q
    )


def build_wayra_behavior_hints(
    user_message: str,
    ctx: dict[str, Any] | None,
    place: dict[str, Any] | None = None,
) -> str:
    """Inject product-default answer rules into LLM context."""
    target = place or _place_from_ctx(ctx)
    miles = separation_miles(ctx, target)
    lines = ["WAYRA ANSWER DEFAULTS (follow unless user clearly overrides):"]

    if _TEMP_HERE_RE.search(normalize_query(user_message)):
        lines.append(
            '- "Temperature/weather from here" on Live map means the DESTINATION PIN, not the user\'s GPS home.'
        )

    if _DAYS_HERE_RE.search(normalize_query(user_message)):
        if miles is not None and miles > 50:
            lines.append(
                "- For how many days to spend: give TOTAL trip length including travel from home, "
                "then break out on-site days at the destination."
            )
        else:
            lines.append(
                "- For how many days to spend: focus on on-site time at the pin; mention travel only briefly."
            )

    if _SURVIVE_RE.search(normalize_query(user_message)):
        if is_extreme_destination(ctx, target):
            lines.append(
                "- Survival question: use serious expedition prep tone (safety, gear, logistics, medevac)."
            )
        else:
            lines.append(
                "- Survival question: user means practical visit prep — friendly tone, not disaster survival."
            )

    if _CERT_RE.search(normalize_query(user_message)):
        cat = str((target or {}).get("category") or "").lower()
        if cat in {"landmark", "attraction", "museum", "hotel"} or "landmark" in cat:
            lines.append(
                "- Certification question at a landmark/hotel: lead with entry tickets/reservations needed; "
                "mention passport/visa only if international travel applies."
            )
        else:
            lines.append(
                "- Certification question: cover passport/visa, permits, and guided access if remote; "
                "tickets if it is a venue."
            )

    if _POLAR_QUESTION_RE.search(normalize_query(user_message)):
        if is_polar_region_pin(target):
            lines.append(
                "- Polar day/night question: explain polar day/night for this high-latitude pin directly."
            )
        else:
            lines.append(
                "- Polar day/night question: this pin is NOT in a polar region — say so clearly, "
                "then name Arctic/Antarctic as where that phenomenon occurs."
            )

    if len(lines) == 1:
        return ""
    return "\n".join(lines)
