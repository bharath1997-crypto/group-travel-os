#!/usr/bin/env python3
"""
Step 6 — monthly Overture re-sync for existing places rows.

Updates only name, geog, and confidence from a new release file joined on
gers_id. Every hand-enriched column stays untouched.

Usage:
    python scripts/05_resync.py --release data/filtered.csv
    python scripts/05_resync.py --release data/filtered.csv --city-slug chicago
"""
from __future__ import annotations

import argparse
import csv
import importlib.util
import sys
import tempfile
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RELEASE = ROOT / "data" / "filtered.csv"

RESYNC_COLUMNS = ("gers_id", "name", "lon", "lat", "confidence")


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


def _load_ingest_module():
    spec = importlib.util.spec_from_file_location(
        "place_ingest_runs_db",
        ROOT / "scripts" / "place_ingest_runs_db.py",
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load place_ingest_runs_db.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _fetch_release_rows(release_path: Path, city_slug: str | None) -> list[dict]:
    del city_slug
    con = duckdb.connect()
    rows = con.execute(
        """
        SELECT
          gers_id,
          name,
          lon,
          lat,
          least(confidence, 1.0) AS confidence
        FROM read_csv_auto(?)
        WHERE gers_id IS NOT NULL
          AND name IS NOT NULL
          AND lon IS NOT NULL
          AND lat IS NOT NULL
        """,
        [str(release_path.resolve())],
    ).fetchall()
    return [dict(zip(RESYNC_COLUMNS, row, strict=True)) for row in rows]


def _write_resync_csv(rows: list[dict], staging_path: Path) -> int:
    with staging_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=RESYNC_COLUMNS)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Re-sync Overture fields on places.")
    parser.add_argument(
        "--release",
        type=Path,
        default=DEFAULT_RELEASE,
        help="New Overture release extract (filtered.csv shape)",
    )
    parser.add_argument(
        "--city-slug",
        default=None,
        help="Optional city slug for ingest coverage when all rows belong to one city",
    )
    parser.add_argument(
        "--release-id",
        default=None,
        help="Overture release id recorded in place_ingest_runs on success",
    )
    parser.add_argument(
        "--region-key",
        default=None,
        help="Region key for ingest run metadata (optional)",
    )
    args = parser.parse_args()

    if not args.release.is_file():
        raise SystemExit(f"Release file not found: {args.release}")

    rows = _fetch_release_rows(args.release, args.city_slug)
    db = _load_db_module()
    ingest_mod = _load_ingest_module()

    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        newline="",
        suffix=".csv",
        delete=False,
    ) as tmp:
        staging_path = Path(tmp.name)

    run_id: str | None = None
    conn = None
    try:
        staged = _write_resync_csv(rows, staging_path)
        conn = db.connect()
        release_id = (args.release_id or args.release.stem).strip()
        try:
            run_id, begin_mode = ingest_mod.begin_ingest_run(
                conn,
                release_id=release_id,
                region_key=args.region_key,
                city_slug=args.city_slug,
            )
            print(f"ingest_run={run_id} mode={begin_mode} release_id={release_id}")
        except ingest_mod.IngestAlreadySucceeded as exc:
            print(f"ingest_run=already_succeeded id={exc.run_id} release_id={release_id}")
            print("resync=skipped")
            return

        try:
            updated = db.resync_places(conn, staging_path, commit=True)
            if args.city_slug and str(args.city_slug).strip():
                cities = [str(args.city_slug).strip().lower()]
            else:
                cities = ingest_mod.distinct_cities_for_staging_gers(conn, str(staging_path))
            if not cities:
                raise RuntimeError("no city coverage recorded for resync ingest run")
            ingest_mod.replace_run_cities(conn, run_id, cities)
            ingest_mod.complete_ingest_run(conn, run_id, row_count=int(updated))
        except Exception as exc:
            if run_id:
                ingest_mod.fail_ingest_run(conn, run_id, error_summary=str(exc))
            print(f"resync=failed: {exc}", file=sys.stderr)
            raise SystemExit(1) from exc

        print(f"release={args.release}")
        if args.city_slug:
            print(f"city_slug={args.city_slug}")
        print(f"staging_rows={staged}")
        print(f"rows_updated={updated}")
        print(f"ingest_cities={len(cities)}")
        print("resync=ok")
    finally:
        if conn is not None:
            conn.close()
        staging_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
