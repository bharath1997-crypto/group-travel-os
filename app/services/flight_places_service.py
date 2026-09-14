"""
Flight place autocomplete, nearby lookup, and hierarchical airport browse.

Providers (autocomplete):
  1. Duffel /places/suggestions when DUFFEL_API_KEY is set
  2. Travelpayouts places2 (public)
  3. Optional Kiwi Tequila locations when KIWI_API_KEY is set
  4. OurAirports dataset (data/airports.csv, ODbL)

Nearby + browse use OurAirports only — no fabricated fallback rows.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.schemas.flight_places import (
    FlightCityItem,
    FlightCountryItem,
    FlightNearbyAirportsResponse,
    FlightPlaceSuggestion,
    FlightRegionItem,
)
from app.services.airport_dataset_service import AirportDatasetService, AirportRecord, _country_label
from app.services import duffel_client
from config import settings

logger = logging.getLogger(__name__)

TRAVELPAYOUTS_PLACES_URL = "https://autocomplete.travelpayouts.com/places2"
KIWI_LOCATIONS_URL = "https://tequila-api.kiwi.com/locations/query"


def _label_for_tp_place(row: dict[str, Any]) -> str:
    name = str(row.get("name") or "").strip()
    country = str(row.get("country_name") or "").strip()
    if name and country:
        return f"{name}, {country}"
    return name or country or str(row.get("code") or "")


def _detail_for_tp_place(row: dict[str, Any]) -> str:
    code = str(row.get("code") or "").upper()
    place_type = str(row.get("type") or "city")
    if place_type == "airport":
        return code
    return f"All airports · {code}" if code else ""


def _record_to_suggestion(
    row: AirportRecord,
    *,
    distance_km: float | None = None,
    group: str = "",
    place_type: str = "airport",
    metro_iata: str = "",
) -> FlightPlaceSuggestion:
    city = row.municipality or ""
    region = AirportDatasetService.region_name_for(row.iso_region, row.iso_country)
    country = _country_label(row.iso_country)
    detail_parts = [row.iata]
    if city:
        detail_parts.append(city)
    if region:
        detail_parts.append(region)
    if country:
        detail_parts.append(country)
    detail = " · ".join(detail_parts)
    if distance_km is not None:
        detail = f"{distance_km:.0f} km · {detail}"

    return FlightPlaceSuggestion(
        id=f"oa-airport-{row.iata}",
        label=row.name,
        detail=detail,
        iata=row.iata,
        place_type=place_type,
        city=city,
        region=region,
        country=country,
        country_code=row.iso_country,
        distance_km=round(distance_km, 1) if distance_km is not None else None,
        group=group,
        metro_iata=metro_iata,
    )


def _from_duffel_places(query: str, limit: int) -> list[FlightPlaceSuggestion]:
    try:
        rows = duffel_client.search_place_suggestions(query)
    except Exception as exc:
        logger.warning("Duffel place suggestions failed: %s", exc)
        return []

    out: list[FlightPlaceSuggestion] = []
    for row in rows:
        iata = str(row.get("iata_code") or row.get("iata_city_code") or "").upper()
        if len(iata) != 3:
            continue
        name = str(row.get("name") or iata)
        place_type = str(row.get("type") or "airport")
        city_name = ""
        if isinstance(row.get("city"), dict):
            city_name = str(row["city"].get("name") or "")
        country_code = str(row.get("country_code") or row.get("iata_country_code") or "")
        country_name = str(row.get("country_name") or country_code)
        label = f"{name}, {country_name}" if country_name else name
        detail = iata if place_type == "airport" else f"All airports · {iata}"
        metro = iata if place_type in {"city", "metro"} else str(row.get("iata_city_code") or "")

        out.append(
            FlightPlaceSuggestion(
                id=f"duffel-{place_type}-{iata}",
                label=label,
                detail=detail,
                iata=iata,
                place_type="city" if place_type in {"city", "metro"} else place_type,
                city=city_name,
                country=country_name,
                country_code=country_code,
                metro_iata=metro.upper() if metro else "",
                group="Cities and all airports" if place_type in {"city", "metro"} else "Airports",
            )
        )
        if len(out) >= limit:
            break
    return out


def _from_travelpayouts_places(query: str, limit: int) -> list[FlightPlaceSuggestion]:
    q = query.strip()
    if len(q) < 1:
        return []

    try:
        with httpx.Client(timeout=6.0) as client:
            r = client.get(
                TRAVELPAYOUTS_PLACES_URL,
                params={
                    "term": q,
                    "locale": "en",
                    "types[]": ["city", "airport", "country"],
                },
            )
        r.raise_for_status()
        rows = r.json()
    except Exception as exc:
        logger.warning("Travelpayouts places autocomplete failed: %s", exc)
        return []

    if not isinstance(rows, list):
        return []

    out: list[FlightPlaceSuggestion] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        code = str(row.get("code") or "").upper()
        if not code or code in seen:
            continue
        seen.add(code)
        place_type = str(row.get("type") or "city")
        country = str(row.get("country_name") or "")
        group = (
            "Countries"
            if place_type == "country"
            else "Cities and all airports"
            if place_type == "city"
            else "Airports"
        )
        out.append(
            FlightPlaceSuggestion(
                id=f"tp-{place_type}-{code}",
                label=_label_for_tp_place(row),
                detail=_detail_for_tp_place(row),
                iata=code,
                place_type=place_type,
                city=str(row.get("name") or "") if place_type == "city" else "",
                country=country,
                country_code=str(row.get("country_code") or ""),
                metro_iata=code if place_type == "city" else "",
                group=group,
            )
        )
        if len(out) >= limit:
            break
    return out


def _from_kiwi_locations(query: str, limit: int) -> list[FlightPlaceSuggestion]:
    api_key = (settings.kiwi_api_key or "").strip()
    q = query.strip()
    if not api_key or len(q) < 1:
        return []

    try:
        with httpx.Client(timeout=6.0) as client:
            r = client.get(
                KIWI_LOCATIONS_URL,
                params={
                    "term": q,
                    "locale": "en-US",
                    "limit": limit,
                    "active_only": "true",
                    "location_types": "airport,city",
                },
                headers={"apikey": api_key},
            )
        r.raise_for_status()
        rows = r.json()
    except Exception as exc:
        logger.warning("Kiwi locations autocomplete failed: %s", exc)
        return []

    if not isinstance(rows, dict):
        return []
    locations = rows.get("locations")
    if not isinstance(locations, list):
        return []

    out: list[FlightPlaceSuggestion] = []
    for row in locations:
        if not isinstance(row, dict):
            continue
        code = str(row.get("code") or row.get("id") or "").upper()
        if not code:
            continue
        name = str(row.get("name") or code)
        country = str(row.get("country", {}).get("name") if isinstance(row.get("country"), dict) else "")
        label = f"{name}, {country}" if country else name
        place_type = str(row.get("type") or "city")
        out.append(
            FlightPlaceSuggestion(
                id=f"kiwi-{place_type}-{code}",
                label=label,
                detail=code,
                iata=code,
                place_type=place_type,
                country=country,
                metro_iata=code if place_type == "city" else "",
                group="Cities and all airports" if place_type == "city" else "Airports",
            )
        )
    return out


def _from_dataset_search(query: str, limit: int) -> list[FlightPlaceSuggestion]:
    rows = AirportDatasetService.search(query, limit=limit)
    return [_record_to_suggestion(row, group="Airports") for row in rows]


class FlightPlacesService:
    @staticmethod
    def suggest(query: str, limit: int = 12) -> list[FlightPlaceSuggestion]:
        q = query.strip()
        if len(q) < 1:
            return []

        merged: list[FlightPlaceSuggestion] = []
        seen: set[str] = set()

        for provider in (
            _from_duffel_places,
            _from_travelpayouts_places,
            _from_kiwi_locations,
            _from_dataset_search,
        ):
            for row in provider(q, limit):
                if row.iata in seen:
                    continue
                seen.add(row.iata)
                merged.append(row)
                if len(merged) >= limit:
                    return merged[:limit]

        if len(q) == 3 and q.isalpha() and not merged:
            exact = AirportDatasetService.get_by_iata(q.upper())
            if exact:
                merged.append(_record_to_suggestion(exact, group="Airports"))

        return merged[:limit]

    @staticmethod
    def validate_iata(code: str) -> bool:
        normalized = code.strip().upper()
        if len(normalized) != 3:
            return False
        if AirportDatasetService.validate_iata(normalized):
            return True
        return bool(FlightPlacesService.suggest(normalized, limit=1))

    @staticmethod
    def nearby(lat: float, lng: float, *, limit: int = 12) -> FlightNearbyAirportsResponse:
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            from app.utils.exceptions import AppException

            AppException.bad_request("Invalid latitude or longitude")

        ranked = AirportDatasetService.nearby(lat, lng, limit=limit)
        if not ranked and not AirportDatasetService.is_configured():
            from app.utils.exceptions import AppException

            AppException.service_unavailable("Airport dataset is not available")

        airports = [
            _record_to_suggestion(row, distance_km=dist, group="Nearby airports")
            for row, dist in ranked
        ]
        return FlightNearbyAirportsResponse(airports=airports, query_lat=lat, query_lng=lng)

    @staticmethod
    def list_countries() -> list[FlightCountryItem]:
        if not AirportDatasetService.is_configured():
            from app.utils.exceptions import AppException

            AppException.service_unavailable("Airport dataset is not available")

        return [
            FlightCountryItem(code=row["code"], name=row["name"], airport_count=int(row["airport_count"]))
            for row in AirportDatasetService.list_countries()
        ]

    @staticmethod
    def list_regions(country: str) -> list[FlightRegionItem]:
        if not AirportDatasetService.is_configured():
            from app.utils.exceptions import AppException

            AppException.service_unavailable("Airport dataset is not available")

        return [
            FlightRegionItem(
                code=row["code"],
                name=row["name"],
                country_code=row["country_code"],
                airport_count=int(row["airport_count"]),
                region_code=row.get("region_code") or "",
                sample_cities=row.get("sample_cities") or "",
                subtitle=row.get("subtitle") or "",
            )
            for row in AirportDatasetService.list_regions(country)
        ]

    @staticmethod
    def list_cities(country: str, region: str | None = None) -> list[FlightCityItem]:
        if not AirportDatasetService.is_configured():
            from app.utils.exceptions import AppException

            AppException.service_unavailable("Airport dataset is not available")

        return [
            FlightCityItem(
                name=row["name"],
                country_code=row["country_code"],
                region_code=row.get("region_code") or "",
                region_name=row.get("region_name") or "",
                airport_count=int(row["airport_count"]),
            )
            for row in AirportDatasetService.list_cities(country, region)
        ]

    @staticmethod
    def list_airports(
        country: str,
        *,
        region: str | None = None,
        city: str | None = None,
        limit: int = 50,
        lat: float | None = None,
        lng: float | None = None,
    ) -> list[FlightPlaceSuggestion]:
        if not AirportDatasetService.is_configured():
            from app.utils.exceptions import AppException

            AppException.service_unavailable("Airport dataset is not available")

        ranked = AirportDatasetService.list_airports(
            country,
            region=region,
            city=city,
            limit=limit,
            lat=lat,
            lng=lng,
        )
        suggestions = [
            _record_to_suggestion(row, distance_km=dist, group="Airports")
            for row, dist in ranked
        ]

        if city:
            metro = FlightPlacesService._metro_for_city(city, country)
            if metro and metro not in {s.iata for s in suggestions}:
                suggestions.insert(
                    0,
                    FlightPlaceSuggestion(
                        id=f"metro-{metro}",
                        label=f"All airports — {city}",
                        detail=f"All airports · {metro}",
                        iata=metro,
                        place_type="city",
                        city=city,
                        country_code=country,
                        country=country,
                        metro_iata=metro,
                        group="Cities and all airports",
                    ),
                )
        return suggestions

    @staticmethod
    def _metro_for_city(city: str, country: str) -> str | None:
        query = f"{city} {country}".strip()
        for row in FlightPlacesService.suggest(query, limit=5):
            if row.place_type in {"city", "metro"} and row.iata:
                return row.iata
        return None
