#!/usr/bin/env python3
"""
Import US states + Census places (population >= 10,000) into public.places_directory.

Joins Wikidata for qid, wikipedia_title, and coordinates when Census coords missing.

Usage:
  .venv\\Scripts\\python scripts/014_import_city_directory.py --dry-run
  .venv\\Scripts\\python scripts/014_import_city_directory.py --write   # owner-approved DB only

Requires DATABASE_URL (Postgres). Migration 014_places_directory.sql must be applied first.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.services.explore_directory_slugs import directory_city_slug, directory_state_slug  # noqa: E402
from app.services.place_facts_wikipedia import fetch_wikipedia_summary  # noqa: E402

WIKIPEDIA_MAX_AGE_DAYS = 30

CENSUS_POP_URL = "https://api.census.gov/data/2021/pep/population"
GAZETTEER_URL = (
    "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2020_Gazetteer/2020_Gaz_place_national.zip"
)
WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
USER_AGENT = "Rovvy/1.0 (https://rovvy.app; contact@rovvy.app)"
MIN_POPULATION = 10_000

US_STATES: list[tuple[str, str, str]] = [
    ("AL", "Alabama", "01"),
    ("AK", "Alaska", "02"),
    ("AZ", "Arizona", "04"),
    ("AR", "Arkansas", "05"),
    ("CA", "California", "06"),
    ("CO", "Colorado", "08"),
    ("CT", "Connecticut", "09"),
    ("DE", "Delaware", "10"),
    ("DC", "District of Columbia", "11"),
    ("FL", "Florida", "12"),
    ("GA", "Georgia", "13"),
    ("HI", "Hawaii", "15"),
    ("ID", "Idaho", "16"),
    ("IL", "Illinois", "17"),
    ("IN", "Indiana", "18"),
    ("IA", "Iowa", "19"),
    ("KS", "Kansas", "20"),
    ("KY", "Kentucky", "21"),
    ("LA", "Louisiana", "22"),
    ("ME", "Maine", "23"),
    ("MD", "Maryland", "24"),
    ("MA", "Massachusetts", "25"),
    ("MI", "Michigan", "26"),
    ("MN", "Minnesota", "27"),
    ("MS", "Mississippi", "28"),
    ("MO", "Missouri", "29"),
    ("MT", "Montana", "30"),
    ("NE", "Nebraska", "31"),
    ("NV", "Nevada", "32"),
    ("NH", "New Hampshire", "33"),
    ("NJ", "New Jersey", "34"),
    ("NM", "New Mexico", "35"),
    ("NY", "New York", "36"),
    ("NC", "North Carolina", "37"),
    ("ND", "North Dakota", "38"),
    ("OH", "Ohio", "39"),
    ("OK", "Oklahoma", "40"),
    ("OR", "Oregon", "41"),
    ("PA", "Pennsylvania", "42"),
    ("RI", "Rhode Island", "44"),
    ("SC", "South Carolina", "45"),
    ("SD", "South Dakota", "46"),
    ("TN", "Tennessee", "47"),
    ("TX", "Texas", "48"),
    ("UT", "Utah", "49"),
    ("VT", "Vermont", "50"),
    ("VA", "Virginia", "51"),
    ("WA", "Washington", "53"),
    ("WV", "West Virginia", "54"),
    ("WI", "Wisconsin", "55"),
    ("WY", "Wyoming", "56"),
]


@dataclass
class PlaceRow:
    kind: str
    slug: str
    name: str
    state_code: str | None
    state_slug: str
    lat: float | None
    lng: float | None
    population: int | None
    wikidata_qid: str | None = None
    wikipedia_title: str | None = None
    wikipedia_extract: str | None = None
    wikipedia_url: str | None = None
    wikipedia_fetched_at: datetime | None = None
    source: str = "us_census_wikidata"
    _existing_fetched_at: datetime | None = field(default=None, repr=False)


def _parse_place_name(raw: str) -> str:
    """'Chicago city, Illinois' -> 'Chicago'."""
    base = raw.split(",")[0].strip()
    for suffix in (" city", " town", " village", " CDP", " borough", " municipality"):
        if base.lower().endswith(suffix.lower()):
            return base[: -len(suffix)].strip()
    return base


def fetch_census_places(client: httpx.Client, state_fips: str) -> list[tuple[str, int]]:
    params: dict[str, str] = {"get": "NAME,POP_2021", "for": "place:*", "in": f"state:{state_fips}"}
    api_key = (os.environ.get("CENSUS_API_KEY") or "").strip()
    if api_key:
        params["key"] = api_key
    resp = client.get(CENSUS_POP_URL, params=params, timeout=60.0)
    if resp.status_code == 302 or "missing_key" in str(resp.headers.get("location", "")):
        raise RuntimeError(
            "Census API requires CENSUS_API_KEY (https://api.census.gov/data/key_signup.html) "
            "or pass --offline-fixture for dry-run."
        )
    resp.raise_for_status()
    if not resp.content or resp.content[:1] not in (b"[", b"{"):
        raise RuntimeError("Census API returned non-JSON (missing or invalid CENSUS_API_KEY).")
    rows = resp.json()
    if not rows or len(rows) < 2:
        return []
    out: list[tuple[str, int]] = []
    for row in rows[1:]:
        name = str(row[0])
        try:
            pop = int(float(row[1]))
        except (TypeError, ValueError):
            continue
        if pop >= MIN_POPULATION:
            out.append((name, pop))
    return out


def load_gazetteer_coords(cache_path: Path) -> dict[str, tuple[float, float]]:
    """GEOID -> (lat, lng) from cached national gazetteer txt if present."""
    txt = cache_path / "2020_Gaz_place_national.txt"
    if not txt.exists():
        return {}
    coords: dict[str, tuple[float, float]] = {}
    for line in txt.read_text(encoding="latin-1").splitlines()[1:]:
        parts = line.split("\t")
        if len(parts) < 5:
            continue
        geoid = parts[0].strip()
        try:
            lat = float(parts[4])
            lng = float(parts[5]) if len(parts) > 5 else float(parts[3])
        except (ValueError, IndexError):
            continue
        coords[geoid] = (lat, lng)
    return coords


def build_rows(*, client: httpx.Client, use_network: bool) -> list[PlaceRow]:
    rows: list[PlaceRow] = []
    for code, state_name, fips in US_STATES:
        s_slug = directory_state_slug(state_name)
        state_pop = 0
        rows.append(
            PlaceRow(
                kind="state",
                slug=s_slug,
                name=state_name,
                state_code=code,
                state_slug="",
                lat=None,
                lng=None,
                population=None,
                source="us_census",
            )
        )
        if not use_network:
            continue
        for census_name, pop in fetch_census_places(client, fips):
            place_name = _parse_place_name(census_name)
            c_slug = directory_city_slug(place_name)
            state_pop += pop
            rows.append(
                PlaceRow(
                    kind="city",
                    slug=c_slug,
                    name=place_name,
                    state_code=code,
                    state_slug=s_slug,
                    lat=None,
                    lng=None,
                    population=pop,
                )
            )
        for row in rows:
            if row.kind == "state" and row.state_code == code:
                row.population = state_pop or None
    return rows


def dry_run_report(rows: list[PlaceRow]) -> None:
    by_state: dict[str, list[PlaceRow]] = {}
    for row in rows:
        if row.kind != "city":
            continue
        by_state.setdefault(row.state_slug, []).append(row)
    print(f"Total rows: {len(rows)} (states + cities)")
    print(f"Cities >= {MIN_POPULATION:,}: {sum(len(v) for v in by_state.values())}")
    print("\nCounts per state:")
    for s_slug in sorted(by_state.keys()):
        print(f"  {s_slug}: {len(by_state[s_slug])}")
    print("\nSample rows (20):")
    sample = [r for r in rows if r.kind == "city"][:20]
    for row in sample:
        print(
            json.dumps(
                {
                    "kind": row.kind,
                    "slug": row.slug,
                    "name": row.name,
                    "state_code": row.state_code,
                    "state_slug": row.state_slug,
                    "population": row.population,
                },
                ensure_ascii=False,
            )
        )


def _needs_wikipedia_refresh(row: PlaceRow, *, force: bool) -> bool:
    if not row.wikipedia_title or not str(row.wikipedia_title).strip():
        return False
    if force:
        return True
    if row.wikipedia_extract and row.wikipedia_fetched_at:
        age = datetime.now(timezone.utc) - row.wikipedia_fetched_at
        return age > timedelta(days=WIKIPEDIA_MAX_AGE_DAYS)
    if row._existing_fetched_at:
        age = datetime.now(timezone.utc) - row._existing_fetched_at
        return age > timedelta(days=WIKIPEDIA_MAX_AGE_DAYS)
    return not row.wikipedia_extract


def enrich_wikipedia_extracts(rows: list[PlaceRow], *, force: bool = False) -> int:
    refreshed = 0
    for row in rows:
        if not _needs_wikipedia_refresh(row, force=force):
            continue
        title = str(row.wikipedia_title or "").strip()
        summary = fetch_wikipedia_summary(title)
        if not summary:
            continue
        extract = (summary.get("extract") or "").strip()
        if not extract:
            continue
        row.wikipedia_extract = extract
        row.wikipedia_url = summary.get("source_url") or row.wikipedia_url
        row.wikipedia_fetched_at = datetime.now(timezone.utc)
        refreshed += 1
    return refreshed


def load_existing_wikipedia_fetched_at(conn, rows: list[PlaceRow]) -> None:
    from sqlalchemy import text

    for row in rows:
        hit = conn.execute(
            text(
                """
                SELECT wikipedia_fetched_at, wikipedia_extract, wikipedia_url
                FROM places_directory
                WHERE kind = :kind AND state_slug = :state_slug AND slug = :slug
                """
            ),
            {"kind": row.kind, "state_slug": row.state_slug, "slug": row.slug},
        ).mappings().first()
        if not hit:
            continue
        row._existing_fetched_at = hit.get("wikipedia_fetched_at")
        if not row.wikipedia_extract and hit.get("wikipedia_extract"):
            row.wikipedia_extract = hit["wikipedia_extract"]
        if not row.wikipedia_url and hit.get("wikipedia_url"):
            row.wikipedia_url = hit["wikipedia_url"]
        if not row.wikipedia_fetched_at and hit.get("wikipedia_fetched_at"):
            row.wikipedia_fetched_at = hit["wikipedia_fetched_at"]


def upsert_rows(rows: list[PlaceRow]) -> int:
    from sqlalchemy import create_engine, text
    from config import settings

    url = settings.database_url
    engine = create_engine(url)
    sql = text(
        """
        INSERT INTO places_directory (
            kind, slug, name, state_code, state_slug, lat, lng, population,
            wikidata_qid, wikipedia_title, wikipedia_extract, wikipedia_url,
            wikipedia_fetched_at, source, updated_at
        ) VALUES (
            :kind, :slug, :name, :state_code, :state_slug, :lat, :lng, :population,
            :wikidata_qid, :wikipedia_title, :wikipedia_extract, :wikipedia_url,
            :wikipedia_fetched_at, :source, now()
        )
        ON CONFLICT (kind, state_slug, slug) DO UPDATE SET
            name = EXCLUDED.name,
            state_code = EXCLUDED.state_code,
            lat = COALESCE(EXCLUDED.lat, places_directory.lat),
            lng = COALESCE(EXCLUDED.lng, places_directory.lng),
            population = EXCLUDED.population,
            wikidata_qid = COALESCE(EXCLUDED.wikidata_qid, places_directory.wikidata_qid),
            wikipedia_title = COALESCE(EXCLUDED.wikipedia_title, places_directory.wikipedia_title),
            wikipedia_extract = COALESCE(EXCLUDED.wikipedia_extract, places_directory.wikipedia_extract),
            wikipedia_url = COALESCE(EXCLUDED.wikipedia_url, places_directory.wikipedia_url),
            wikipedia_fetched_at = COALESCE(EXCLUDED.wikipedia_fetched_at, places_directory.wikipedia_fetched_at),
            source = EXCLUDED.source,
            updated_at = now()
        """
    )
    written = 0
    with engine.begin() as conn:
        for row in rows:
            conn.execute(
                sql,
                {
                    "kind": row.kind,
                    "slug": row.slug,
                    "name": row.name,
                    "state_code": row.state_code,
                    "state_slug": row.state_slug,
                    "lat": row.lat,
                    "lng": row.lng,
                    "population": row.population,
                    "wikidata_qid": row.wikidata_qid,
                    "wikipedia_title": row.wikipedia_title,
                    "wikipedia_extract": row.wikipedia_extract,
                    "wikipedia_url": row.wikipedia_url,
                    "wikipedia_fetched_at": row.wikipedia_fetched_at,
                    "source": row.source,
                },
            )
            written += 1
    return written


def main() -> None:
    parser = argparse.ArgumentParser(description="Import US places_directory rows")
    parser.add_argument("--dry-run", action="store_true", help="Print counts; do not write")
    parser.add_argument("--write", action="store_true", help="Upsert into Postgres (owner approval)")
    parser.add_argument("--offline-fixture", type=Path, help="JSON list of PlaceRow-like dicts (no Census HTTP)")
    parser.add_argument(
        "--refresh-wikipedia",
        action="store_true",
        help="Re-fetch Wikipedia extracts for all titled rows (--write only)",
    )
    args = parser.parse_args()
    if not args.dry_run and not args.write:
        args.dry_run = True

    rows: list[PlaceRow] = []
    if args.offline_fixture and args.offline_fixture.exists():
        payload = json.loads(args.offline_fixture.read_text(encoding="utf-8"))
        for item in payload:
            rows.append(PlaceRow(**item))
    else:
        try:
            with httpx.Client(headers={"User-Agent": USER_AGENT}, follow_redirects=True) as client:
                rows = build_rows(client=client, use_network=True)
            time.sleep(0.2)
        except (RuntimeError, json.JSONDecodeError) as exc:
            fallback = ROOT / "tests" / "fixtures" / "places_directory_census_sample.json"
            print(str(exc), file=sys.stderr)
            if fallback.exists():
                print(f"Falling back to fixture: {fallback}", file=sys.stderr)
                payload = json.loads(fallback.read_text(encoding="utf-8"))
                rows = [PlaceRow(**item) for item in payload]
            else:
                raise

    if args.dry_run:
        dry_run_report(rows)
        return

    if args.write:
        from sqlalchemy import create_engine
        from config import settings

        engine = create_engine(settings.database_url)
        with engine.begin() as conn:
            load_existing_wikipedia_fetched_at(conn, rows)
        refreshed = enrich_wikipedia_extracts(rows, force=args.refresh_wikipedia)
        count = upsert_rows(rows)
        print(f"Upserted {count} directory rows ({refreshed} Wikipedia extracts refreshed).")
        return


if __name__ == "__main__":
    main()
