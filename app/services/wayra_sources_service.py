"""Fetch open sources (Wikipedia, OSM nearby) for Perplexity-style Wayra answers."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

from app.schemas.ai_assistant import WayraSource
from app.services.place_wikipedia_service import PlaceWikipediaService
from app.services.places_nearby_service import PlacesNearbyService, calculate_distance_miles
from app.services.wayra_place_context import is_generic_place_name, normalize_place_for_sources
from app.services.wayra_route_feasibility import assess_drive_feasibility

_NEARBY_RADIUS_M: dict[str, int] = {
    "food": 15_000,
    "coffee": 10_000,
    "all": 10_000,
}
_DEFAULT_NEARBY_RADIUS_M = 5_000


def _discovery_supplement_category(message: str) -> str | None:
    q = message.lower()
    if any(k in q for k in ("what can i do", "things to do", "activities", "anything fun", "not miss", "hidden gems")):
        return "attraction"
    if any(k in q for k in ("culture", "customs", "language", "local life")):
        return "all"
    if "coffee" in q:
        return "coffee"
    if any(
        k in q
        for k in (
            "must try food",
            "must-try food",
            "street food",
            "local specialty",
            "grab a bite",
            "bite near",
            "restaurant",
            "vegetarian",
            "food",
            " eat ",
            "dining",
            "cuisine",
        )
    ):
        return "food"
    return None


def _format_nearby_poi_line(poi: dict[str, Any], *, numbered: bool = False, index: int = 0) -> str:
    pname = poi.get("name") or "Unnamed"
    dist = poi.get("distanceMiles")
    addr = poi.get("address") or ""
    tags = poi.get("tags") or {}
    cuisine = tags.get("cuisine") or tags.get("amenity")
    hours = tags.get("opening_hours")
    lat = poi.get("lat")
    lng = poi.get("lng")
    dist_s = f"{dist} mi" if dist is not None else "distance unknown"
    parts = [f"{index}. {pname}" if numbered else f"- {pname}", f"({dist_s})"]
    if lat is not None and lng is not None:
        parts.append(f"{float(lat):.5f}, {float(lng):.5f}")
    if cuisine and str(cuisine).lower() not in ("restaurant", "fast_food", "cafe"):
        parts.append(f"cuisine: {str(cuisine).replace('_', ' ')}")
    elif poi.get("category"):
        parts.append(str(poi.get("category")))
    if hours:
        parts.append(f"hours: {hours}")
    elif numbered:
        parts.append("hours: not mapped in OpenStreetMap")
    if addr:
        parts.append(str(addr))
    return " — ".join(parts)


def build_nearby_list_message(
    *,
    pois: list[dict[str, Any]],
    category: str,
    place_label: str,
    radius_mi: float,
    requested_count: int | None = None,
) -> str:
    label = category.replace("_", " ")
    if not pois:
        req = f"{requested_count} " if requested_count else ""
        return (
            f"I searched OpenStreetMap within ~{radius_mi:g} mi of {place_label} "
            f"and found 0 {label}s mapped there.\n\n"
            f"This pin looks remote — I can't list {req}{label}s because none are in "
            "OpenStreetMap near here. Hours and locations only come from mapped data; "
            "I won't invent restaurants.\n\n"
            "Try moving the pin to the nearest town, or tap Search nearby on map."
        )

    header = (
        f"Found {len(pois)} {label}{'s' if not label.endswith('s') else ''} "
        f"within ~{radius_mi:g} mi of {place_label} (from OpenStreetMap):"
    )
    lines = [header, ""]
    for i, poi in enumerate(pois, 1):
        lines.append(_format_nearby_poi_line(poi, numbered=True, index=i))

    if requested_count and len(pois) < requested_count:
        lines.append("")
        lines.append(
            f"Only {len(pois)} are mapped nearby — not {requested_count}. "
            "Pick a town or widen your search for more."
        )
    return "\n".join(lines)


def build_activities_message(
    *,
    place_label: str,
    pois: list[dict[str, Any]],
    context_block: str | None = None,
    radius_mi: float = 50.0,
) -> str:
    lines = [f"What you can do near {place_label}:"]

    if pois:
        lines.append("")
        lines.append(f"Mapped spots within ~{radius_mi:g} mi (OpenStreetMap):")
        for i, poi in enumerate(pois[:10], 1):
            lines.append(_format_nearby_poi_line(poi, numbered=True, index=i))

    wiki_line = None
    if context_block:
        for raw in context_block.splitlines():
            line = raw.strip()
            if line.startswith("Wikipedia:") or "heritage" in line.lower() or "known for" in line.lower():
                wiki_line = line[:320]
                break
        if not wiki_line and "Wikipedia" in context_block:
            wiki_line = context_block.strip()[:320]

    if wiki_line:
        lines.append("")
        lines.append(f"About the area — {wiki_line}")

    if not pois:
        lines.append("")
        lines.append(
            "This pin looks remote — few mapped attractions nearby. Practical ideas:"
            "\n• Wildlife viewing and photography"
            "\n• Hiking or backcountry routes (check access, permits, and weather)"
            "\n• Canoeing, fishing, or camping if water or campsites are reachable"
            "\n• Stargazing in dark-sky areas"
            "\n\nStock fuel and supplies before you go. Move the pin to the nearest town "
            "for restaurants, lodging, and services."
        )
    elif len(pois) < 3:
        lines.append("")
        lines.append(
            "Options are sparse here — widen your search on the map or pick a nearby town for more."
        )

    return "\n".join(lines)


def _maps_search_url(lat: float, lng: float, label: str | None = None) -> str:
    q = quote(label) if label else f"{lat},{lng}"
    return f"https://www.google.com/maps/search/?api=1&query={q}"


def _osm_url(osm_type: str, osm_id: str) -> str:
    kind = osm_type if osm_type in {"node", "way", "relation"} else "node"
    return f"https://www.openstreetmap.org/{kind}/{osm_id}"


def _explore_url(city: str | None) -> str:
    if city and city.strip():
        return f"/explore?city={quote(city.strip())}"
    return "/explore"


async def fetch_discovery_sources(
    place: dict[str, Any],
    ctx: dict[str, Any] | None = None,
    *,
    user_message: str | None = None,
) -> tuple[list[WayraSource], str]:
    """Wikipedia + map link for a selected place."""
    place = normalize_place_for_sources(place, ctx)
    name = str(place.get("name") or "Selected location")
    lat = float(place["lat"])
    lng = float(place["lng"])
    category = str(place.get("category") or "Place")
    city = place.get("city")
    state = place.get("state")
    country = place.get("country")

    wiki_lookup_name = name
    if is_generic_place_name(name) and city:
        wiki_lookup_name = str(city)

    wiki = await PlaceWikipediaService.get_wiki_summary(
        name=wiki_lookup_name,
        category=category if not is_generic_place_name(name) else "City",
        lat=lat,
        lng=lng,
        city=str(city) if city else None,
        state=str(state) if state else None,
        country=str(country) if country else None,
        source="map_pick",
    )

    if not wiki.get("available") and city and wiki_lookup_name != str(city):
        wiki = await PlaceWikipediaService.get_wiki_summary(
            name=str(city),
            category="City",
            lat=lat,
            lng=lng,
            city=str(city),
            state=str(state) if state else None,
            country=str(country) if country else None,
            source="map_pick",
        )

    if not wiki.get("available") and state:
        wiki = await PlaceWikipediaService.get_wiki_summary(
            name=str(state),
            category="Region",
            lat=lat,
            lng=lng,
            city=str(city) if city else None,
            state=str(state),
            country=str(country) if country else None,
            source="map_pick",
        )

    if not wiki.get("available") and country and str(country).lower() not in {
        str(state or "").lower(),
        str(city or "").lower(),
    }:
        wiki = await PlaceWikipediaService.get_wiki_summary(
            name=str(country),
            category="Country",
            lat=lat,
            lng=lng,
            city=str(city) if city else None,
            state=str(state) if state else None,
            country=str(country),
            source="map_pick",
        )

    display_name = name if not is_generic_place_name(name) else (str(city) if city else name)

    sources: list[WayraSource] = [
        WayraSource(
            label=f"Show on map · {display_name}",
            url=_maps_search_url(lat, lng, display_name),
            source_type="maps",
            lat=lat,
            lng=lng,
        ),
    ]

    if city:
        sources.append(
            WayraSource(
                label=f"Explore {city}",
                url=_explore_url(str(city)),
                source_type="explore",
            )
        )

    snippets: list[str] = []
    food_question = bool(
        user_message
        and any(k in user_message.lower() for k in ("food", "eat", "restaurant", "cuisine", "vegetarian"))
    )
    if food_question:
        snippets.append(
            f"AT THIS PIN ({display_name}): Historic public square / landmark — "
            "limited or no dedicated dining on the exact pin."
        )
        city_label = str(city) if city else "the surrounding city"
        snippets.append(
            f"IN THE WIDER CITY ({city_label}): Regional cuisine and restaurants are in surrounding streets."
        )

    if wiki.get("available"):
        title = wiki.get("title") or name
        summary = wiki.get("summary") or ""
        url = wiki.get("url") or ""
        if url:
            sources.insert(
                0,
                WayraSource(
                    label=f"Wikipedia · {title}",
                    url=str(url),
                    source_type="wikipedia",
                    snippet=str(summary)[:400] if summary else None,
                ),
            )
        if summary:
            snippets.append(f"Wikipedia ({title}): {str(summary)[:500]}")

    if not snippets:
        area_parts = [p for p in (city, state, country) if isinstance(p, str) and p.strip()]
        area = ", ".join(area_parts) if area_parts else display_name
        snippets.append(f"Place: {display_name} ({category}) at {area}.")

    origin_block = build_user_origin_planning_block(ctx, place)
    if origin_block:
        snippets.insert(0, origin_block)

    live_block = ctx.get("liveContextBlock") if ctx else None
    if not isinstance(live_block, str) or not live_block.strip():
        from app.services.wayra_place_context import build_live_context_block

        live_block = build_live_context_block(ctx)
    if isinstance(live_block, str) and live_block.strip():
        snippets.append(f"Live map context:\n{live_block.strip()[:800]}")

    if user_message:
        supplement = _discovery_supplement_category(user_message)
        if supplement:
            try:
                extra_sources, extra_block, _extra_pois = await fetch_nearby_sources(
                    category=supplement,
                    lat=lat,
                    lng=lng,
                    place_label=display_name,
                )
                if extra_block and "No " not in extra_block[:20]:
                    snippets.append(f"NEARBY (OpenStreetMap):\n{extra_block}")
                    for src in extra_sources[1:4]:
                        if src.source_type == "osm":
                            sources.append(src)
            except Exception:  # noqa: BLE001
                pass
        elif food_question:
            try:
                extra_sources, extra_block, _extra_pois = await fetch_nearby_sources(
                    category="food",
                    lat=lat,
                    lng=lng,
                    place_label=display_name,
                )
                if extra_block and "No " not in extra_block[:20]:
                    snippets.append(f"NEARBY (OpenStreetMap):\n{extra_block}")
            except Exception:  # noqa: BLE001
                pass

    return sources[:8], "\n".join(snippets)


async def fetch_nearby_sources(
    *,
    category: str,
    lat: float,
    lng: float,
    place_label: str,
    radius_meters: int | None = None,
    limit: int = 8,
) -> tuple[list[WayraSource], str, list[dict[str, Any]]]:
    """OSM nearby POIs for pharmacy/hospital/etc. questions."""
    radius = radius_meters or _NEARBY_RADIUS_M.get(category, _DEFAULT_NEARBY_RADIUS_M)
    fetch_limit = min(max(limit, 8), 20)
    pois = await PlacesNearbyService.search_nearby_places(
        category=category,
        lat=lat,
        lng=lng,
        radius_meters=radius,
        limit=fetch_limit,
    )

    sources: list[WayraSource] = [
        WayraSource(
            label="Search nearby on map",
            url=_maps_search_url(lat, lng, category.replace("_", " ")),
            source_type="maps",
            lat=lat,
            lng=lng,
        ),
    ]

    lines: list[str] = []
    display_pois = pois[:fetch_limit]
    for poi in display_pois:
        pname = poi.get("name") or "Unnamed"
        dist = poi.get("distanceMiles")
        addr = poi.get("address") or ""
        dist_s = f"{dist} mi" if dist is not None else "?"
        lines.append(_format_nearby_poi_line(poi))

        osm_id = poi.get("osmId")
        osm_type = poi.get("osmType") or "node"
        poi_lat = poi.get("lat")
        poi_lng = poi.get("lng")
        url = (
            _osm_url(str(osm_type), str(osm_id))
            if osm_id
            else _maps_search_url(float(poi_lat), float(poi_lng), str(pname))
            if poi_lat is not None and poi_lng is not None
            else _maps_search_url(lat, lng, str(pname))
        )
        poi_lat_f = float(poi_lat) if poi_lat is not None else None
        poi_lng_f = float(poi_lng) if poi_lng is not None else None
        sources.append(
            WayraSource(
                label=f"{pname} · {dist_s}",
                url=url,
                source_type="osm",
                snippet=str(addr)[:120] if addr else None,
                lat=poi_lat_f,
                lng=poi_lng_f,
            )
        )

    if not lines:
        mi = round(radius / 1609.34, 1)
        block = (
            f"No {category.replace('_', ' ')} found within ~{mi} mi of {place_label} "
            "in OpenStreetMap. This area may be remote or sparsely mapped — try the map search link."
        )
    else:
        block = f"Nearby {category.replace('_', ' ')} from OpenStreetMap near {place_label}:\n" + "\n".join(lines)

    source_cap = min(max(8, fetch_limit), 12)
    return sources[:source_cap], block, display_pois


async def fetch_nearby_sources_combined(
    *,
    lat: float,
    lng: float,
    place_label: str,
    categories: tuple[str, ...] = ("food", "coffee", "attraction", "museum"),
    limit: int = 10,
) -> tuple[list[WayraSource], str, list[dict[str, Any]]]:
    """Merge OSM results across categories for broad 'restaurants, cafes, attractions' questions."""
    seen: set[tuple[Any, Any]] = set()
    merged_pois: list[dict[str, Any]] = []
    for category in categories:
        _sources, _block, pois = await fetch_nearby_sources(
            category=category,
            lat=lat,
            lng=lng,
            place_label=place_label,
            limit=limit,
        )
        for poi in pois:
            key = (poi.get("osmId"), str(poi.get("name") or "").strip().lower())
            if key in seen:
                continue
            seen.add(key)
            merged_pois.append({**poi, "_category": category})

    merged_pois.sort(key=lambda p: float(p.get("distanceMiles") or 999))
    merged_pois = merged_pois[:limit]

    sources: list[WayraSource] = [
        WayraSource(
            label="Search nearby on map",
            url=_maps_search_url(lat, lng, "nearby places"),
            source_type="maps",
            lat=lat,
            lng=lng,
        ),
    ]
    lines: list[str] = []
    for poi in merged_pois:
        lines.append(_format_nearby_poi_line(poi))
        pname = poi.get("name") or "Unnamed"
        dist = poi.get("distanceMiles")
        dist_s = f"{dist} mi" if dist is not None else "?"
        osm_id = poi.get("osmId")
        osm_type = poi.get("osmType") or "node"
        poi_lat = poi.get("lat")
        poi_lng = poi.get("lng")
        url = (
            _osm_url(str(osm_type), str(osm_id))
            if osm_id
            else _maps_search_url(float(poi_lat), float(poi_lng), str(pname))
            if poi_lat is not None and poi_lng is not None
            else _maps_search_url(lat, lng, str(pname))
        )
        sources.append(
            WayraSource(
                label=f"{pname} · {dist_s}",
                url=url,
                source_type="osm",
                snippet=str(poi.get("address") or "")[:120] or None,
                lat=float(poi_lat) if poi_lat is not None else None,
                lng=float(poi_lng) if poi_lng is not None else None,
            )
        )

    if not lines:
        block = (
            f"No restaurants, cafes, or attractions found within mapped radius of {place_label} "
            "in OpenStreetMap. Try the map search link or widen your search."
        )
    else:
        block = (
            f"Nearby places from OpenStreetMap near {place_label} "
            "(restaurants, cafes, attractions):\n" + "\n".join(lines)
        )
    return sources[:12], block, merged_pois


def _place_from_ctx(ctx: dict[str, Any] | None) -> dict[str, Any] | None:
    if not ctx:
        return None
    for key in ("selectedPlace", "activeMapPin"):
        selected = ctx.get(key)
        if isinstance(selected, dict) and selected.get("lat") is not None:
            return selected
    return None


def build_user_origin_planning_block(
    ctx: dict[str, Any] | None,
    place: dict[str, Any] | None = None,
) -> str:
    """
    Clarify home (GPS) vs map pin (planning destination) for Live trip answers.
    Injected into LLM source blocks so reach/flight/budget questions plan from home.
    """
    if not ctx:
        return ""
    target = place or _place_from_ctx(ctx)
    if not target:
        return ""

    user = ctx.get("userLocation")
    if not isinstance(user, dict):
        return ""

    u_lat, u_lng = user.get("lat"), user.get("lng")
    p_lat, p_lng = target.get("lat"), target.get("lng")
    if not all(isinstance(v, (int, float)) for v in (u_lat, u_lng, p_lat, p_lng)):
        return ""

    home_parts = [
        p.strip()
        for p in (user.get("city"), user.get("state"), user.get("country"))
        if isinstance(p, str) and p.strip()
    ]
    home_label = ", ".join(home_parts) if home_parts else "your current location"

    dest = normalize_place_for_sources(target, ctx)
    dest_label = str(dest.get("name") or "the selected destination")
    dest_parts = [
        p.strip()
        for p in (dest.get("city"), dest.get("state"), dest.get("country"))
        if isinstance(p, str) and p.strip() and p.strip().lower() != dest_label.lower()
    ]
    dest_region = ", ".join(dest_parts) if dest_parts else ""

    miles = calculate_distance_miles(float(u_lat), float(u_lng), float(p_lat), float(p_lng))

    lines = [
        "USER TRIP CONTEXT (critical — use for logistics and planning answers):",
        f"- User is physically in: {home_label} (home/GPS — where they are NOW).",
        (
            f"- Map pin / planning destination: {dest_label}"
            + (f" ({dest_region})" if dest_region else "")
            + " — where they want to go, NOT where they are standing unless they say they are already there."
        ),
        f"- Separation: about {miles:,.0f} mi ({miles * 1.609:,.0f} km) straight line.",
    ]

    feas = assess_drive_feasibility(ctx, dest)
    if not feas.feasible and feas.message:
        lines.append(f"- Ground route: {feas.message}")

    route = ctx.get("routePreview")
    if isinstance(route, dict):
        for key in ("lastMileNotice", "borderNotice"):
            val = route.get(key)
            if isinstance(val, str) and val.strip():
                lines.append(f"- Route note: {val.strip()}")

    notice = ctx.get("contextNotice")
    if isinstance(notice, str) and notice.strip():
        lines.append(f"- Map notice: {notice.strip()}")

    lines.extend(
        [
            "Answer reach, flights, timing, budget, and day-count FROM home TO the destination pin.",
            "Answer on-site weather, activities, and local conditions about the destination pin.",
            "Do not tell the user they are physically at the pin when home and pin are far apart.",
        ]
    )
    return "\n".join(lines)


def build_user_place_distance_block(
    ctx: dict[str, Any] | None,
    place: dict[str, Any] | None,
) -> str:
    """Free straight-line (+ optional route) distance for cost-free how-far answers."""
    if not ctx or not place:
        return ""
    user = ctx.get("userLocation")
    if not isinstance(user, dict):
        return ""
    u_lat, u_lng = user.get("lat"), user.get("lng")
    p_lat, p_lng = place.get("lat"), place.get("lng")
    if not all(isinstance(v, (int, float)) for v in (u_lat, u_lng, p_lat, p_lng)):
        return ""

    miles = calculate_distance_miles(float(u_lat), float(u_lng), float(p_lat), float(p_lng))
    user_label = (
        user.get("city")
        or user.get("state")
        or user.get("country")
        or "your location"
    )
    place_label = str(place.get("name") or "the selected place")
    lines = [
        (
            f"Straight-line distance from {user_label} to {place_label}: "
            f"{miles:,.0f} mi ({miles * 1.609:,.0f} km)."
        )
    ]

    route = ctx.get("routePreview")
    if isinstance(route, dict):
        dist = route.get("distanceMeters")
        dur = route.get("durationSeconds")
        if isinstance(dist, (int, float)) and dist > 0:
            lines.append(f"Driving route distance: {round(float(dist) / 1609.34, 1)} mi.")
        if isinstance(dur, (int, float)) and dur > 0:
            lines.append(f"Driving route duration: {int(dur) // 60} min.")

    return "\n".join(lines)


def build_route_context_block(ctx: dict[str, Any] | None) -> str:
    if not ctx:
        return ""
    parts: list[str] = []
    origin = build_user_origin_planning_block(ctx)
    if origin:
        parts.append(origin)
    route = ctx.get("routePreview")
    if isinstance(route, dict):
        dur = route.get("durationSeconds")
        dist = route.get("distanceMeters")
        if dur:
            parts.append(f"Route duration: {int(dur) // 60} min")
        if dist:
            parts.append(f"Route distance: {round(float(dist) / 1609.34, 1)} mi")
        for key in ("lastMileNotice", "borderNotice"):
            val = route.get(key)
            if isinstance(val, str) and val.strip():
                parts.append(val.strip())
    notice = ctx.get("contextNotice")
    if isinstance(notice, str) and notice.strip():
        parts.append(notice.strip())
    live_block = ctx.get("liveContextBlock")
    if isinstance(live_block, str) and live_block.strip():
        parts.append(live_block.strip()[:600])
    return "\n".join(parts)
