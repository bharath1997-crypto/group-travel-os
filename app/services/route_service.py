"""
Combine Kiwi flights + Google Routes ground options for A→B discovery.

Ground segment uses Routes API computeRoutes (TRANSIT + DRIVE); failures are isolated.
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import date, datetime
from typing import Any
from urllib.parse import quote_plus

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.schemas.flight import FlightResult
from app.schemas.route import RouteSearchResponse, TransportMode, TransportOption
from app.services.flight_service import FlightService
from config import settings

logger = logging.getLogger(__name__)

GOOGLE_ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"
GROUND_CACHE_TTL_SECONDS = 3_600

_FIELD_MASK = (
    "routes.duration,routes.distanceMeters,"
    "routes.legs.steps.navigationInstruction,"
    "routes.legs.steps.transitDetails"
)

_ground_cache: dict[
    tuple[str, str],
    tuple[float, list[TransportOption]],
] = {}


def _travelpayouts_placeholder(origin: str, destination: str) -> str:
    """Ground-segment affiliate deep link (Travelpayouts marker from env)."""
    m = (settings.travelpayouts_marker or "").strip() or "727732"
    return (
        "https://www.travelpayouts.com/"
        f"?marker={quote_plus(m)}&partner_type=busbud_placeholder&utm_source=travello"
        f"&origin={quote_plus(origin.strip())}&destination={quote_plus(destination.strip())}"
    )


def _parse_route_duration_seconds(route: dict[str, Any]) -> int:
    raw = route.get("duration")
    if not isinstance(raw, str):
        return 0
    raw = raw.strip()
    if raw.endswith("s"):
        raw = raw[:-1]
    try:
        return max(0, int(float(raw)))
    except (TypeError, ValueError):
        return 0


def _navigation_step_text(step: dict[str, Any]) -> str | None:
    nav = step.get("navigationInstruction")
    if not isinstance(nav, dict):
        return None
    loc = nav.get("localizedValues")
    if isinstance(loc, dict):
        instr = loc.get("instructions")
        if isinstance(instr, dict):
            t = instr.get("text")
            if isinstance(t, str) and t.strip():
                return t.strip()
    ins = nav.get("instructions")
    if isinstance(ins, str) and ins.strip():
        return ins.strip()
    return None


def _infer_ground_mode_from_route(route: dict[str, Any]) -> TransportMode:
    bus = False
    rail = False
    for leg in route.get("legs") or []:
        if not isinstance(leg, dict):
            continue
        for step in leg.get("steps") or []:
            if not isinstance(step, dict):
                continue
            td = step.get("transitDetails")
            if not isinstance(td, dict):
                continue
            line = td.get("transitLine")
            if not isinstance(line, dict):
                continue
            vehicle = line.get("vehicle")
            if not isinstance(vehicle, dict):
                continue
            vt = str(vehicle.get("type") or "").upper()
            if vt == "BUS":
                bus = True
            if vt in (
                "SUBWAY",
                "COMMUTER_TRAIN",
                "TRAIN",
                "TRAM",
                "LIGHT_RAIL",
                "HEAVY_RAIL",
                "HIGH_SPEED_TRAIN",
                "LONG_DISTANCE_TRAIN",
            ):
                rail = True
    if bus and not rail:
        return TransportMode.BUS
    if rail and not bus:
        return TransportMode.TRAIN
    return TransportMode.TRANSIT


def _extract_step_lines(route: dict[str, Any]) -> list[str]:
    out: list[str] = []
    for leg in route.get("legs") or []:
        if not isinstance(leg, dict):
            continue
        for step in leg.get("steps") or []:
            if not isinstance(step, dict):
                continue
            line = _navigation_step_text(step)
            if line:
                out.append(line)
            td = step.get("transitDetails")
            if isinstance(td, dict):
                tl = td.get("transitLine")
                if isinstance(tl, dict):
                    name = tl.get("name") or tl.get("shortName")
                    agency = tl.get("agencies") or tl.get("agency")
                    agency_name = ""
                    if isinstance(agency, dict):
                        agency_name = str(agency.get("name") or "")
                    elif isinstance(agency, list) and agency:
                        first = agency[0]
                        if isinstance(first, dict):
                            agency_name = str(first.get("name") or "")
                    if isinstance(name, str) and name.strip():
                        chunk = name.strip()
                        if agency_name:
                            chunk = f"{chunk} ({agency_name})"
                        if chunk not in out:
                            out.append(chunk)
    return out[:24]


def _google_route_to_option(
    route: dict[str, Any],
    *,
    origin_label: str,
    dest_label: str,
    google_mode: str,
    booking_url: str,
) -> TransportOption | None:
    secs = _parse_route_duration_seconds(route)
    duration_minutes = max(0, int(round(secs / 60))) if secs else 0
    steps = _extract_step_lines(route)
    if google_mode.upper() == "DRIVE":
        summary = f"Drive {origin_label} → {dest_label}"
        mode = TransportMode.DRIVE
        prov = "Google Maps"
    else:
        mode = _infer_ground_mode_from_route(route)
        summary = f"{mode.value.title()}: {origin_label} → {dest_label}"
        prov = "Google Maps"

    if duration_minutes <= 0 and not steps:
        return None

    return TransportOption(
        mode=mode,
        summary=summary,
        duration_minutes=max(duration_minutes, 1) if duration_minutes == 0 else duration_minutes,
        price_estimate=None,
        currency=None,
        steps=steps if steps else [summary],
        booking_url=booking_url,
        provider=prov,
    )


def _flight_duration_minutes(f: FlightResult) -> int:
    if f.duration_minutes and f.duration_minutes > 0:
        return int(f.duration_minutes)
    try:
        dep = datetime.fromisoformat(f.departure_at.replace("Z", "+00:00"))
        arr = datetime.fromisoformat(f.arrival_at.replace("Z", "+00:00"))
        delta = arr - dep
        return max(1, int(delta.total_seconds() // 60))
    except (TypeError, ValueError):
        return 0


def _flights_to_transport_options(flights: list[FlightResult]) -> list[TransportOption]:
    options: list[TransportOption] = []
    for f in flights:
        dm = _flight_duration_minutes(f)
        if dm <= 0:
            dm = 1
        airline_part = ", ".join(f.airlines) if f.airlines else "Flight"
        summary = f"Fly {f.origin} → {f.destination}"
        if airline_part:
            summary = f"{summary} via {airline_part}"
        steps = [
            f"Airlines: {airline_part}",
            f"Depart {f.departure_at}",
            f"Arrive {f.arrival_at}",
        ]
        if f.stops > 0:
            steps.append(f"{f.stops} stop(s)")
        options.append(
            TransportOption(
                    mode=TransportMode.FLIGHT,
                summary=summary,
                duration_minutes=dm,
                price_estimate=float(f.price),
                currency=f.currency,
                steps=steps,
                booking_url=f.deep_link.strip() if f.deep_link else None,
                provider="Kiwi.com",
            ),
        )
    return options


def _safe_search_flights(
    origin: str,
    destination: str,
    day: date,
    adults: int,
) -> list[FlightResult]:
    try:
        return FlightService.search_flights(
            fly_from=origin,
            fly_to=destination,
            date_from=day,
            date_to=day,
            adults=adults,
            currency="USD",
            cabins="M",
            return_from=None,
            return_to=None,
        )
    except HTTPException as exc:
        logger.warning("Route discovery Kiwi HTTP error: %s", exc.detail)
        return []
    except (ValueError, TypeError, OSError, RuntimeError) as exc:
        logger.warning("Route discovery Kiwi error: %s", exc)
        return []


async def _post_compute_route(
    client: httpx.AsyncClient,
    api_key: str,
    origin: str,
    destination: str,
    travel_mode: str,
) -> dict[str, Any] | None:
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": _FIELD_MASK,
    }
    body: dict[str, Any] = {
        "origin": {"address": origin.strip()},
        "destination": {"address": destination.strip()},
        "travelMode": travel_mode,
        "routingPreference": "TRAFFIC_UNAWARE",
        "languageCode": "en-US",
        "units": "METRIC",
    }
    try:
        resp = await client.post(GOOGLE_ROUTES_URL, json=body, headers=headers)
        if resp.status_code != 200:
            logger.warning(
                "Google Routes %s HTTP %s: %s",
                travel_mode,
                resp.status_code,
                resp.text[:400],
            )
            return None
        data = resp.json()
        if isinstance(data, dict):
            return data
        return None
    except httpx.HTTPError as exc:
        logger.warning("Google Routes %s transport error: %s", travel_mode, exc)
        return None
    except ValueError as exc:
        logger.warning("Google Routes %s JSON error: %s", travel_mode, exc)
        return None


async def _fetch_ground_routes_parallel(
    origin: str,
    destination: str,
    api_key: str,
) -> list[TransportOption]:
    aff_url = _travelpayouts_placeholder(origin, destination)
    timeout = httpx.Timeout(35.0)
    options: list[TransportOption] = []
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            transit_raw, drive_raw = await asyncio.gather(
                _post_compute_route(client, api_key, origin, destination, "TRANSIT"),
                _post_compute_route(client, api_key, origin, destination, "DRIVE"),
                return_exceptions=False,
            )
    except (httpx.HTTPError, OSError, RuntimeError, asyncio.CancelledError) as exc:
        logger.warning("Google Routes parallel fetch failed: %s", exc)
        return []

    for label, payload in (("TRANSIT", transit_raw), ("DRIVE", drive_raw)):
        if not isinstance(payload, dict):
            continue
        routes = payload.get("routes")
        if not isinstance(routes, list) or not routes:
            continue
        first = routes[0]
        if not isinstance(first, dict):
            continue
        opt = _google_route_to_option(
            first,
            origin_label=origin.strip(),
            dest_label=destination.strip(),
            google_mode="DRIVE" if label == "DRIVE" else "TRANSIT",
            booking_url=aff_url,
        )
        if opt is not None:
            options.append(opt)
    return options


async def _get_ground_options_async(origin: str, destination: str) -> list[TransportOption]:
    o = origin.strip()
    d = destination.strip()
    if not o or not d:
        return []

    key = (o.upper(), d.upper())
    now = time.time()
    cached = _ground_cache.get(key)
    if cached is not None:
        expires_at, rows = cached
        if now < expires_at:
            return list(rows)

    api_key = (settings.google_routes_api_key or "").strip()
    if not api_key:
        logger.debug("GOOGLE_ROUTES_API_KEY unset — skipping ground routes")
        _ground_cache[key] = (now + GROUND_CACHE_TTL_SECONDS, [])
        return []

    try:
        options = await _fetch_ground_routes_parallel(o, d, api_key)
    except Exception as exc:
        logger.warning("Ground routes unexpected error: %s", exc)
        options = []

    _ground_cache[key] = (now + GROUND_CACHE_TTL_SECONDS, list(options))
    return list(options)


class RouteService:
    """Orchestrates Kiwi + Google into one sorted comparison payload."""

    @staticmethod
    async def search_routes(
        origin: str,
        destination: str,
        day: date,
        adults: int,
        db: Session,
    ) -> RouteSearchResponse:
        _ = db

        o_label = origin.strip()
        d_label = destination.strip()

        flight_task = asyncio.to_thread(
            _safe_search_flights,
            o_label,
            d_label,
            day,
            adults,
        )
        ground_task = _get_ground_options_async(o_label, d_label)

        gathered = await asyncio.gather(
            flight_task,
            ground_task,
            return_exceptions=True,
        )

        flights_raw: list[FlightResult] = []
        ground_list: list[TransportOption] = []

        fr = gathered[0]
        gr = gathered[1]

        if isinstance(fr, BaseException):
            logger.warning("Route discovery flight leg failed: %s", fr)
        elif isinstance(fr, list):
            flights_raw = fr

        if isinstance(gr, BaseException):
            logger.warning("Route discovery ground leg failed: %s", gr)
        elif isinstance(gr, list):
            ground_list = gr

        options: list[TransportOption] = []
        options.extend(_flights_to_transport_options(flights_raw))
        options.extend(ground_list)

        options.sort(
            key=lambda x: (
                x.duration_minutes if x.duration_minutes > 0 else 10**9,
                x.mode.value,
            ),
        )

        return RouteSearchResponse(
            origin=o_label,
            destination=d_label,
            options=options,
        )
