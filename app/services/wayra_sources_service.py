"""Fetch open sources (Wikipedia, OSM nearby) for Perplexity-style Wayra answers."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

from app.schemas.ai_assistant import WayraSource
from app.services.place_wikipedia_service import PlaceWikipediaService
from app.services.places_nearby_service import PlacesNearbyService, calculate_distance_miles
from app.services.wayra_place_context import is_generic_place_name, normalize_place_for_sources

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


def _format_nearby_poi_line(poi: dict[str, Any]) -> str:
    pname = poi.get("name") or "Unnamed"
    dist = poi.get("distanceMiles")
    addr = poi.get("address") or ""
    tags = poi.get("tags") or {}
    cuisine = tags.get("cuisine") or tags.get("amenity")
    hours = tags.get("opening_hours")
    dist_s = f"{dist} mi walk" if dist is not None else "distance unknown"
    parts = [f"- {pname} ({dist_s})"]
    if cuisine and str(cuisine).lower() not in ("restaurant", "fast_food", "cafe"):
        parts.append(f"cuisine: {str(cuisine).replace('_', ' ')}")
    elif poi.get("category"):
        parts.append(str(poi.get("category")))
    if hours:
        parts.append(f"hours: {hours}")
    if addr:
        parts.append(addr)
    return " — ".join(parts[:4])


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
                extra_sources, extra_block = await fetch_nearby_sources(
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
                extra_sources, extra_block = await fetch_nearby_sources(
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
) -> tuple[list[WayraSource], str]:
    """OSM nearby POIs for pharmacy/hospital/etc. questions."""
    radius = radius_meters or _NEARBY_RADIUS_M.get(category, _DEFAULT_NEARBY_RADIUS_M)
    pois = await PlacesNearbyService.search_nearby_places(
        category=category,
        lat=lat,
        lng=lng,
        radius_meters=radius,
        limit=8,
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
    for poi in pois[:6]:
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

    return sources[:8], block


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
