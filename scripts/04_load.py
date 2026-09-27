#!/usr/bin/env python3
"""
Step 5 — bulk-load filtered places into Supabase places.

Chicago CSV mode (default):
    python scripts/04_load.py
    python scripts/04_load.py --city-slug chicago --skip-migrate

USA Parquet mode:
    python scripts/04_load.py --parquet-dir data/usa --skip-migrate
    python scripts/04_load.py --parquet-dir data/usa --batch-size 100000

Refresh city_slug only (after re-running 01c_assign_city.py):
    python scripts/04_load.py --parquet-dir data/usa --refresh-slugs --skip-migrate
"""
from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import re
import sys
import tempfile
from pathlib import Path

import duckdb
import psycopg2
from psycopg2.extensions import connection as PgConnection

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FILTERED = ROOT / "data" / "filtered.csv"
DEFAULT_RAW = ROOT / "data" / "raw.geojson"
DEFAULT_PARQUET_DIR = ROOT / "data" / "usa"
DEFAULT_MIGRATION = ROOT / "migrations" / "001_places.sql"
INGEST_RUNS_MIGRATION = ROOT / "migrations" / "006_place_ingest_runs.sql"
EXPLORE_PLACES_IDX_MIGRATION = ROOT / "migrations" / "007_places_city_category_explore_idx.sql"
DEFAULT_CITY_SLUG = "chicago"
DEFAULT_BATCH_SIZE = 100_000

STAGING_COLUMNS = (
    "gers_id",
    "name",
    "lon",
    "lat",
    "basic_category",
    "confidence",
    "website",
    "phone",
    "instagram",
    "address",
    "city_slug",
)


def _import_settings():
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    from config import settings

    return settings


def _normalize_database_url(url: str) -> str:
    """Use Supabase session pooler (5432) instead of transaction pooler (6543)."""
    match = re.match(
        r"^(postgres(?:ql)?://[^?]+:)(6543)(/.*)$",
        url,
    )
    if match and "pooler.supabase.com" in url:
        return f"{match.group(1)}5432{match.group(3)}"
    return url


def _connect() -> PgConnection:
    settings = _import_settings()
    url = _normalize_database_url(settings.DATABASE_URL)
    kwargs: dict = {"dsn": url}
    if "supabase.com" in url:
        kwargs["sslmode"] = "require"
    conn = psycopg2.connect(**kwargs)
    with conn.cursor() as cur:
        cur.execute("SET statement_timeout = 0")
    conn.commit()
    return conn


def _split_sql(sql: str) -> list[str]:
    statements: list[str] = []
    buf: list[str] = []
    for line in sql.splitlines():
        stripped = line.strip()
        if stripped.startswith("--"):
            continue
        buf.append(line)
        if stripped.endswith(";"):
            stmt = "\n".join(buf).strip()
            if stmt:
                statements.append(stmt)
            buf = []
    tail = "\n".join(buf).strip()
    if tail:
        statements.append(tail)
    return statements


def _places_schema_kind(conn: PgConnection) -> str:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'places'
            """
        )
        cols = {row[0] for row in cur.fetchall()}
    if not cols:
        return "missing"
    if "gers_id" in cols and "city_slug" in cols and "depth_tier" in cols:
        return "data_spine"
    return "legacy"


def _run_migration(conn: PgConnection, migration_path: Path) -> None:
    sql = migration_path.read_text(encoding="utf-8")
    with conn.cursor() as cur:
        for stmt in _split_sql(sql):
            cur.execute(stmt)
    conn.commit()


def _ensure_schema(conn: PgConnection, migration_path: Path) -> None:
    kind = _places_schema_kind(conn)
    if kind == "data_spine":
        print("schema=data_spine (ok)")
        if INGEST_RUNS_MIGRATION.is_file():
            _run_migration(conn, INGEST_RUNS_MIGRATION)
            print("schema=place_ingest_runs (ok)")
        if EXPLORE_PLACES_IDX_MIGRATION.is_file():
            _run_migration(conn, EXPLORE_PLACES_IDX_MIGRATION)
            print("schema=places_city_category_explore_idx (ok)")
        return
    if kind == "legacy":
        with conn.cursor() as cur:
            cur.execute("ALTER TABLE places RENAME TO places_legacy_explorer")
        conn.commit()
        print("schema=legacy renamed to places_legacy_explorer")
    _run_migration(conn, migration_path)
    print("schema=migration applied")


def _load_address_map(raw_geojson: Path) -> dict[str, dict]:
    print(f"loading addresses from {raw_geojson}")
    with raw_geojson.open(encoding="utf-8") as fh:
        payload = json.load(fh)
    out: dict[str, dict] = {}
    for feat in payload.get("features") or []:
        gers_id = feat.get("id")
        addrs = (feat.get("properties") or {}).get("addresses")
        if gers_id and addrs:
            first = addrs[0]
            if isinstance(first, dict):
                out[str(gers_id)] = first
    print(f"address_map_size={len(out)}")
    return out


def _fetch_filtered_rows(filtered_path: Path) -> list[dict]:
    con = duckdb.connect()
    rows = con.execute(
        """
        SELECT
          gers_id,
          name,
          lon,
          lat,
          basic_category,
          least(confidence, 1.0) AS confidence,
          website,
          phone,
          instagram
        FROM read_csv_auto(?)
        WHERE gers_id IS NOT NULL
          AND name IS NOT NULL
          AND lon IS NOT NULL
          AND lat IS NOT NULL
        """,
        [str(filtered_path.resolve())],
    ).fetchall()
    columns = (
        "gers_id",
        "name",
        "lon",
        "lat",
        "basic_category",
        "confidence",
        "website",
        "phone",
        "instagram",
    )
    return [dict(zip(columns, row, strict=True)) for row in rows]


def _write_staging_csv(
    rows: list[dict],
    *,
    address_map: dict[str, dict] | None,
    fixed_city_slug: str | None,
    staging_path: Path,
) -> int:
    with staging_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=STAGING_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            gers_id = str(row["gers_id"])
            if "address" in row:
                addr = row.get("address") or ""
            elif address_map is not None:
                addr_obj = address_map.get(gers_id)
                addr = json.dumps(addr_obj) if addr_obj else ""
            else:
                addr = ""
            city_slug = fixed_city_slug if fixed_city_slug is not None else row.get("city_slug")
            writer.writerow(
                {
                    **row,
                    "address": addr,
                    "city_slug": city_slug or "",
                }
            )
    return len(rows)


def _copy_and_upsert(conn: PgConnection, staging_path: Path) -> tuple[int, int]:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TEMP TABLE places_staging (
              gers_id         text,
              name            text,
              lon             double precision,
              lat             double precision,
              basic_category  text,
              confidence      real,
              website         text,
              phone           text,
              instagram       text,
              address         text,
              city_slug       text
            ) ON COMMIT DROP
            """
        )
        copy_sql = """
            COPY places_staging (
              gers_id, name, lon, lat, basic_category, confidence,
              website, phone, instagram, address, city_slug
            )
            FROM STDIN WITH (FORMAT CSV, HEADER TRUE, NULL '')
        """
        with staging_path.open("r", encoding="utf-8") as fh:
            cur.copy_expert(copy_sql, fh)

        cur.execute("SELECT count(*) FROM places_staging")
        staged = int(cur.fetchone()[0])

        cur.execute(
            """
            INSERT INTO places (
              gers_id,
              name,
              geog,
              basic_category,
              confidence,
              website,
              phone,
              instagram,
              address,
              city_slug,
              depth_tier
            )
            SELECT
              s.gers_id,
              s.name,
              ST_SetSRID(ST_MakePoint(s.lon, s.lat), 4326)::geography,
              s.basic_category,
              LEAST(s.confidence, 1.0),
              NULLIF(s.website, ''),
              NULLIF(s.phone, ''),
              NULLIF(s.instagram, ''),
              CASE
                WHEN s.address IS NULL OR trim(s.address) = '' THEN NULL
                ELSE s.address::jsonb
              END,
              NULLIF(s.city_slug, ''),
              0
            FROM places_staging s
            ON CONFLICT (gers_id) DO UPDATE SET
              name = EXCLUDED.name,
              geog = EXCLUDED.geog,
              basic_category = EXCLUDED.basic_category,
              confidence = EXCLUDED.confidence,
              website = EXCLUDED.website,
              phone = EXCLUDED.phone,
              instagram = EXCLUDED.instagram,
              address = EXCLUDED.address,
              city_slug = CASE
                WHEN places.city_slug = 'chicago' THEN 'chicago'
                ELSE EXCLUDED.city_slug
              END
            WHERE places.depth_tier = 0
            """
        )
        inserted_updated = cur.rowcount

        cur.execute(
            """
            UPDATE places p SET
              name = s.name,
              geog = ST_SetSRID(ST_MakePoint(s.lon, s.lat), 4326)::geography,
              confidence = LEAST(s.confidence, 1.0)
            FROM places_staging s
            WHERE p.gers_id = s.gers_id
              AND p.depth_tier >= 1
            """
        )

    conn.commit()
    return staged, inserted_updated


def _parquet_band_paths(parquet_dir: Path, only_bands: list[str] | None = None) -> list[Path]:
    bands = sorted(parquet_dir.glob("band=*.parquet"))
    if not bands:
        raise SystemExit(f"No band=*.parquet files in {parquet_dir}")
    if only_bands:
        wanted = set(only_bands)
        bands = [p for p in bands if p.stem.replace("band=", "") in wanted]
        if not bands:
            raise SystemExit(f"No matching bands in {parquet_dir}: {only_bands}")
    return bands


def _parquet_row_count(con: duckdb.DuckDBPyConnection, path: Path) -> int:
    return int(
        con.execute(
            """
            SELECT count(*) FROM read_parquet(?)
            WHERE gers_id IS NOT NULL
              AND name IS NOT NULL
              AND lon IS NOT NULL
              AND lat IS NOT NULL
            """,
            [str(path.resolve())],
        ).fetchone()[0]
    )


def _export_parquet_batch(
    con: duckdb.DuckDBPyConnection,
    path: Path,
    offset: int,
    batch_size: int,
    staging_path: Path,
) -> int:
    in_file = str(path.resolve()).replace("\\", "/")
    out_file = str(staging_path.resolve()).replace("\\", "/")
    con.execute(
        f"""
        COPY (
          WITH src AS (
            SELECT
              gers_id,
              name,
              lon,
              lat,
              basic_category,
              least(confidence, 1.0) AS confidence,
              website,
              phone,
              instagram,
              CASE
                WHEN address IS NULL THEN NULL
                ELSE to_json(address)
              END AS address,
              city_slug,
              row_number() OVER () AS rn
            FROM read_parquet('{in_file}')
            WHERE gers_id IS NOT NULL
              AND name IS NOT NULL
              AND lon IS NOT NULL
              AND lat IS NOT NULL
          )
          SELECT
            gers_id,
            name,
            lon,
            lat,
            basic_category,
            confidence,
            website,
            phone,
            instagram,
            coalesce(address, '') AS address,
            coalesce(city_slug, '') AS city_slug
          FROM src
          WHERE rn > {offset}
            AND rn <= {offset + batch_size}
        ) TO '{out_file}' (FORMAT CSV, HEADER TRUE)
        """
    )
    return int(
        con.execute(
            "SELECT count(*) FROM read_csv_auto(?)",
            [str(staging_path.resolve())],
        ).fetchone()[0]
    )


def _export_slug_batch(
    con: duckdb.DuckDBPyConnection,
    path: Path,
    offset: int,
    batch_size: int,
    staging_path: Path,
) -> int:
    in_file = str(path.resolve()).replace("\\", "/")
    out_file = str(staging_path.resolve()).replace("\\", "/")
    con.execute(
        f"""
        COPY (
          WITH src AS (
            SELECT gers_id, city_slug, row_number() OVER () AS rn
            FROM read_parquet('{in_file}')
            WHERE gers_id IS NOT NULL
          )
          SELECT gers_id, coalesce(city_slug, '') AS city_slug
          FROM src
          WHERE rn > {offset}
            AND rn <= {offset + batch_size}
        ) TO '{out_file}' (FORMAT CSV, HEADER TRUE)
        """
    )
    return int(
        con.execute(
            "SELECT count(*) FROM read_csv_auto(?)",
            [str(staging_path.resolve())],
        ).fetchone()[0]
    )


def _refresh_slugs_batch(conn: PgConnection, staging_path: Path) -> tuple[int, int]:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TEMP TABLE slug_staging (
              gers_id   text,
              city_slug text
            ) ON COMMIT DROP
            """
        )
        copy_sql = """
            COPY slug_staging (gers_id, city_slug)
            FROM STDIN WITH (FORMAT CSV, HEADER TRUE, NULL '')
        """
        with staging_path.open("r", encoding="utf-8") as fh:
            cur.copy_expert(copy_sql, fh)

        cur.execute("SELECT count(*) FROM slug_staging")
        staged = int(cur.fetchone()[0])

        cur.execute(
            """
            UPDATE places p SET
              city_slug = NULLIF(s.city_slug, '')
            FROM slug_staging s
            WHERE p.gers_id = s.gers_id
              AND p.depth_tier = 0
              AND p.city_slug IS DISTINCT FROM NULLIF(s.city_slug, '')
            """
        )
        updated = cur.rowcount

    conn.commit()
    return staged, updated


def refresh_parquet_slugs(
    conn: PgConnection,
    parquet_dir: Path,
    *,
    batch_size: int,
    only_bands: list[str] | None = None,
    start_offset: int = 0,
) -> tuple[int, int]:
    bands = _parquet_band_paths(parquet_dir, only_bands)
    con = duckdb.connect()
    total_staged = 0
    total_updated = 0
    batch_num = 0

    print(f"refresh_slugs bands={len(bands)} batch_size={batch_size}")

    for band_index, band_path in enumerate(bands):
        band_name = band_path.stem.replace("band=", "")
        band_rows = int(
            con.execute(
                "SELECT count(*) FROM read_parquet(?) WHERE gers_id IS NOT NULL",
                [str(band_path.resolve())],
            ).fetchone()[0]
        )
        band_start = start_offset if band_index == 0 else 0
        print(f"band={band_name} rows={band_rows:,} start_offset={band_start:,}")

        for offset in range(band_start, band_rows, batch_size):
            batch_num += 1
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                newline="",
                suffix=".csv",
                delete=False,
            ) as tmp:
                staging_path = Path(tmp.name)

            try:
                staged = _export_slug_batch(
                    con, band_path, offset, batch_size, staging_path
                )
                if staged == 0:
                    continue
                copy_rows, updated = _refresh_slugs_batch(conn, staging_path)
                total_staged += copy_rows
                total_updated += updated
                print(
                    f"batch={batch_num} band={band_name} "
                    f"offset={offset:,} staged={copy_rows:,} updated={updated:,}"
                )
            finally:
                staging_path.unlink(missing_ok=True)

    return total_staged, total_updated


def load_parquet_dir(
    conn: PgConnection,
    parquet_dir: Path,
    *,
    batch_size: int,
    only_bands: list[str] | None = None,
    start_offset: int = 0,
) -> tuple[int, int]:
    bands = _parquet_band_paths(parquet_dir, only_bands)
    con = duckdb.connect()
    total_staged = 0
    total_affected = 0
    batch_num = 0

    print(f"parquet_bands={len(bands)} batch_size={batch_size}")

    for band_index, band_path in enumerate(bands):
        band_name = band_path.stem.replace("band=", "")
        band_rows = _parquet_row_count(con, band_path)
        band_start = start_offset if band_index == 0 else 0
        if band_start >= band_rows:
            print(f"band={band_name} skipped start_offset={band_start:,} >= rows={band_rows:,}")
            continue
        print(f"band={band_name} rows={band_rows:,} start_offset={band_start:,}")

        for offset in range(band_start, band_rows, batch_size):
            batch_num += 1
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                newline="",
                suffix=".csv",
                delete=False,
            ) as tmp:
                staging_path = Path(tmp.name)

            try:
                staged = _export_parquet_batch(
                    con, band_path, offset, batch_size, staging_path
                )
                if staged == 0:
                    continue
                copy_rows, affected = _copy_and_upsert(conn, staging_path)
                total_staged += copy_rows
                total_affected += affected
                print(
                    f"batch={batch_num} band={band_name} "
                    f"offset={offset:,} staged={copy_rows:,} affected={affected:,}"
                )
            finally:
                staging_path.unlink(missing_ok=True)

    return total_staged, total_affected


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


def _covered_city_slugs(*, parquet_dir: Path | None, city_slug: str | None) -> list[str]:
    if city_slug and str(city_slug).strip():
        return [str(city_slug).strip().lower()]
    if parquet_dir is not None:
        con = duckdb.connect()
        pattern = str(parquet_dir.resolve() / "**" / "*.parquet")
        try:
            rows = con.execute(
                """
                SELECT DISTINCT city_slug
                FROM read_parquet(?)
                WHERE city_slug IS NOT NULL AND city_slug <> ''
                """,
                [pattern],
            ).fetchall()
        except Exception:
            return []
        return sorted({str(r[0]).strip().lower() for r in rows if r and r[0]})
    return []


def print_post_load_stats(conn: PgConnection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT count(*) AS total,
                   count(DISTINCT city_slug) AS cities,
                   count(*) FILTER (WHERE city_slug IS NULL) AS rural,
                   pg_size_pretty(pg_total_relation_size('places')) AS size
            FROM places
            """
        )
        total, cities, rural, size = cur.fetchone()
        print()
        print("post_load_summary")
        print(f"total={total:,}")
        print(f"cities={cities:,}")
        print(f"rural={rural:,}")
        print(f"size={size}")

        cur.execute(
            """
            SELECT city_slug, count(*) AS n
            FROM places
            GROUP BY 1
            ORDER BY 2 DESC NULLS LAST
            LIMIT 20
            """
        )
        print()
        print("top_cities")
        for city_slug, count in cur.fetchall():
            label = city_slug if city_slug is not None else "(rural)"
            print(f"  {label}: {count:,}")

        cur.execute(
            """
            SELECT count(*) FROM places
            WHERE city_slug = 'chicago' AND confidence > 1.0
            """
        )
        over_one = int(cur.fetchone()[0])
        print(f"chicago_confidence_over_1={over_one}")


def load_csv(
    conn: PgConnection,
    *,
    filtered_path: Path,
    raw_path: Path,
    city_slug: str,
) -> tuple[int, int]:
    rows = _fetch_filtered_rows(filtered_path)
    address_map = _load_address_map(raw_path)

    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        newline="",
        suffix=".csv",
        delete=False,
    ) as tmp:
        staging_path = Path(tmp.name)

    try:
        staged_rows = _write_staging_csv(
            rows,
            address_map=address_map,
            fixed_city_slug=city_slug,
            staging_path=staging_path,
        )
        print(f"staging_rows={staged_rows}")
        print(f"city_slug={city_slug}")
        return _copy_and_upsert(conn, staging_path)
    finally:
        staging_path.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Load filtered places into Supabase.")
    parser.add_argument("--filtered", type=Path, default=DEFAULT_FILTERED)
    parser.add_argument("--raw", type=Path, default=DEFAULT_RAW)
    parser.add_argument(
        "--parquet-dir",
        type=Path,
        default=None,
        help="Load band=*.parquet files from this directory (USA mode)",
    )
    parser.add_argument("--migration", type=Path, default=DEFAULT_MIGRATION)
    parser.add_argument("--city-slug", default=DEFAULT_CITY_SLUG)
    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help="Rows per batch when loading Parquet (default: 100000)",
    )
    parser.add_argument(
        "--bands",
        nargs="+",
        help="Load only these band names (e.g. plains west)",
    )
    parser.add_argument(
        "--start-offset",
        type=int,
        default=0,
        help="Skip rows at the start of the first selected band (resume aid)",
    )
    parser.add_argument(
        "--refresh-slugs",
        action="store_true",
        help="Update city_slug from Parquet only (no full upsert)",
    )
    parser.add_argument(
        "--skip-migrate",
        action="store_true",
        help="Skip schema migration / legacy rename",
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

    if args.refresh_slugs and args.parquet_dir is None:
        raise SystemExit("--refresh-slugs requires --parquet-dir")

    if args.parquet_dir is not None:
        if not args.parquet_dir.is_dir():
            raise SystemExit(f"Parquet directory not found: {args.parquet_dir}")
        if args.batch_size < 1:
            raise SystemExit("--batch-size must be >= 1")
    else:
        if not args.filtered.is_file():
            raise SystemExit(f"Filtered input not found: {args.filtered}")
        if not args.raw.is_file():
            raise SystemExit(f"Raw GeoJSON not found: {args.raw}")

    conn = _connect()
    ingest_mod = _load_ingest_module()
    run_id: str | None = None
    try:
        if not args.skip_migrate:
            _ensure_schema(conn, args.migration)
        else:
            print("schema=skip-migrate")

        if args.parquet_dir is not None and args.refresh_slugs:
            print(f"mode=refresh-slugs dir={args.parquet_dir}")
            staged, affected = refresh_parquet_slugs(
                conn,
                args.parquet_dir,
                batch_size=args.batch_size,
                only_bands=args.bands,
                start_offset=args.start_offset,
            )
            print(f"copy_rows={staged:,}")
            print(f"rows_affected={affected:,}")
            print_post_load_stats(conn)
            print("load=ok")
            return

        release_id = (args.release_id or "local-load").strip()
        scope_city = args.city_slug if args.parquet_dir is None else None
        try:
            run_id, begin_mode = ingest_mod.begin_ingest_run(
                conn,
                release_id=release_id,
                region_key=args.region_key,
                city_slug=scope_city,
            )
            print(f"ingest_run={run_id} mode={begin_mode} release_id={release_id}")
        except ingest_mod.IngestAlreadySucceeded as exc:
            print(f"ingest_run=already_succeeded id={exc.run_id} release_id={release_id}")
            print("load=skipped")
            return

        try:
            if args.parquet_dir is not None:
                print(f"mode=parquet dir={args.parquet_dir}")
                staged, affected = load_parquet_dir(
                    conn,
                    args.parquet_dir,
                    batch_size=args.batch_size,
                    only_bands=args.bands,
                    start_offset=args.start_offset,
                )
            else:
                print("mode=csv")
                staged, affected = load_csv(
                    conn,
                    filtered_path=args.filtered,
                    raw_path=args.raw,
                    city_slug=args.city_slug,
                )

            cities = _covered_city_slugs(parquet_dir=args.parquet_dir, city_slug=args.city_slug)
            if not cities:
                raise RuntimeError("no city coverage recorded for ingest run")
            ingest_mod.replace_run_cities(conn, run_id, cities)
            ingest_mod.complete_ingest_run(conn, run_id, row_count=int(affected))
        except Exception as exc:
            if run_id:
                ingest_mod.fail_ingest_run(conn, run_id, error_summary=str(exc))
            print(f"load=failed: {exc}", file=sys.stderr)
            raise SystemExit(1) from exc

        print(f"copy_rows={staged:,}")
        print(f"rows_affected={affected:,}")
        print(f"ingest_cities={len(cities)}")
        print_post_load_stats(conn)
        print("load=ok")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
