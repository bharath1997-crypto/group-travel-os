"""
Detect international border crossings along a route geometry.
Uses cached Nominatim reverse geocoding to find where the route leaves one country
and enters another.
"""
from __future__ import annotations

import logging
import math
from typing import Any

from app.schemas.live_routing import BorderCrossingOut
from app.services.geocoding_service import GeocodingService

logger = logging.getLogger(__name__)

_COUNTRY_ALIASES: dict[str, str] = {
    "us": "united states",
    "usa": "united states",
    "u.s.": "united states",
    "u.s.a.": "united states",
    "uk": "united kingdom",
    "u.k.": "united kingdom",
}


def _normalize_country(country: str | None) -> str | None:
    if not country:
        return None
    token = " ".join(country.strip().lower().split())
    if not token:
        return None
    return _COUNTRY_ALIASES.get(token, token)


def _countries_differ(a: str | None, b: str | None) -> bool:
    left = _normalize_country(a)
    right = _normalize_country(b)
    if not left or not right:
        return False
    return left != right


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6_371_000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(a))


def _country_from_reverse(result: dict[str, Any] | None) -> str | None:
    if not result:
        return None
    address = result.get("address") or {}
    country = address.get("country")
    return country if isinstance(country, str) and country.strip() else None


async def _country_at_point(lat: float, lng: float) -> str | None:
    result = await GeocodingService.reverse_geocode(lat, lng)
    return _country_from_reverse(result)


def _sample_indices(coords: list[list[float]], max_samples: int = 18) -> list[int]:
    if len(coords) <= 2:
        return list(range(len(coords)))
    cumulative = [0.0]
    for idx in range(1, len(coords)):
        prev = coords[idx - 1]
        cur = coords[idx]
        cumulative.append(
            cumulative[-1] + _haversine_m(prev[1], prev[0], cur[1], cur[0])
        )
    total = cumulative[-1]
    if total <= 0:
        return [0, len(coords) - 1]

    target_count = min(max_samples, max(4, int(total / 30_000) + 2))
    indices = {0, len(coords) - 1}
    for step in range(1, target_count - 1):
        target_dist = (total * step) / (target_count - 1)
        best_idx = 0
        best_delta = float("inf")
        for idx, dist in enumerate(cumulative):
            delta = abs(dist - target_dist)
            if delta < best_delta:
                best_delta = delta
                best_idx = idx
        indices.add(best_idx)
    return sorted(indices)


def _highlight_segment(
    coords: list[list[float]], center_idx: int, span_m: float = 2_500.0
) -> list[list[float]]:
    if not coords:
        return []
    center = coords[center_idx]
    picked = [center]
    acc = 0.0
    for idx in range(center_idx - 1, -1, -1):
        cur = coords[idx]
        acc += _haversine_m(cur[1], cur[0], picked[0][1], picked[0][0])
        picked.insert(0, cur)
        if acc >= span_m:
            break
    acc = 0.0
    for idx in range(center_idx + 1, len(coords)):
        cur = coords[idx]
        acc += _haversine_m(picked[-1][1], picked[-1][0], cur[1], cur[0])
        picked.append(cur)
        if acc >= span_m:
            break
    return picked if len(picked) >= 2 else [coords[max(0, center_idx - 1)], center]


def _build_crossing(
    coords: list[list[float]],
    idx: int,
    from_country: str,
    to_country: str,
    *,
    approximate: bool = False,
) -> BorderCrossingOut:
    lng, lat = coords[idx]
    label = (
        f"Immigration check — {from_country} → {to_country}"
        if not approximate
        else f"Immigration check likely — {from_country} → {to_country}"
    )
    return BorderCrossingOut(
        latitude=lat,
        longitude=lng,
        fromCountry=from_country,
        toCountry=to_country,
        label=label,
        approximate=approximate,
        highlightGeometry=_highlight_segment(coords, idx),
    )


class BorderCrossingService:
    @staticmethod
    async def detect_crossings(
        coords: list[list[float]],
        origin_country: str | None,
        destination_country: str | None,
    ) -> list[BorderCrossingOut]:
        if len(coords) < 2:
            return []

        if not _countries_differ(origin_country, destination_country):
            origin_country = origin_country or await _country_at_point(
                coords[0][1], coords[0][0]
            )
            destination_country = destination_country or await _country_at_point(
                coords[-1][1], coords[-1][0]
            )
            if not _countries_differ(origin_country, destination_country):
                return []

        from_country = origin_country or "Origin"
        to_country = destination_country or "Destination"

        sample_idxs = _sample_indices(coords)
        sampled_countries: dict[int, str | None] = {}
        for idx in sample_idxs:
            lng, lat = coords[idx]
            sampled_countries[idx] = await _country_at_point(lat, lng)

        transition: tuple[int, int] | None = None
        for left, right in zip(sample_idxs, sample_idxs[1:]):
            left_country = sampled_countries.get(left)
            right_country = sampled_countries.get(right)
            if left_country and right_country and _countries_differ(left_country, right_country):
                transition = (left, right)
                from_country = left_country
                to_country = right_country
                break

        if transition:
            lo, hi = transition
            best_idx = hi
            while hi - lo > 1:
                mid = (lo + hi) // 2
                lng, lat = coords[mid]
                mid_country = await _country_at_point(lat, lng)
                if mid_country and _normalize_country(mid_country) == _normalize_country(
                    from_country
                ):
                    lo = mid
                else:
                    hi = mid
                    best_idx = mid
            return [_build_crossing(coords, best_idx, from_country, to_country)]

        # Countries differ at endpoints but sampling missed the transition — midpoint fallback.
        mid_idx = len(coords) // 2
        return [
            _build_crossing(
                coords,
                mid_idx,
                from_country,
                to_country,
                approximate=True,
            )
        ]

    @staticmethod
    def build_border_notice(crossings: list[BorderCrossingOut]) -> str | None:
        if not crossings:
            return None
        crossing = crossings[0]
        return (
            f"This route crosses an international border ({crossing.fromCountry} → "
            f"{crossing.toCountry}). Expect passport checks and immigration inspection "
            f"at the border."
        )
