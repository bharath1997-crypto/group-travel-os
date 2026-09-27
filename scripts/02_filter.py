#!/usr/bin/env python3
"""
Step 2 — filter Overture Places to going-out categories.

Reads data/raw.geojson (Step 1), applies exact category match + confidence
floor, extracts Instagram from socials per §4, writes data/filtered.csv.

Uses DuckDB + spatial ST_Read (GeoJSON FeatureCollection is too large for
read_json default limits).

Usage:
    pip install duckdb
    python scripts/02_filter.py
    python scripts/02_filter.py --input data/raw.geojson --output data/filtered.csv
"""
from __future__ import annotations

import argparse
import importlib.util
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "data" / "raw.geojson"
DEFAULT_OUTPUT = ROOT / "data" / "filtered.csv"
CONFIDENCE_FLOOR = 0.5


def _load_categories_module():
    spec = importlib.util.spec_from_file_location(
        "places_categories",
        ROOT / "scripts" / "places_categories.py",
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load places_categories.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _build_filter_sql(input_path: str, keep_sql: str, exclude_sql: str, confidence_floor: float) -> str:
    return f"""
WITH raw AS (
  SELECT
    id AS gers_id,
    json_extract_string(names, '$.primary') AS name,
    confidence,
    json_extract_string(categories, '$.primary') AS category,
    COALESCE(
      CAST(json_extract(categories, '$.alternate') AS VARCHAR[]),
      []::VARCHAR[]
    ) AS alt_categories,
    websites,
    socials,
    phones,
    addresses,
    ST_X(geom) AS lon,
    ST_Y(geom) AS lat
  FROM ST_Read('{input_path}')
  WHERE id IS NOT NULL
    AND json_extract_string(names, '$.primary') IS NOT NULL
    AND geom IS NOT NULL
),
filtered AS (
  SELECT
    gers_id,
    name,
    lon,
    lat,
    category AS basic_category,
    confidence,
    list_filter(websites, w -> w IS NOT NULL AND trim(w) <> '')[1] AS website,
    phones[1] AS phone,
    (
      SELECT s
      FROM unnest(COALESCE(socials, []::VARCHAR[])) AS t(s)
      WHERE lower(s) LIKE '%instagram.com%'
      LIMIT 1
    ) AS instagram,
    CASE
      WHEN addresses IS NOT NULL AND len(addresses) > 0
      THEN addresses[1]
      ELSE NULL
    END AS address,
    socials,
    phones
  FROM raw
  WHERE category IS NOT NULL
    AND category NOT IN ({exclude_sql})
    AND (
      category IN ({keep_sql})
      OR len(list_filter(alt_categories, x -> x IN ({keep_sql}))) > 0
    )
    AND confidence >= {confidence_floor}
)
SELECT * FROM filtered
"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Filter Overture Places extract.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--confidence-floor",
        type=float,
        default=CONFIDENCE_FLOOR,
        help=f"Minimum confidence (default: {CONFIDENCE_FLOOR})",
    )
    args = parser.parse_args()

    if not args.input.is_file():
        raise SystemExit(f"Input not found: {args.input}")

    cats = _load_categories_module()
    keep_sql = cats.sql_string_list(cats.GOING_OUT_CATEGORIES)
    exclude_sql = cats.sql_string_list(cats.EXCLUDE_CATEGORIES)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    input_path = str(args.input.resolve()).replace("\\", "/")

    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial;")

    before = con.execute(
        f"""
        SELECT count(*) AS n
        FROM ST_Read('{input_path}')
        WHERE id IS NOT NULL
        """
    ).fetchone()[0]

    filter_sql = _build_filter_sql(
        input_path, keep_sql, exclude_sql, args.confidence_floor
    )
    con.execute(
        f"""
        COPY (
          {filter_sql}
        ) TO ? (HEADER, DELIMITER ',')
        """,
        [str(args.output.resolve())],
    )

    after = con.execute(
        "SELECT count(*) FROM read_csv_auto(?)", [str(args.output.resolve())]
    ).fetchone()[0]

    print(f"input={args.input}")
    print(f"output={args.output}")
    print(f"confidence_floor={args.confidence_floor}")
    print(f"rows_before={before}")
    print(f"rows_after={after}")
    print(f"rows_removed={before - after}")


if __name__ == "__main__":
    main()
