#!/usr/bin/env python3
"""
Step 3 — assign city_slug to USA band Parquet files.

Nearest of 100 US metro centroids within 50 km; otherwise NULL (rural).

DuckDB ST_Point expects (latitude, longitude) — not (lon, lat).

Usage:
    python scripts/01c_assign_city.py
    python scripts/01c_assign_city.py --input-dir data/usa --max-km 50 --force
"""
from __future__ import annotations

import argparse
import importlib.util
import tempfile
from pathlib import Path
from typing import NamedTuple

import duckdb

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT_DIR = ROOT / "data" / "usa"
DEFAULT_MAX_KM = 50.0


class BandStats(NamedTuple):
    band: str
    total: int
    with_slug: int
    rural: int
    skipped: bool


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


def _parquet_has_city_slug(con: duckdb.DuckDBPyConnection, path: Path) -> bool:
    cols = con.execute(
        "DESCRIBE SELECT * FROM read_parquet(?)",
        [str(path.resolve())],
    ).fetchall()
    return any(col[0] == "city_slug" for col in cols)


def _register_metros(con: duckdb.DuckDBPyConnection, metros) -> None:
    values = ",\n".join(
        f"('{m.slug}', {m.lat}, {m.lon})" for m in metros.US_METRO_CENTROIDS
    )
    con.execute(
        f"""
        CREATE OR REPLACE TEMP TABLE metros AS
        SELECT * FROM (VALUES {values}) AS t(slug, lat, lon)
        """
    )


def _assign_band(
    con: duckdb.DuckDBPyConnection,
    input_path: Path,
    output_path: Path,
    max_km: float,
) -> tuple[int, int, int]:
    in_file = str(input_path.resolve()).replace("\\", "/")
    out_file = str(output_path.resolve()).replace("\\", "/")
    con.execute(
        f"""
        COPY (
          WITH places AS (
            SELECT * FROM read_parquet('{in_file}')
          ),
          matches AS (
            SELECT
              p.gers_id,
              m.slug AS city_slug,
              ST_Distance_Sphere(
                ST_Point(p.lat, p.lon),
                ST_Point(m.lat, m.lon)
              ) / 1000.0 AS dist_km,
              ROW_NUMBER() OVER (
                PARTITION BY p.gers_id
                ORDER BY ST_Distance_Sphere(
                  ST_Point(p.lat, p.lon),
                  ST_Point(m.lat, m.lon)
                )
              ) AS rn
            FROM places p
            CROSS JOIN metros m
          ),
          best AS (
            SELECT gers_id, city_slug
            FROM matches
            WHERE dist_km <= {max_km}
              AND rn = 1
          )
          SELECT
            p.gers_id,
            p.name,
            p.lon,
            p.lat,
            p.basic_category,
            p.confidence,
            p.website,
            p.phone,
            p.instagram,
            p.address,
            b.city_slug
          FROM places p
          LEFT JOIN best b USING (gers_id)
        ) TO '{out_file}' (FORMAT PARQUET)
        """
    )
    stats = con.execute(
        f"""
        SELECT
          count(*) AS total,
          count(*) FILTER (WHERE city_slug IS NOT NULL) AS with_slug,
          count(*) FILTER (WHERE city_slug IS NULL) AS rural
        FROM read_parquet('{out_file}')
        """
    ).fetchone()
    return int(stats[0]), int(stats[1]), int(stats[2])


def assign_city_slugs(
    input_dir: Path,
    *,
    max_km: float,
    force: bool,
) -> list[BandStats]:
    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial;")
    con.execute("SET enable_progress_bar = false")
    _register_metros(con, _load_metros_module())

    bands = sorted(input_dir.glob("band=*.parquet"))
    if not bands:
        raise SystemExit(f"No band=*.parquet files in {input_dir}")

    results: list[BandStats] = []
    for input_path in bands:
        band_name = input_path.stem.replace("band=", "")
        if not force and _parquet_has_city_slug(con, input_path):
            total, with_slug, rural = con.execute(
                """
                SELECT
                  count(*) AS total,
                  count(*) FILTER (WHERE city_slug IS NOT NULL),
                  count(*) FILTER (WHERE city_slug IS NULL)
                FROM read_parquet(?)
                """,
                [str(input_path.resolve())],
            ).fetchone()
            results.append(
                BandStats(band_name, int(total), int(with_slug), int(rural), True)
            )
            print(
                f"band={band_name} skipped existing "
                f"total={total} with_slug={with_slug} rural={rural}"
            )
            continue

        print(f"band={band_name} assigning city_slug -> {input_path}")
        with tempfile.NamedTemporaryFile(
            suffix=".parquet",
            delete=False,
            dir=input_dir,
        ) as tmp:
            temp_path = Path(tmp.name)

        try:
            total, with_slug, rural = _assign_band(
                con, input_path, temp_path, max_km
            )
            temp_path.replace(input_path)
            results.append(
                BandStats(band_name, total, with_slug, rural, False)
            )
            print(
                f"band={band_name} total={total} with_slug={with_slug} rural={rural}"
            )
        finally:
            if temp_path.exists():
                temp_path.unlink(missing_ok=True)

    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Assign city_slug to USA parquets.")
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_INPUT_DIR)
    parser.add_argument("--max-km", type=float, default=DEFAULT_MAX_KM)
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-assign even if city_slug column already exists",
    )
    args = parser.parse_args()

    if not args.input_dir.is_dir():
        raise SystemExit(f"Input directory not found: {args.input_dir}")

    print(f"input_dir={args.input_dir}")
    print(f"max_km={args.max_km}")
    print(f"metros=100")

    results = assign_city_slugs(
        args.input_dir,
        max_km=args.max_km,
        force=args.force,
    )

    total = sum(r.total for r in results)
    with_slug = sum(r.with_slug for r in results)
    rural = sum(r.rural for r in results)

    print()
    print(f"{'band':<12} {'total':>10} {'with_slug':>10} {'rural':>10} {'status':>10}")
    print("-" * 56)
    for r in results:
        status = "skipped" if r.skipped else "assigned"
        print(
            f"{r.band:<12} {r.total:>10,} {r.with_slug:>10,} "
            f"{r.rural:>10,} {status:>10}"
        )
    print("-" * 56)
    print(f"{'TOTAL':<12} {total:>10,} {with_slug:>10,} {rural:>10,}")
    print(f"pct_with_slug={with_slug * 100.0 / total:.1f}%")
    print(f"pct_rural={rural * 100.0 / total:.1f}%")
    print("assign_city=ok")


if __name__ == "__main__":
    main()
