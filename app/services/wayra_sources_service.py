"""Fetch open sources (Wikipedia, OSM nearby) for Perplexity-style Wayra answers."""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

from app.schemas.ai_assistant import WayraSource
from app.services.place_wikipedia_service import PlaceWikipediaService
from app.services.places_nearby_service import PlacesNearbyService


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


async def fetch_discovery_sources(place: dict[str, Any]) -> tuple[list[WayraSource], str]:
    """Wikipedia + map link for a selected place."""
    name = str(place.get("name") or "Selected location")
    lat = float(place["lat"])
    lng = float(place["lng"])
    category = str(place.get("category") or "Place")
    city = place.get("city")
    state = place.get("state")
    country = place.get("country")

    wiki = await PlaceWikipediaService.get_wiki_summary(
        name=name,
        category=category,
        lat=lat,
        lng=lng,
        city=str(city) if city else None,
        state=str(state) if state else None,
        country=str(country) if country else None,
        source="map_pick",
    )

    sources: list[WayraSource] = [
        WayraSource(
            label=f"Open in Maps · {name}",
            url=_maps_search_url(lat, lng, name),
            source_type="maps",
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
        area = ", ".join(area_parts) if area_parts else name
        snippets.append(f"Place: {name} ({category}) at {area}.")

    return sources, "\n".join(snippets)


async def fetch_nearby_sources(
    *,
    category: str,
    lat: float,
    lng: float,
    place_label: str,
) -> tuple[list[WayraSource], str]:
    """OSM nearby POIs for pharmacy/hospital/etc. questions."""
    pois = await PlacesNearbyService.search_nearby_places(
        category=category,
        lat=lat,
        lng=lng,
        radius_meters=5000,
        limit=8,
    )

    sources: list[WayraSource] = [
        WayraSource(
            label=f"Search nearby on map",
            url=_maps_search_url(lat, lng, category.replace("_", " ")),
            source_type="maps",
        ),
    ]

    lines: list[str] = []
    for poi in pois[:6]:
        pname = poi.get("name") or "Unnamed"
        dist = poi.get("distanceMiles")
        addr = poi.get("address") or ""
        dist_s = f"{dist} mi" if dist is not None else "?"
        lines.append(f"- {pname} ({dist_s}){': ' + addr if addr else ''}")

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
                snippet=str(addr)[:120] if addr else None,
            )
        )

    if not lines:
        block = f"No {category.replace('_', ' ')} found within ~3 mi of {place_label} in OpenStreetMap."
    else:
        block = f"Nearby {category.replace('_', ' ')} from OpenStreetMap near {place_label}:\n" + "\n".join(lines)

    return sources[:8], block


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
