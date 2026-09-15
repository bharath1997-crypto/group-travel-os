"""
OurAirports CSV loader for browse + nearby airport queries.

Data: data/airports.csv (ODbL — see data/AIRPORTS_DATASET.md)
"""

from __future__ import annotations

import csv
import logging
import math
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
AIRPORTS_CSV = PROJECT_ROOT / "data" / "airports.csv"

FLIGHT_AIRPORT_TYPES = frozenset(
    {"large_airport", "medium_airport", "small_airport"},
)

COUNTRY_NAMES: dict[str, str] = {
    "US": "United States",
    "GB": "United Kingdom",
    "CA": "Canada",
    "AU": "Australia",
    "IN": "India",
    "DE": "Germany",
    "FR": "France",
    "JP": "Japan",
    "CN": "China",
    "BR": "Brazil",
    "MX": "Mexico",
    "AE": "United Arab Emirates",
    "SG": "Singapore",
    "NL": "Netherlands",
    "ES": "Spain",
    "IT": "Italy",
    "KR": "South Korea",
    "TR": "Turkey",
    "QA": "Qatar",
    "HK": "Hong Kong",
    "TH": "Thailand",
}

US_STATE_NAMES: dict[str, str] = {
    "AL": "Alabama",
    "AK": "Alaska",
    "AZ": "Arizona",
    "AR": "Arkansas",
    "CA": "California",
    "CO": "Colorado",
    "CT": "Connecticut",
    "DE": "Delaware",
    "DC": "District of Columbia",
    "FL": "Florida",
    "GA": "Georgia",
    "HI": "Hawaii",
    "ID": "Idaho",
    "IL": "Illinois",
    "IN": "Indiana",
    "IA": "Iowa",
    "KS": "Kansas",
    "KY": "Kentucky",
    "LA": "Louisiana",
    "ME": "Maine",
    "MD": "Maryland",
    "MA": "Massachusetts",
    "MI": "Michigan",
    "MN": "Minnesota",
    "MS": "Mississippi",
    "MO": "Missouri",
    "MT": "Montana",
    "NE": "Nebraska",
    "NV": "Nevada",
    "NH": "New Hampshire",
    "NJ": "New Jersey",
    "NM": "New Mexico",
    "NY": "New York",
    "NC": "North Carolina",
    "ND": "North Dakota",
    "OH": "Ohio",
    "OK": "Oklahoma",
    "OR": "Oregon",
    "PA": "Pennsylvania",
    "RI": "Rhode Island",
    "SC": "South Carolina",
    "SD": "South Dakota",
    "TN": "Tennessee",
    "TX": "Texas",
    "UT": "Utah",
    "VT": "Vermont",
    "VA": "Virginia",
    "WA": "Washington",
    "WV": "West Virginia",
    "WI": "Wisconsin",
    "WY": "Wyoming",
}


@dataclass(frozen=True, slots=True)
class AirportRecord:
    iata: str
    name: str
    municipality: str
    iso_country: str
    iso_region: str
    latitude: float
    longitude: float
    airport_type: str
    scheduled_service: bool


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    return r * c


def _region_label(iso_region: str) -> str:
    code = (iso_region or "").strip()
    if not code:
        return ""
    if "-" in code:
        return code.split("-", 1)[1]
    return code


def _region_short(iso_region: str) -> str:
    return _region_label(iso_region)


def _unique_municipalities(rows: list[AirportRecord], limit: int = 4) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for row in sorted(rows, key=lambda item: (item.airport_type != "large_airport", item.name)):
        city = (row.municipality or "").strip()
        if not city or city in seen:
            continue
        seen.add(city)
        out.append(city)
        if len(out) >= limit:
            break
    return out


def _region_display_name(iso_region: str, country: str, municipalities: list[str]) -> str:
    short = _region_short(iso_region)
    country_code = country.strip().upper()
    if country_code == "US" and short in US_STATE_NAMES:
        return US_STATE_NAMES[short]
    if municipalities:
        return municipalities[0]
    return short


def _region_subtitle(iso_region: str, country: str, municipalities: list[str], airport_count: int) -> str:
    short = _region_short(iso_region)
    country_code = country.strip().upper()
    parts: list[str] = []

    if country_code == "US" and short in US_STATE_NAMES:
        if len(municipalities) > 0:
            parts.append(", ".join(municipalities[:3]))
    elif len(municipalities) > 1:
        parts.append(", ".join(municipalities[1:4]))
    elif short:
        parts.append(f"Region {short}")

    parts.append(f"{airport_count} airport{'s' if airport_count != 1 else ''}")
    return " · ".join(parts)


def _country_label(iso_country: str) -> str:
    code = (iso_country or "").strip().upper()
    return COUNTRY_NAMES.get(code, code)


@lru_cache(maxsize=1)
def _load_records() -> tuple[AirportRecord, ...]:
    if not AIRPORTS_CSV.is_file():
        logger.error("Airport dataset missing at %s", AIRPORTS_CSV)
        return ()

    records: list[AirportRecord] = []
    try:
        with AIRPORTS_CSV.open(encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                iata = str(row.get("iata_code") or "").strip().upper()
                if len(iata) != 3 or not iata.isalpha():
                    continue
                airport_type = str(row.get("type") or "").strip()
                if airport_type not in FLIGHT_AIRPORT_TYPES:
                    continue
                try:
                    lat = float(row.get("latitude_deg") or 0)
                    lon = float(row.get("longitude_deg") or 0)
                except (TypeError, ValueError):
                    continue
                if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                    continue
                records.append(
                    AirportRecord(
                        iata=iata,
                        name=str(row.get("name") or iata).strip(),
                        municipality=str(row.get("municipality") or "").strip(),
                        iso_country=str(row.get("iso_country") or "").strip().upper(),
                        iso_region=str(row.get("iso_region") or "").strip().upper(),
                        latitude=lat,
                        longitude=lon,
                        airport_type=airport_type,
                        scheduled_service=str(row.get("scheduled_service") or "").lower() == "yes",
                    )
                )
    except Exception as exc:
        logger.exception("Failed to load airport dataset: %s", exc)
        return ()

    logger.info("Loaded %s airports with IATA codes from OurAirports", len(records))
    return tuple(records)


class AirportDatasetService:
    @staticmethod
    def is_configured() -> bool:
        return bool(_load_records())

    @staticmethod
    def get_by_iata(iata: str) -> AirportRecord | None:
        code = iata.strip().upper()
        if len(code) != 3:
            return None
        for row in _load_records():
            if row.iata == code:
                return row
        return None

    @staticmethod
    def validate_iata(iata: str) -> bool:
        return AirportDatasetService.get_by_iata(iata) is not None

    @staticmethod
    def search(query: str, *, limit: int = 12) -> list[AirportRecord]:
        q = query.strip().lower()
        if len(q) < 1:
            return []

        records = _load_records()
        if not records:
            return []

        scored: list[tuple[int, AirportRecord]] = []
        for row in records:
            score = 0
            iata_l = row.iata.lower()
            name_l = row.name.lower()
            city_l = row.municipality.lower()
            country_l = _country_label(row.iso_country).lower()
            region_l = _region_label(row.iso_region).lower()

            if iata_l == q:
                score = 100
            elif iata_l.startswith(q):
                score = 85
            elif name_l.startswith(q):
                score = 80
            elif city_l.startswith(q):
                score = 75
            elif q in name_l:
                score = 65
            elif q in city_l:
                score = 60
            elif q in country_l:
                score = 50
            elif q in region_l:
                score = 45
            else:
                tokens = [t for t in q.split() if t]
                if tokens and all(
                    t in name_l or t in city_l or t in country_l or t in region_l or t in iata_l
                    for t in tokens
                ):
                    score = 40

            if score > 0:
                if row.scheduled_service:
                    score += 5
                if row.airport_type == "large_airport":
                    score += 3
                scored.append((score, row))

        scored.sort(key=lambda item: (-item[0], item[1].iata))
        return [row for _, row in scored[:limit]]

    @staticmethod
    def nearby(
        lat: float,
        lng: float,
        *,
        limit: int = 12,
        max_km: float = 250.0,
    ) -> list[tuple[AirportRecord, float]]:
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            return []

        records = _load_records()
        if not records:
            return []

        ranked: list[tuple[AirportRecord, float]] = []
        for row in records:
            dist = _haversine_km(lat, lng, row.latitude, row.longitude)
            if dist <= max_km:
                ranked.append((row, dist))

        ranked.sort(key=lambda item: (item[1], item[0].iata))
        return ranked[:limit]

    @staticmethod
    def list_countries() -> list[dict[str, str]]:
        counts: dict[str, int] = {}
        for row in _load_records():
            if row.iso_country:
                counts[row.iso_country] = counts.get(row.iso_country, 0) + 1

        return [
            {
                "code": code,
                "name": _country_label(code),
                "airport_count": str(count),
            }
            for code, count in sorted(counts.items(), key=lambda item: _country_label(item[0]))
        ]

    @staticmethod
    def region_name_for(iso_region: str, country: str) -> str:
        code = country.strip().upper()
        short = _region_short(iso_region)
        if code == "US" and short in US_STATE_NAMES:
            return US_STATE_NAMES[short]
        return short

    @staticmethod
    def list_regions(country: str) -> list[dict[str, str]]:
        code = country.strip().upper()
        region_rows: dict[str, list[AirportRecord]] = {}
        for row in _load_records():
            if row.iso_country != code:
                continue
            region = row.iso_region or ""
            region_rows.setdefault(region, []).append(row)

        if len(region_rows) <= 1 and "" in region_rows:
            return []

        out: list[dict[str, str]] = []
        for region, airports in sorted(region_rows.items(), key=lambda item: _region_label(item[0])):
            if not region:
                continue
            municipalities = _unique_municipalities(airports)
            count = len(airports)
            display = _region_display_name(region, code, municipalities)
            out.append(
                {
                    "code": region,
                    "name": display,
                    "region_code": _region_short(region),
                    "sample_cities": ", ".join(municipalities),
                    "subtitle": _region_subtitle(region, code, municipalities, count),
                    "country_code": code,
                    "airport_count": str(count),
                }
            )
        return out

    @staticmethod
    def list_cities(country: str, region: str | None = None) -> list[dict[str, str]]:
        code = country.strip().upper()
        region_code = (region or "").strip().upper() or None
        city_counts: dict[str, int] = {}
        region_name = AirportDatasetService.region_name_for(region_code, code) if region_code else ""

        for row in _load_records():
            if row.iso_country != code:
                continue
            if region_code and row.iso_region != region_code:
                continue
            city = row.municipality or row.name
            if not city:
                continue
            city_counts[city] = city_counts.get(city, 0) + 1

        return [
            {
                "name": city,
                "country_code": code,
                "region_code": region_code or "",
                "region_name": region_name,
                "airport_count": str(count),
            }
            for city, count in sorted(city_counts.items(), key=lambda item: item[0].lower())
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
    ) -> list[tuple[AirportRecord, float | None]]:
        code = country.strip().upper()
        region_code = (region or "").strip().upper() or None
        city_name = (city or "").strip() or None

        rows: list[AirportRecord] = []
        for row in _load_records():
            if row.iso_country != code:
                continue
            if region_code and row.iso_region != region_code:
                continue
            if city_name and row.municipality != city_name:
                continue
            rows.append(row)

        ranked: list[tuple[AirportRecord, float | None]] = []
        for row in rows:
            dist: float | None = None
            if lat is not None and lng is not None:
                dist = _haversine_km(lat, lng, row.latitude, row.longitude)
            ranked.append((row, dist))

        if lat is not None and lng is not None:
            ranked.sort(key=lambda item: (item[1] if item[1] is not None else 99999, item[0].name))
        else:
            ranked.sort(key=lambda item: (item[0].airport_type != "large_airport", item[0].name))

        return ranked[:limit]
