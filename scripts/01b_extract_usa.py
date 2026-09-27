#!/usr/bin/env python3
"""
USA-wide Overture Places extract — filtered at source via DuckDB + S3 Parquet.

Never materializes raw GeoJSON/CSV. Each longitude band writes a filtered
Parquet file under data/usa/band=<name>.parquet.

Usage:
    pip install duckdb overturemaps
    python scripts/01b_extract_usa.py
    python scripts/01b_extract_usa.py --band west --force
    python scripts/01b_extract_usa.py --release 2026-08-19.0
"""
from __future__ import annotations

import argparse
import importlib.util
from pathlib import Path
from typing import NamedTuple

import duckdb

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = ROOT / "data" / "usa"
CONFIDENCE_FLOOR = 0.5

# (name, minlon, maxlon, minlat, maxlat)
BANDS: tuple[tuple[str, float, float, float, float], ...] = (
    ("west", -125.0, -115.0, 32.0, 49.5),
    ("mountain", -115.0, -105.0, 31.3, 49.0),
    ("plains", -105.0, -95.0, 25.8, 49.0),
    ("midwest", -95.0, -85.0, 28.9, 49.4),
    ("east", -85.0, -75.0, 24.4, 47.5),
    ("northeast", -75.0, -66.9, 36.5, 47.5),
    ("alaska", -180.0, -129.0, 51.0, 71.5),
    ("hawaii", -161.0, -154.0, 18.8, 22.3),
)


class BandResult(NamedTuple):
    name: str
    path: Path
    rows: int
    skipped: bool


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


def _default_release() -> str:
    from overturemaps.releases import get_latest_release

    return get_latest_release()


def _parquet_glob(release: str) -> str:
    return (
        f"s3://overturemaps-us-west-2/release/{release}/"
        "theme=places/type=place/*"
    )


def _band_output_path(output_dir: Path, band_name: str) -> Path:
    return output_dir / f"band={band_name}.parquet"


def _count_parquet(path: Path) -> int:
    con = duckdb.connect()
    return int(con.execute("SELECT count(*) FROM read_parquet(?)", [str(path)]).fetchone()[0])


def _extract_band(
    con: duckdb.DuckDBPyConnection,
    *,
    band_name: str,
    minlon: float,
    maxlon: float,
    minlat: float,
    maxlat: float,
    parquet_glob: str,
    output_path: Path,
    keep_sql: str,
    exclude_sql: str,
    confidence_floor: float,
) -> int:
    out = str(output_path.resolve()).replace("\\", "/")
    glob_esc = parquet_glob.replace("'", "''")
    sql = f"""
        COPY (
          SELECT
            id AS gers_id,
            names.primary AS name,
            ST_X(geometry) AS lon,
            ST_Y(geometry) AS lat,
            categories.primary AS basic_category,
            confidence,
            list_filter(
              COALESCE(websites, []::VARCHAR[]),
              w -> w IS NOT NULL AND trim(w) <> ''
            )[1] AS website,
            phones[1] AS phone,
            list_filter(
              COALESCE(socials, []::VARCHAR[]),
              s -> contains(lower(s), 'instagram.com')
            )[1] AS instagram,
            addresses[1] AS address
          FROM read_parquet('{glob_esc}', hive_partitioning = true)
          WHERE bbox.xmax >= {minlon}
            AND bbox.xmin <= {maxlon}
            AND bbox.ymax >= {minlat}
            AND bbox.ymin <= {maxlat}
            AND confidence >= {confidence_floor}
            AND categories.primary IS NOT NULL
            AND categories.primary NOT IN ({exclude_sql})
            AND (
              categories.primary IN ({keep_sql})
              OR len(list_filter(
                COALESCE(categories.alternate, []::VARCHAR[]),
                x -> x IN ({keep_sql})
              )) > 0
            )
            AND names.primary IS NOT NULL
            AND geometry IS NOT NULL
        ) TO '{out}' (FORMAT PARQUET)
    """
    con.execute(sql)
    return _count_parquet(output_path)


def _setup_duckdb(con: duckdb.DuckDBPyConnection) -> None:
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute("INSTALL spatial; LOAD spatial;")
    con.execute("SET s3_region = 'us-west-2'")
    con.execute("SET s3_url_style = 'path'")
    con.execute("SET enable_progress_bar = false")


def extract_usa(
    *,
    release: str,
    output_dir: Path,
    bands: tuple[tuple[str, float, float, float, float], ...],
    confidence_floor: float,
    force: bool,
) -> list[BandResult]:
    cats = _load_categories_module()
    keep_sql = cats.sql_string_list(cats.GOING_OUT_CATEGORIES)
    exclude_sql = cats.sql_string_list(cats.EXCLUDE_CATEGORIES)
    parquet_glob = _parquet_glob(release)

    output_dir.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    _setup_duckdb(con)

    results: list[BandResult] = []
    for band_name, minlon, maxlon, minlat, maxlat in bands:
        output_path = _band_output_path(output_dir, band_name)
        if output_path.exists() and not force:
            rows = _count_parquet(output_path)
            results.append(BandResult(band_name, output_path, rows, True))
            print(f"band={band_name} skipped existing rows={rows} path={output_path}")
            continue

        print(
            f"band={band_name} extracting "
            f"bbox=[{minlon},{minlat},{maxlon},{maxlat}] -> {output_path}"
        )
        rows = _extract_band(
            con,
            band_name=band_name,
            minlon=minlon,
            maxlon=maxlon,
            minlat=minlat,
            maxlat=maxlat,
            parquet_glob=parquet_glob,
            output_path=output_path,
            keep_sql=keep_sql,
            exclude_sql=exclude_sql,
            confidence_floor=confidence_floor,
        )
        results.append(BandResult(band_name, output_path, rows, False))
        print(f"band={band_name} rows={rows} path={output_path}")

    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract filtered USA Overture places.")
    parser.add_argument(
        "--release",
        default=_default_release(),
        help="Overture release id (default: latest)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
    )
    parser.add_argument(
        "--confidence-floor",
        type=float,
        default=CONFIDENCE_FLOOR,
    )
    parser.add_argument(
        "--band",
        choices=[b[0] for b in BANDS],
        help="Extract a single band only",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-extract even if band parquet already exists",
    )
    args = parser.parse_args()

    bands = BANDS
    if args.band:
        bands = tuple(b for b in BANDS if b[0] == args.band)
        if not bands:
            raise SystemExit(f"Unknown band: {args.band}")

    print(f"release={args.release}")
    print(f"output_dir={args.output_dir}")
    print(f"confidence_floor={args.confidence_floor}")

    results = extract_usa(
        release=args.release,
        output_dir=args.output_dir,
        bands=bands,
        confidence_floor=args.confidence_floor,
        force=args.force,
    )

    total = sum(r.rows for r in results)
    print()
    print(f"{'band':<12} {'rows':>12} {'status':>10}")
    print("-" * 36)
    for r in results:
        status = "skipped" if r.skipped else "extracted"
        print(f"{r.name:<12} {r.rows:>12,} {status:>10}")
    print("-" * 36)
    print(f"{'TOTAL':<12} {total:>12,}")
    print("extract_usa=ok")


if __name__ == "__main__":
    main()
