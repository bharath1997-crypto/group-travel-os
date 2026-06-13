"""
Load TIGER/Line shapefiles into PostgreSQL PostGIS tables.

Usage:
    python -m app.scripts.load_tiger
"""
from __future__ import annotations

import argparse
import logging
from pathlib import Path

import geopandas as gpd
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
        "column_map": {"ZCTA5CE20": "zcta5ce20", "GEOID": "geoid"},
        "index": "idx_tiger_zcta_geom",
        "kind": "single",
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


def _find_shapefile(layer_dir: Path) -> Path:
    shp_files = sorted(layer_dir.glob("*.shp"))
    if not shp_files:
        raise FileNotFoundError(f"No .shp file found in {layer_dir}")
    return shp_files[0]


def _create_table(conn, table: str, columns: list[str]) -> None:
    col_defs = ", ".join(f"{col} TEXT" for col in columns)
    conn.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))
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


def _load_layer(engine, tiger_dir: Path, layer_name: str, config: dict[str, object]) -> int:
    table = str(config["table"])
    columns = list(config["columns"])  # type: ignore[arg-type]
    column_map = dict(config["column_map"])  # type: ignore[arg-type]
    index_name = str(config["index"])
    kind = str(config["kind"])

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

    gdf = gdf.to_crs(epsg=4326)

    missing = [src for src in column_map if src not in gdf.columns]
    if missing:
        raise ValueError(f"{layer_name} missing expected columns: {missing}")

    gdf = gdf.rename(columns=column_map)
    gdf = gdf[list(columns) + [gdf.geometry.name]]
    gdf = gdf.rename_geometry("geom")

    with engine.begin() as conn:
        _create_table(conn, table, columns)

    row_count = len(gdf)
    gdf.to_postgis(table, engine, if_exists="append", index=False)

    with engine.begin() as conn:
        conn.execute(
            text(f"CREATE INDEX IF NOT EXISTS {index_name} ON {table} USING GIST (geom)")
        )

    logger.info("Loaded %d rows into %s", row_count, table)
    return row_count


def load_tiger(
    tiger_dir: Path = DEFAULT_TIGER_DIR,
    *,
    database_url: str | None = None,
) -> dict[str, int]:
    """Load all TIGER layers into PostgreSQL."""
    url = database_url or settings.DATABASE_URL
    engine = create_engine(url, echo=False, pool_pre_ping=True)

    if engine.dialect.name != "postgresql":
        raise RuntimeError("load_tiger requires PostgreSQL with PostGIS")

    counts: dict[str, int] = {}
    for layer_name, config in TIGER_LAYERS.items():
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
    args = parser.parse_args()

    counts = load_tiger(args.tiger_dir)
    logger.info("TIGER load complete:")
    for table, count in counts.items():
        logger.info("  %s: %d rows", table, count)


if __name__ == "__main__":
    main()
