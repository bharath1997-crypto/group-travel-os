#!/usr/bin/env python3
"""
Wikidata enrichment — depth_tier 0 → 1 for notable venues.

Joins CC0 Wikidata entities onto existing places rows by name + proximity.
Does not insert new rows.

Usage:
    python scripts/05_enrich_wikidata.py --dry-run --metros chicago
    python scripts/05_enrich_wikidata.py --metros chicago
    python scripts/05_enrich_wikidata.py
"""
from __future__ import annotations

import argparse
import csv
import importlib.util
import io
import json
import math
import re
import sys
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import requests
from rapidfuzz.fuzz import token_sort_ratio

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ENRICH_DIR = ROOT / "data" / "enrich"
SPARQL_ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = "Rovvy/0.1 (https://rovvy.app; contact@rovvy.app)"

DEFAULT_METROS = (
    "new-york",
    "los-angeles",
    "chicago",
    "miami",
    "san-francisco",
    "austin",
    "new-orleans",
    "nashville",
    "seattle",
    "portland",
)

MATCH_DISTANCE_M = 150.0
NAME_THRESHOLD = 85.0
SPARQL_RADIUS_KM = 50.0
TILED_METRO_RADIUS_KM = 25.0
TILED_METRO_OFFSET_KM = 20.0
TILED_METRO_SLUGS = frozenset({"new-york", "los-angeles"})
REQUEST_SLEEP_S = 1.0
MAX_RETRIES = 5
PLACE_CELL_DEG = 0.0015  # ~167 m grid for proximity lookup

_NAME_SUFFIXES = ("restaurant", "bar", "cafe", "grill", "kitchen", "lounge")
_POINT_RE = re.compile(
    r"Point\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)",
    re.IGNORECASE,
)
_QID_RE = re.compile(r"(Q\d+)$")

SPARQL_TYPES = """
    wd:Q11707
    wd:Q187456
    wd:Q30022
    wd:Q33506
    wd:Q1007870
    wd:Q24354
    wd:Q41253
    wd:Q1329623
    wd:Q131734
    wd:Q857909
    wd:Q22698
    wd:Q167346
    wd:Q43501
    wd:Q2140699
    wd:Q18674739
"""


@dataclass(frozen=True)
class WikidataEntity:
    qid: str
    name: str
    lon: float
    lat: float
    instagram: str | None
    website: str | None
    description: str | None


@dataclass(frozen=True)
class PlaceRow:
    gers_id: str
    name: str
    lon: float
    lat: float
    instagram: str | None
    website: str | None
    wikidata_qid: str | None
    depth_tier: int


@dataclass(frozen=True)
class ConfirmedMatch:
    entity: WikidataEntity
    place: PlaceRow
    distance_m: float
    score: float


@dataclass
class MatchStats:
    entities: int = 0
    matched: int = 0
    rejected: int = 0
    ambiguous: int = 0
    skipped_existing: int = 0
    skipped_tier2: int = 0
    qid_collision: int = 0
    log_rows: list[dict[str, Any]] = field(default_factory=list)


def _load_db_module():
    spec = importlib.util.spec_from_file_location(
        "places_spine_db",
        ROOT / "scripts" / "places_spine_db.py",
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load places_spine_db.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _load_metros_module():
    spec = importlib.util.spec_from_file_location(
        "us_metro_centroids",
        ROOT / "scripts" / "us_metro_centroids.py",
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load us_metro_centroids.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def metro_centroid(slug: str) -> tuple[float, float]:
    metros = {m.slug: (m.lon, m.lat) for m in _load_metros_module().US_METRO_CENTROIDS}
    if slug not in metros:
        raise SystemExit(f"Unknown metro slug: {slug}")
    return metros[slug]


def normalize_name(name: str) -> str:
    s = name.casefold()
    s = re.sub(r"[^\w\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    if s.startswith("the "):
        s = s[4:].strip()
    for suffix in _NAME_SUFFIXES:
        token = f" {suffix}"
        if s.endswith(token):
            s = s[: -len(token)].strip()
    return s


def name_score(a: str, b: str) -> float:
    na = normalize_name(a)
    nb = normalize_name(b)
    if not na or not nb:
        return 0.0
    return float(token_sort_ratio(na, nb))


def haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def parse_qid(item_uri: str) -> str:
    match = _QID_RE.search(item_uri)
    if not match:
        raise ValueError(f"Could not parse QID from {item_uri!r}")
    return match.group(1)


def parse_point(wkt: str) -> tuple[float, float]:
    match = _POINT_RE.search(wkt)
    if not match:
        raise ValueError(f"Could not parse Point from {wkt!r}")
    return float(match.group(1)), float(match.group(2))


def build_sparql(lon: float, lat: float, radius_km: float) -> str:
    return f"""
SELECT ?item ?itemLabel ?coord ?instagram ?website ?desc WHERE {{
  SERVICE wikibase:around {{
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point({lon} {lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "{radius_km}" .
  }}
  VALUES ?type {{
    {SPARQL_TYPES}
  }}
  ?item wdt:P31/wdt:P279* ?type .
  OPTIONAL {{ ?item wdt:P2003 ?instagram . }}
  OPTIONAL {{ ?item wdt:P856 ?website . }}
  OPTIONAL {{
    ?item schema:description ?desc .
    FILTER(LANG(?desc) = "en")
  }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en" . }}
}}
""".strip()


def fetch_sparql_csv(query: str) -> str:
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/csv",
    }
    last_exc: Exception | None = None
    for attempt in range(MAX_RETRIES):
        if attempt:
            time.sleep(2**attempt)
        try:
            resp = requests.post(
                SPARQL_ENDPOINT,
                data={"query": query},
                headers=headers,
                timeout=600,
            )
            if resp.status_code in (429, 502, 503, 504):
                last_exc = RuntimeError(f"HTTP {resp.status_code}: {resp.text[:200]}")
                continue
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as exc:
            last_exc = exc
    raise RuntimeError(f"SPARQL request failed after {MAX_RETRIES} tries: {last_exc}")


def _tile_centers(lon: float, lat: float, offset_km: float) -> list[tuple[float, float]]:
    meters = offset_km * 1000.0
    dlat = meters / 111_320.0
    dlon = meters / (111_320.0 * max(math.cos(math.radians(lat)), 0.2))
    return [
        (lon, lat),
        (lon, lat + dlat),
        (lon, lat - dlat),
        (lon + dlon, lat),
        (lon - dlon, lat),
    ]


def _fetch_tiled_entities(
    slug: str,
    lon: float,
    lat: float,
    *,
    enrich_dir: Path,
    force_fetch: bool,
) -> list[WikidataEntity]:
    tile_dir = enrich_dir / f"wikidata_{slug}_tiles"
    tile_dir.mkdir(parents=True, exist_ok=True)
    merged: dict[str, WikidataEntity] = {}

    for idx, (clon, clat) in enumerate(
        _tile_centers(lon, lat, TILED_METRO_OFFSET_KM)
    ):
        tile_path = tile_dir / f"tile_{idx}.csv"
        if tile_path.exists() and not force_fetch:
            print(f"tile_cache_hit slug={slug} tile={idx} path={tile_path}")
            csv_text = tile_path.read_text(encoding="utf-8")
        else:
            query = build_sparql(clon, clat, TILED_METRO_RADIUS_KM)
            print(
                f"sparql_tile slug={slug} tile={idx} "
                f"center=({clon:.4f},{clat:.4f}) radius_km={TILED_METRO_RADIUS_KM}"
            )
            try:
                csv_text = fetch_sparql_csv(query)
            except RuntimeError as exc:
                print(f"tile_fetch_failed slug={slug} tile={idx} error={exc}")
                continue
            tile_path.write_text(csv_text, encoding="utf-8")
            print(f"tile_cache_write slug={slug} tile={idx} path={tile_path}")
            time.sleep(REQUEST_SLEEP_S)

        for entity in parse_sparql_csv(csv_text):
            existing = merged.get(entity.qid)
            if existing is None:
                merged[entity.qid] = entity
            else:
                merged[entity.qid] = WikidataEntity(
                    qid=entity.qid,
                    name=existing.name or entity.name,
                    lon=existing.lon,
                    lat=existing.lat,
                    instagram=existing.instagram or entity.instagram,
                    website=existing.website or entity.website,
                    description=existing.description or entity.description,
                )

    combined_path = enrich_dir / f"wikidata_{slug}.csv"
    if merged:
        rows = [
            {
                "item": f"http://www.wikidata.org/entity/{e.qid}",
                "itemLabel": e.name,
                "coord": f"Point({e.lon} {e.lat})",
                "instagram": e.instagram or "",
                "website": e.website or "",
                "desc": e.description or "",
            }
            for e in merged.values()
        ]
        with combined_path.open("w", encoding="utf-8", newline="") as fh:
            writer = csv.DictWriter(
                fh,
                fieldnames=("item", "itemLabel", "coord", "instagram", "website", "desc"),
            )
            writer.writeheader()
            writer.writerows(rows)
        print(f"cache_write slug={slug} path={combined_path} entities={len(merged):,}")

    return list(merged.values())


def _merge_entity(
    merged: dict[str, WikidataEntity],
    *,
    qid: str,
    name: str,
    coord: str,
    instagram: str | None,
    website: str | None,
    description: str | None,
) -> None:
    if not name or not coord:
        return
    elon, elat = parse_point(coord)
    ig = instagram or None
    site = website or None
    desc = description or None
    existing = merged.get(qid)
    if existing is None:
        merged[qid] = WikidataEntity(
            qid=qid,
            name=name,
            lon=elon,
            lat=elat,
            instagram=ig,
            website=site,
            description=desc,
        )
    else:
        merged[qid] = WikidataEntity(
            qid=qid,
            name=existing.name or name,
            lon=existing.lon,
            lat=existing.lat,
            instagram=existing.instagram or ig,
            website=existing.website or site,
            description=existing.description or desc,
        )


def parse_sparql_csv(csv_text: str) -> list[WikidataEntity]:
    merged: dict[str, WikidataEntity] = {}
    reader = csv.DictReader(io.StringIO(csv_text))
    for row in reader:
        try:
            item = (row.get("item") or "").strip()
            if not item:
                continue
            _merge_entity(
                merged,
                qid=parse_qid(item),
                name=(row.get("itemLabel") or "").strip(),
                coord=(row.get("coord") or "").strip(),
                instagram=(row.get("instagram") or "").strip() or None,
                website=(row.get("website") or "").strip() or None,
                description=(row.get("desc") or "").strip() or None,
            )
        except (KeyError, ValueError):
            continue
    return list(merged.values())


def parse_sparql_json(payload: dict[str, Any]) -> list[WikidataEntity]:
    merged: dict[str, WikidataEntity] = {}
    for binding in payload.get("results", {}).get("bindings", []):
        try:
            _merge_entity(
                merged,
                qid=parse_qid(binding["item"]["value"]),
                name=binding.get("itemLabel", {}).get("value", "").strip(),
                coord=binding.get("coord", {}).get("value", ""),
                instagram=(binding.get("instagram") or {}).get("value"),
                website=(binding.get("website") or {}).get("value"),
                description=(binding.get("desc") or {}).get("value"),
            )
        except (KeyError, ValueError):
            continue
    return list(merged.values())


def load_or_fetch_wikidata(
    slug: str,
    lon: float,
    lat: float,
    *,
    enrich_dir: Path,
    radius_km: float,
    force_fetch: bool,
) -> list[WikidataEntity]:
    enrich_dir.mkdir(parents=True, exist_ok=True)
    csv_cache = enrich_dir / f"wikidata_{slug}.csv"
    json_cache = enrich_dir / f"wikidata_{slug}.json"

    if csv_cache.exists() and not force_fetch:
        print(f"cache_hit slug={slug} path={csv_cache}")
        return parse_sparql_csv(csv_cache.read_text(encoding="utf-8"))

    if json_cache.exists() and not force_fetch:
        print(f"cache_hit slug={slug} path={json_cache}")
        payload = json.loads(json_cache.read_text(encoding="utf-8"), strict=False)
        return parse_sparql_json(payload)

    if slug in TILED_METRO_SLUGS:
        return _fetch_tiled_entities(
            slug, lon, lat, enrich_dir=enrich_dir, force_fetch=force_fetch
        )

    query = build_sparql(lon, lat, radius_km)
    print(f"sparql_fetch slug={slug} radius_km={radius_km}")
    csv_text = fetch_sparql_csv(query)
    csv_cache.write_text(csv_text, encoding="utf-8")
    print(f"cache_write slug={slug} path={csv_cache}")
    time.sleep(REQUEST_SLEEP_S)
    return parse_sparql_csv(csv_text)


def load_places(conn, city_slug: str) -> list[PlaceRow]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT gers_id, name,
                   ST_X(geog::geometry) AS lon,
                   ST_Y(geog::geometry) AS lat,
                   instagram, website, wikidata_qid, depth_tier
            FROM places
            WHERE city_slug = %s
            """,
            (city_slug,),
        )
        rows = cur.fetchall()
    return [
        PlaceRow(
            gers_id=str(r[0]),
            name=str(r[1]),
            lon=float(r[2]),
            lat=float(r[3]),
            instagram=r[4],
            website=r[5],
            wikidata_qid=r[6],
            depth_tier=int(r[7] or 0),
        )
        for r in rows
    ]


def existing_qids(conn) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT wikidata_qid FROM places WHERE wikidata_qid IS NOT NULL"
        )
        return {str(row[0]) for row in cur.fetchall()}


def ensure_enrichment_schema(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            ALTER TABLE places
              ADD COLUMN IF NOT EXISTS wikidata_qid text,
              ADD COLUMN IF NOT EXISTS short_description text
            """
        )
        cur.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS places_wikidata_qid_idx
              ON places (wikidata_qid)
              WHERE wikidata_qid IS NOT NULL
            """
        )
    conn.commit()
    print("schema=wikidata_columns_ok")


def _place_cell(lat: float, lon: float) -> tuple[int, int]:
    return (round(lat / PLACE_CELL_DEG), round(lon / PLACE_CELL_DEG))


def _build_place_index(
    places: list[PlaceRow],
) -> dict[tuple[int, int], list[PlaceRow]]:
    index: dict[tuple[int, int], list[PlaceRow]] = defaultdict(list)
    for place in places:
        if place.depth_tier >= 2:
            continue
        index[_place_cell(place.lat, place.lon)].append(place)
    return index


def _nearby_places(
    index: dict[tuple[int, int], list[PlaceRow]],
    lat: float,
    lon: float,
) -> list[PlaceRow]:
    cx, cy = _place_cell(lat, lon)
    out: list[PlaceRow] = []
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            out.extend(index.get((cx + dx, cy + dy), []))
    return out


def match_entities(
    entities: list[WikidataEntity],
    places: list[PlaceRow],
    *,
    used_qids: set[str],
) -> tuple[list[ConfirmedMatch], MatchStats]:
    stats = MatchStats(entities=len(entities))
    confirmed: list[ConfirmedMatch] = []
    place_index = _build_place_index(places)

    for entity in entities:
        if entity.qid in used_qids:
            stats.skipped_existing += 1
            continue

        candidates: list[tuple[PlaceRow, float, float]] = []
        near_rejects: list[tuple[PlaceRow, float, float]] = []

        for place in _nearby_places(place_index, entity.lat, entity.lon):
            if place.wikidata_qid and place.wikidata_qid != entity.qid:
                continue
            dist_m = haversine_m(entity.lon, entity.lat, place.lon, place.lat)
            if dist_m > MATCH_DISTANCE_M:
                continue
            score = name_score(entity.name, place.name)
            if score >= NAME_THRESHOLD:
                candidates.append((place, dist_m, score))
            else:
                near_rejects.append((place, dist_m, score))

        if len(candidates) == 1:
            place, dist_m, score = candidates[0]
            if place.wikidata_qid == entity.qid:
                stats.skipped_existing += 1
                continue
            confirmed.append(
                ConfirmedMatch(
                    entity=entity,
                    place=place,
                    distance_m=dist_m,
                    score=score,
                )
            )
            used_qids.add(entity.qid)
            stats.matched += 1
            continue

        if len(candidates) > 1:
            stats.ambiguous += 1
            for place, dist_m, score in candidates:
                stats.log_rows.append(
                    {
                        "reason": "ambiguous",
                        "wikidata_qid": entity.qid,
                        "wikidata_name": entity.name,
                        "overture_gers_id": place.gers_id,
                        "overture_name": place.name,
                        "distance_m": round(dist_m, 1),
                        "score": round(score, 1),
                    }
                )
            continue

        if near_rejects:
            stats.rejected += 1
            place, dist_m, score = max(near_rejects, key=lambda row: row[2])
            stats.log_rows.append(
                {
                    "reason": "rejected",
                    "wikidata_qid": entity.qid,
                    "wikidata_name": entity.name,
                    "overture_gers_id": place.gers_id,
                    "overture_name": place.name,
                    "distance_m": round(dist_m, 1),
                    "score": round(score, 1),
                }
            )

    return confirmed, stats


def write_unmatched_log(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = (
        "reason",
        "wikidata_qid",
        "wikidata_name",
        "overture_gers_id",
        "overture_name",
        "distance_m",
        "score",
    )
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def apply_matches(conn, matches: list[ConfirmedMatch], *, dry_run: bool) -> int:
    if dry_run:
        return 0
    updated = 0
    now = datetime.now(UTC)
    with conn.cursor() as cur:
        for match in matches:
            entity = match.entity
            cur.execute(
                """
                UPDATE places SET
                  wikidata_qid = %s,
                  enriched_at = COALESCE(enriched_at, %s),
                  instagram = CASE
                    WHEN instagram IS NULL AND %s IS NOT NULL THEN %s
                    ELSE instagram
                  END,
                  website = CASE
                    WHEN website IS NULL AND %s IS NOT NULL THEN %s
                    ELSE website
                  END,
                  short_description = CASE
                    WHEN short_description IS NULL AND %s IS NOT NULL THEN %s
                    ELSE short_description
                  END,
                  depth_tier = GREATEST(depth_tier, 1)
                WHERE gers_id = %s
                  AND depth_tier < 2
                  AND (wikidata_qid IS NULL OR wikidata_qid = %s)
                """,
                (
                    entity.qid,
                    now,
                    entity.instagram,
                    entity.instagram,
                    entity.website,
                    entity.website,
                    entity.description,
                    entity.description,
                    match.place.gers_id,
                    entity.qid,
                ),
            )
            updated += cur.rowcount
    conn.commit()
    return updated


def print_report(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT city_slug,
                   count(*) FILTER (WHERE depth_tier >= 1)       AS enriched,
                   count(*) FILTER (WHERE instagram IS NOT NULL) AS with_ig,
                   count(*) FILTER (WHERE website IS NOT NULL)   AS with_site,
                   count(*)                                       AS total
            FROM places
            WHERE city_slug IS NOT NULL
            GROUP BY 1
            ORDER BY 2 DESC
            LIMIT 20
            """
        )
        print()
        print("enrichment_report")
        print(f"{'city_slug':<18} {'enriched':>9} {'with_ig':>9} {'with_site':>10} {'total':>9}")
        print("-" * 58)
        for city_slug, enriched, with_ig, with_site, total in cur.fetchall():
            print(
                f"{city_slug:<18} {enriched:>9,} {with_ig:>9,} "
                f"{with_site:>10,} {total:>9,}"
            )


def enrich_metro(
    conn,
    slug: str,
    *,
    enrich_dir: Path,
    radius_km: float,
    dry_run: bool,
    force_fetch: bool,
    used_qids: set[str],
) -> MatchStats:
    lon, lat = metro_centroid(slug)
    entities = load_or_fetch_wikidata(
        slug,
        lon,
        lat,
        enrich_dir=enrich_dir,
        radius_km=radius_km,
        force_fetch=force_fetch,
    )
    places = load_places(conn, slug)
    matches, stats = match_entities(entities, places, used_qids=used_qids)
    log_path = enrich_dir / f"unmatched_{slug}.csv"
    write_unmatched_log(log_path, stats.log_rows)

    print(
        f"metro={slug} entities={stats.entities:,} places={len(places):,} "
        f"matched={stats.matched:,} rejected={stats.rejected:,} "
        f"ambiguous={stats.ambiguous:,} skipped_existing={stats.skipped_existing:,}"
    )
    print(f"unmatched_log={log_path}")

    if not dry_run and matches:
        written = apply_matches(conn, matches, dry_run=False)
        print(f"rows_updated={written:,}")
    elif dry_run:
        print("dry_run=1 no_writes")

    return stats


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(line_buffering=True)
    parser = argparse.ArgumentParser(description="Enrich places from Wikidata.")
    parser.add_argument(
        "--metros",
        nargs="+",
        default=list(DEFAULT_METROS),
        help="Metro slugs to enrich (default: first 10 launch metros)",
    )
    parser.add_argument(
        "--enrich-dir",
        type=Path,
        default=DEFAULT_ENRICH_DIR,
    )
    parser.add_argument(
        "--radius-km",
        type=float,
        default=SPARQL_RADIUS_KM,
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Match and report only; do not write to Postgres",
    )
    parser.add_argument(
        "--force-fetch",
        action="store_true",
        help="Ignore cached wikidata_<slug>.json and re-query SPARQL",
    )
    args = parser.parse_args()

    db = _load_db_module()
    conn = db.connect()
    with conn.cursor() as cur:
        cur.execute("SET statement_timeout = 0")
    conn.commit()
    try:
        ensure_enrichment_schema(conn)

        used_qids = existing_qids(conn)
        totals = MatchStats()
        for slug in args.metros:
            stats = enrich_metro(
                conn,
                slug,
                enrich_dir=args.enrich_dir,
                radius_km=args.radius_km,
                dry_run=args.dry_run,
                force_fetch=args.force_fetch,
                used_qids=used_qids,
            )
            totals.entities += stats.entities
            totals.matched += stats.matched
            totals.rejected += stats.rejected
            totals.ambiguous += stats.ambiguous
            totals.skipped_existing += stats.skipped_existing

        print()
        print(
            f"TOTAL entities={totals.entities:,} matched={totals.matched:,} "
            f"rejected={totals.rejected:,} ambiguous={totals.ambiguous:,} "
            f"skipped_existing={totals.skipped_existing:,}"
        )
        if not args.dry_run:
            print_report(conn)
        print("enrich_wikidata=ok")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
