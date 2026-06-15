"""
Load TIGER/Line shapefiles into PostgreSQL PostGIS tables.

Usage:
    python -m app.scripts.load_tiger
    python -m app.scripts.load_tiger --skip-states
"""
from __future__ import annotations

import argparse
import logging
from pathlib import Path

import geopandas as gpd
from shapely import wkb
from sqlalchemy import create_engine, text

from config import settings

logger = logging.getLogger(__name__)

DEFAULT_TIGER_DIR = Path("scripts/tiger")

TIGER_LAYERS: dict[str, dict[str, object]] = {
    "tl_2024_us_state": {
        "table": "tiger_states",
        "columns": ["geoid", "stusps", "name"],
        "column_map": {"GEOID": "geoid", "STUSPS": "stusps", "NAME": "name"},
        "index": "idx_tiger_states_geom",
        "kind": "single",
    },
    "tl_2024_us_zcta520": {
        "table": "tiger_zcta",
        "columns": ["zcta5ce20", "geoid"],
        "column_map": {"ZCTA5CE20": "zcta5ce20", "GEOID20": "geoid"},
        "index": "idx_tiger_zcta_geom",
        "kind": "zcta_chunked",
    },
    "place": {
        "table": "tiger_places",
        "columns": ["geoid", "name", "statefp"],
        "column_map": {"GEOID": "geoid", "NAME": "name", "STATEFP": "statefp"},
        "index": "idx_tiger_places_geom",
        "kind": "merged_states",
    },
    "cousub": {
        "table": "tiger_cousub",
        "columns": ["geoid", "name", "statefp"],
        "column_map": {"GEOID": "geoid", "NAME": "name", "STATEFP": "statefp"},
        "index": "idx_tiger_cousub_geom",
        "kind": "merged_states",
    },
}


def _set_timeouts(conn) -> None:
    conn.execute(text("SET statement_timeout = '0'"))
    conn.execute(text("SET lock_timeout = '0'"))


def _create_engine(database_url: str):
    return create_engine(
        database_url,
        echo=False,
        pool_pre_ping=True,
        connect_args={"options": "-c statement_timeout=0 -c lock_timeout=0"},
    )


def _find_shapefile(layer_dir: Path) -> Path:
    shp_files = sorted(layer_dir.glob("*.shp"))
    if not shp_files:
        raise FileNotFoundError(f"No .shp file found in {layer_dir}")
    return shp_files[0]


def _create_table(conn, table: str, columns: list[str]) -> None:
    _set_timeouts(conn)
    conn.execute(text("SET LOCAL lock_timeout = '120s'"))
    try:
        conn.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))
    except Exception as exc:
        raise RuntimeError(
            f"Could not drop {table} — another session likely holds a lock "
            f"(e.g. a stuck load_tiger run). Terminate stale backends in "
            f"Supabase Dashboard → Database → Query, then retry."
        ) from exc

    col_defs = ", ".join(f"{col} TEXT" for col in columns)
    conn.execute(
        text(
            f"""
            CREATE TABLE {table} (
                {col_defs},
                geom GEOMETRY(MultiPolygon, 4326)
            )
            """
        )
    )


def _load_chunk(
    engine,
    chunk: gpd.GeoDataFrame,
    table: str,
    columns: list[str],
    *,
    if_exists: str,
) -> None:
    """Load one ZCTA digit chunk (replace on first chunk, append thereafter)."""
    if if_exists == "replace":
        logger.info("Creating table %s", table)
        with engine.begin() as conn:
            _set_timeouts(conn)
            _create_table(conn, table, columns)
    _insert_geodataframe(engine, chunk, table, columns)


def _create_gist_index(engine, table: str, index_name: str) -> None:
    with engine.begin() as conn:
        _set_timeouts(conn)
        conn.execute(
            text(f"CREATE INDEX IF NOT EXISTS {index_name} ON {table} USING GIST (geom)")
        )


def _read_merged_state_layer(layer_dir: Path) -> gpd.GeoDataFrame:
    if not layer_dir.is_dir():
        raise FileNotFoundError(f"Missing TIGER layer directory: {layer_dir}")

    subdirs = sorted(path for path in layer_dir.iterdir() if path.is_dir())
    if not subdirs:
        raise FileNotFoundError(f"No extracted state shapefiles found in {layer_dir}")

    frames: list[gpd.GeoDataFrame] = []
    for subdir in subdirs:
        shapefile_path = _find_shapefile(subdir)
        frames.append(gpd.read_file(shapefile_path))

    merged = gpd.GeoDataFrame(
        gpd.pd.concat(frames, ignore_index=True),
        geometry="geometry",
        crs=frames[0].crs,
    )
    return merged


def _prepare_gdf(
    gdf: gpd.GeoDataFrame,
    layer_name: str,
    column_map: dict[str, str],
    columns: list[str],
) -> gpd.GeoDataFrame:
    gdf = gdf.to_crs(epsg=4326)
    missing = [src for src in column_map if src not in gdf.columns]
    if missing:
        raise ValueError(f"{layer_name} missing expected columns: {missing}")

    gdf = gdf.rename(columns=column_map)
    gdf = gdf[columns + [gdf.geometry.name]]
    return gdf.rename_geometry("geom")


def _insert_geodataframe(
    engine,
    gdf: gpd.GeoDataFrame,
    table: str,
    columns: list[str],
    *,
    chunk_size: int = 1000,
) -> None:
    insert_sql = text(
        f"INSERT INTO {table} ({', '.join(columns)}, geom) "
        f"VALUES ({', '.join(f':{column}' for column in columns)}, "
        "ST_Multi(ST_SetSRID(ST_GeomFromEWKB(:geom), 4326)))"
    )
    total = len(gdf)
    records: list[dict[str, object]] = []

    for index, row in enumerate(gdf.itertuples(index=False), start=1):
        record = {column: getattr(row, column) for column in columns}
        record["geom"] = wkb.dumps(row.geom)
        records.append(record)

        if len(records) >= chunk_size:
            with engine.begin() as conn:
                _set_timeouts(conn)
                conn.execute(insert_sql, records)
            logger.info("  inserted %d/%d rows into %s", index, total, table)
            records = []

    if records:
        with engine.begin() as conn:
            _set_timeouts(conn)
            conn.execute(insert_sql, records)
        logger.info("  inserted %d/%d rows into %s", total, total, table)


def _load_zcta_layer(
    engine,
    tiger_dir: Path,
    layer_name: str,
    config: dict[str, object],
) -> int:
    """Load ZCTA polygons in digit chunks to avoid Supabase statement timeouts."""
    table = str(config["table"])
    columns = list(config["columns"])  # type: ignore[arg-type]
    column_map = dict(config["column_map"])  # type: ignore[arg-type]
    index_name = str(config["index"])

    layer_dir = tiger_dir / layer_name
    if not layer_dir.is_dir():
        raise FileNotFoundError(f"Missing TIGER layer directory: {layer_dir}")

    shapefile_path = _find_shapefile(layer_dir)
    logger.info("Reading shapefile %s", shapefile_path)
    gdf = gpd.read_file(shapefile_path)
    gdf = _prepare_gdf(gdf, layer_name, column_map, columns)

    with engine.begin() as conn:
        _set_timeouts(conn)

    row_count = 0
    first_chunk = True
    for digit in "0123456789":
        chunk = gdf[gdf["zcta5ce20"].str.startswith(digit, na=False)]
        if chunk.empty:
            logger.info("ZCTA digit %s: no rows, skipping", digit)
            continue

        if_exists = "replace" if first_chunk else "append"
        logger.info(
            "ZCTA digit %s: loading %d rows (if_exists=%s)",
            digit,
            len(chunk),
            if_exists,
        )
        _load_chunk(engine, chunk, table, columns, if_exists=if_exists)
        row_count += len(chunk)
        first_chunk = False

    if row_count == 0:
        raise ValueError(f"No ZCTA rows found in {shapefile_path}")

    _create_gist_index(engine, table, index_name)
    logger.info("Loaded %d rows into %s", row_count, table)
    return row_count


def _load_layer(engine, tiger_dir: Path, layer_name: str, config: dict[str, object]) -> int:
    kind = str(config["kind"])
    if kind == "zcta_chunked":
        return _load_zcta_layer(engine, tiger_dir, layer_name, config)

    table = str(config["table"])
    columns = list(config["columns"])  # type: ignore[arg-type]
    column_map = dict(config["column_map"])  # type: ignore[arg-type]
    index_name = str(config["index"])

    if kind == "merged_states":
        layer_dir = tiger_dir / layer_name
        logger.info("Reading merged state shapefiles from %s", layer_dir)
        gdf = _read_merged_state_layer(layer_dir)
    else:
        layer_dir = tiger_dir / layer_name
        if not layer_dir.is_dir():
            raise FileNotFoundError(f"Missing TIGER layer directory: {layer_dir}")
        shapefile_path = _find_shapefile(layer_dir)
        logger.info("Reading shapefile %s", shapefile_path)
        gdf = gpd.read_file(shapefile_path)

    gdf = _prepare_gdf(gdf, layer_name, column_map, columns)

    with engine.begin() as conn:
        _set_timeouts(conn)
        _create_table(conn, table, columns)

    row_count = len(gdf)
    _insert_geodataframe(engine, gdf, table, columns)
    _create_gist_index(engine, table, index_name)

    logger.info("Loaded %d rows into %s", row_count, table)
    return row_count


def load_tiger(
    tiger_dir: Path = DEFAULT_TIGER_DIR,
    *,
    database_url: str | None = None,
    skip_states: bool = False,
) -> dict[str, int]:
    """Load all TIGER layers into PostgreSQL."""
    url = database_url or settings.DATABASE_URL
    engine = _create_engine(url)

    if engine.dialect.name != "postgresql":
        raise RuntimeError("load_tiger requires PostgreSQL with PostGIS")

    counts: dict[str, int] = {}
    for layer_name, config in TIGER_LAYERS.items():
        if skip_states and layer_name == "tl_2024_us_state":
            logger.info("Skipping tiger_states (--skip-states)")
            continue
        table = str(config["table"])
        counts[table] = _load_layer(engine, tiger_dir, layer_name, config)

    engine.dispose()
    return counts


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    parser = argparse.ArgumentParser(description="Load TIGER shapefiles into PostgreSQL")
    parser.add_argument(
        "--tiger-dir",
        type=Path,
        default=DEFAULT_TIGER_DIR,
        help="Directory containing extracted TIGER shapefiles",
    )
    parser.add_argument(
        "--skip-states",
        action="store_true",
        help="Skip loading tiger_states (use when already loaded)",
    )
    args = parser.parse_args()

    counts = load_tiger(args.tiger_dir, skip_states=args.skip_states)
    logger.info("TIGER load complete:")
    for table, count in counts.items():
        logger.info("  %s: %d rows", table, count)


if __name__ == "__main__":
    main()
