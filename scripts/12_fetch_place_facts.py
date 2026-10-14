#!/usr/bin/env python3
"""
Fetch Wikipedia extracts + OSM tags into place_facts (Chicago pilot, F50).

Usage:
  python scripts/12_fetch_place_facts.py --dry-run --metros chicago
  python scripts/12_fetch_place_facts.py --dry-run --metros chicago --pbf data/osm/illinois-latest.osm.pbf
  python scripts/12_fetch_place_facts.py --metros chicago --write   # owner-approved production write only

Default is --dry-run (prints counts + 20 samples, no DB writes).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.services.place_facts_match import (  # noqa: E402
    match_places_to_osm_indexed,
    osm_fact_rows_from_tags,
)
from app.services.place_facts_osm_extract import (  # noqa: E402
    CHICAGO_BBOX,
    iter_osm_pois_from_pbf,
    osm_source_url,
)
from app.services.place_facts_service import PlaceFactsService  # noqa: E402
from app.services.place_facts_wikipedia import (  # noqa: E402
    USER_AGENT,
    wikipedia_fact_from_qid,
)
from config import settings  # noqa: E402

SAMPLE_LIMIT = 20


def _engine_url() -> str:
    url = (settings.database_url or "").strip()
    if not url:
        raise SystemExit("DATABASE_URL is not configured")
    return url


def _load_chicago_places(session: Session, *, wikipedia_only: bool) -> list[dict[str, Any]]:
    q = """
        SELECT id, gers_id, name,
               ST_Y(geog::geometry) AS lat,
               ST_X(geog::geometry) AS lon,
               wikidata_qid, website
        FROM places
        WHERE city_slug = 'chicago'
          AND gers_id IS NOT NULL
    """
    if wikipedia_only:
        q += " AND wikidata_qid IS NOT NULL"
    rows = session.execute(text(q)).mappings().all()
    return [dict(r) for r in rows]


def _match_osm_for_places(places: list[dict[str, Any]], pbf_path: str) -> list[dict[str, Any]]:
    pois = list(iter_osm_pois_from_pbf(pbf_path, CHICAGO_BBOX))
    paired = match_places_to_osm_indexed(places, pois)
    by_key = {str(p.get("gers_id") or p.get("id")): p for p in places}
    matches: list[dict[str, Any]] = []
    for place_key, poi in paired:
        place = by_key.get(place_key)
        if place is None:
            continue
        facts = osm_fact_rows_from_tags(poi.tags, source_url=osm_source_url(poi))
        matches.append({"place": place, "osm": poi, "facts": facts})
    return matches


def _run_wikipedia(
    places: list[dict[str, Any]],
    *,
    dry_run: bool,
    session: Session | None,
    client: httpx.Client,
) -> tuple[int, list[dict[str, Any]]]:
    samples: list[dict[str, Any]] = []
    count = 0
    wiki_places = [p for p in places if p.get("wikidata_qid")]
    for place in wiki_places:
        qid = str(place["wikidata_qid"])
        fact = wikipedia_fact_from_qid(qid, client=client)
        if not fact:
            continue
        count += 1
        if len(samples) < SAMPLE_LIMIT:
            samples.append({"gers_id": place["gers_id"], "name": place["name"], **fact})
        if not dry_run and session is not None:
            PlaceFactsService.upsert_fact(session, place["id"], fact)
    return count, samples


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch place_facts for Chicago pilot")
    parser.add_argument("--metros", default="chicago", help="Comma-separated city slugs (pilot: chicago)")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print counts and samples only (default unless --write)",
    )
    parser.add_argument("--write", action="store_true", help="Persist to DATABASE_URL (owner approval)")
    parser.add_argument(
        "--pbf",
        type=str,
        default="",
        help="Geofabrik regional .osm.pbf (e.g. illinois-latest.osm.pbf)",
    )
    args = parser.parse_args()
    dry_run = not args.write if not args.dry_run else True
    if args.write and args.dry_run:
        raise SystemExit("Use either --dry-run or --write, not both")
    if not args.write:
        dry_run = True

    metros = [m.strip().lower() for m in args.metros.split(",") if m.strip()]
    if metros != ["chicago"]:
        print("Pilot supports chicago only; ignoring other metros", file=sys.stderr)

    engine = create_engine(_engine_url())
    SessionLocal = sessionmaker(bind=engine)

    with SessionLocal() as session:
        places = _load_chicago_places(session, wikipedia_only=False)
        wiki_candidates = [p for p in places if p.get("wikidata_qid")]
        print(f"Chicago places: {len(places)} total, {len(wiki_candidates)} with wikidata_qid")

        with httpx.Client(timeout=30.0, headers={"User-Agent": USER_AGENT}) as client:
            wiki_count, wiki_samples = _run_wikipedia(
                wiki_candidates, dry_run=dry_run, session=None if dry_run else session, client=client
            )

        osm_match_count = 0
        osm_samples: list[dict[str, Any]] = []
        if args.pbf:
            pbf = Path(args.pbf)
            if not pbf.is_file():
                raise SystemExit(f"PBF not found: {pbf}")
            matches = _match_osm_for_places(places, str(pbf))
            osm_match_count = len(matches)
            for m in matches[:SAMPLE_LIMIT]:
                osm_samples.append(
                    {
                        "gers_id": m["place"]["gers_id"],
                        "name": m["place"]["name"],
                        "osm_id": m["osm"].osm_id,
                        "facts": m["facts"],
                    }
                )
            if not dry_run:
                for m in matches:
                    for fact in m["facts"]:
                        PlaceFactsService.upsert_fact(session, m["place"]["id"], fact)
                session.commit()
        else:
            print("OSM: skipped (pass --pbf path/to/illinois-latest.osm.pbf)")

        if not dry_run:
            session.commit()

        print(json.dumps({"wikipedia_facts": wiki_count, "osm_matched_places": osm_match_count}, indent=2))
        print("--- Wikipedia samples (up to 20) ---")
        for s in wiki_samples:
            preview = s.get("value", "")[:120]
            print(f"{s['gers_id']} | {s['name']}: {preview}…")
        print("--- OSM samples (up to 20) ---")
        print(json.dumps(osm_samples, indent=2))
        if dry_run:
            print("Dry run: no rows written.")


if __name__ == "__main__":
    main()
