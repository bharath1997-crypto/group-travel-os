"""
Overpass ETL — import OSM POIs into the places table.

Usage:
    python -m app.scripts.osm_etl
    python -m app.scripts.osm_etl --sw_lat 40.0 --sw_lng -75.0 --ne_lat 41.0 --ne_lng -74.0
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, sessionmaker

from config import settings

logger = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_HTTP_HEADERS = {
    "User-Agent": "Rovvy/1.0 (group travel app; contact@rovvy.app)",
    "Accept": "application/json",
}
TILE_STEP_DEGREES = 5.0
TILE_SLEEP_SECONDS = 10
RETRY_WAIT_SECONDS = 30
UPSERT_BATCH_SIZE = 50
DEADLOCK_MAX_RETRIES = 5
LOCK_FILE = Path("osm_etl.lock")

USA_SW_LAT = 24.396308
USA_SW_LNG = -125.0
USA_NE_LAT = 49.384358
USA_NE_LNG = -66.93457

POSTGIS_UPSERT_SQL = text("""
INSERT INTO places (
    osm_id, name, category, subcategory, lat, lng, geom,
    address, tags, website, phone, opening_hours, photo_url, source
) VALUES (
    :osm_id, :name, :category, :subcategory, :lat, :lng,
    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326),
    CAST(:address AS jsonb), CAST(:tags AS jsonb),
    :website, :phone, :opening_hours, NULL, 'osm'
)
ON CONFLICT (osm_id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    geom = EXCLUDED.geom,
    tags = EXCLUDED.tags,
    website = EXCLUDED.website,
    phone = EXCLUDED.phone,
    opening_hours = EXCLUDED.opening_hours,
    enriched_at = NOW()
""")

SQLITE_UPSERT_SQL = text("""
INSERT INTO places (
    osm_id, name, category, subcategory, lat, lng,
    address, tags, website, phone, opening_hours, photo_url, source
) VALUES (
    :osm_id, :name, :category, :subcategory, :lat, :lng,
    :address, :tags, :website, :phone, :opening_hours, NULL, 'osm'
)
ON CONFLICT (osm_id) DO UPDATE SET
    name = excluded.name,
    category = excluded.category,
    lat = excluded.lat,
    lng = excluded.lng,
    tags = excluded.tags,
    website = excluded.website,
    phone = excluded.phone,
    opening_hours = excluded.opening_hours
""")


CATEGORY_MAP: dict[str, str] = {
    # Restaurants
    "restaurant": "restaurant",
    "cafe": "restaurant",
    "fast_food": "restaurant",
    "food_court": "restaurant",
    "bar": "nightlife",
    "pub": "nightlife",
    "nightclub": "nightlife",
    "casino": "nightlife",
    # Entertainment
    "cinema": "entertainment",
    "theatre": "entertainment",
    "arts_centre": "entertainment",
    "bowling_alley": "gaming",
    # Gaming only
    "arcade": "gaming",
    "amusement_arcade": "gaming",
    # Parks
    "park": "park",
    # playground — skipped (not useful for Rovvy)
    "sports_centre": "sports",
    "fitness_centre": "sports",
    "golf_course": "sports",
    "marina": "activities",
    "water_park": "activities",
    "swimming_pool": "sports",
    # Tourism
    "attraction": "landmark",
    "museum": "landmark",
    "gallery": "landmark",
    "zoo": "landmark",
    "theme_park": "amusement",
    "viewpoint": "photo_spot",
    "artwork": "photo_spot",
    # Shopping
    "mall": "shopping",
    "department_store": "shopping",
    "marketplace": "shopping",
    "supermarket": "shopping",
    # Nature
    "beach": "nature",
    "waterfall": "nature",
    "hot_spring": "nature",
    "cave_entrance": "nature",
    "peak": "trekking",
    # Historic
    "monument": "landmark",
    "memorial": "landmark",
    "castle": "landmark",
    "ruins": "landmark",
}


def build_overpass_query(sw_lat: float, sw_lng: float, ne_lat: float, ne_lng: float) -> str:
    """Build Overpass QL for a bounding-box tile."""
    return (
        "[out:json][timeout:60];\n"
        f"(\n"
        f"  node[\"amenity\"~\"restaurant|cafe|bar|pub|nightclub|cinema|theatre|fast_food|food_court\"]({sw_lat},{sw_lng},{ne_lat},{ne_lng});\n"
        f"  node[\"leisure\"~\"park|sports_centre|fitness_centre|golf_course|marina|water_park\"]({sw_lat},{sw_lng},{ne_lat},{ne_lng});\n"
        f"  node[\"tourism\"~\"attraction|museum|viewpoint|artwork|gallery|zoo|theme_park\"]({sw_lat},{sw_lng},{ne_lat},{ne_lng});\n"
        f"  node[\"shop\"~\"mall|department_store|supermarket|marketplace\"]({sw_lat},{sw_lng},{ne_lat},{ne_lng});\n"
        f"  node[\"natural\"~\"beach|peak|waterfall|hot_spring|cave_entrance\"]({sw_lat},{sw_lng},{ne_lat},{ne_lng});\n"
        f"  node[\"historic\"~\"monument|memorial|castle|ruins|landmark\"]({sw_lat},{sw_lng},{ne_lat},{ne_lng});\n"
        f"  node[\"amenity\"~\"nightclub|casino|bowling_alley|arts_centre\"]({sw_lat},{sw_lng},{ne_lat},{ne_lng});\n"
        f");\n"
        "out body;\n"
    )


def map_category(tags: dict[str, Any]) -> tuple[str, str] | None:
    """Map OSM tags to Rovvy (category, subcategory)."""
    if tags.get("leisure") == "playground":
        return None

    for tag_key in ("amenity", "leisure", "tourism", "shop", "natural"):
        tag_value = tags.get(tag_key)
        if not tag_value:
            continue
        category = CATEGORY_MAP.get(tag_value)
        if category:
            return category, tag_value

    historic = tags.get("historic")
    if historic:
        return CATEGORY_MAP.get(historic, "landmark"), historic
    return None


def map_node_to_place(node: dict[str, Any]) -> dict[str, Any] | None:
    """Convert an Overpass OSM node element into a places row dict."""
    tags = node.get("tags") or {}
    name = tags.get("name")
    if not name:
        return None

    mapped = map_category(tags)
    if not mapped:
        return None

    category, subcategory = mapped
    lat = node.get("lat")
    lng = node.get("lon")
    if lat is None or lng is None:
        return None

    address = {
        "street": tags.get("addr:street"),
        "city": tags.get("addr:city"),
        "state": tags.get("addr:state"),
        "postcode": tags.get("addr:postcode"),
        "country": tags.get("addr:country", "US"),
    }

    return {
        "osm_id": node["id"],
        "name": name,
        "category": category,
        "subcategory": subcategory,
        "lat": lat,
        "lng": lng,
        "address": address,
        "tags": tags,
        "website": tags.get("website") or tags.get("contact:website"),
        "phone": tags.get("phone") or tags.get("contact:phone"),
        "opening_hours": tags.get("opening_hours"),
    }


def generate_tiles(
    sw_lat: float,
    sw_lng: float,
    ne_lat: float,
    ne_lng: float,
    step: float = TILE_STEP_DEGREES,
) -> list[tuple[float, float, float, float]]:
    """Split a bounding box into grid tiles."""
    tiles: list[tuple[float, float, float, float]] = []
    lat = sw_lat
    while lat < ne_lat:
        tile_ne_lat = min(lat + step, ne_lat)
        lng = sw_lng
        while lng < ne_lng:
            tile_ne_lng = min(lng + step, ne_lng)
            tiles.append((lat, lng, tile_ne_lat, tile_ne_lng))
            lng += step
        lat += step
    return tiles


def fetch_overpass_tile(
    sw_lat: float,
    sw_lng: float,
    ne_lat: float,
    ne_lng: float,
    client: httpx.Client | None = None,
) -> list[dict[str, Any]]:
    """POST Overpass query for one tile; retry once on 429/504."""
    query = build_overpass_query(sw_lat, sw_lng, ne_lat, ne_lng)
    owns_client = client is None
    if owns_client:
        client = httpx.Client(headers=OVERPASS_HTTP_HEADERS, timeout=90.0)

    try:
        for attempt in range(2):
            response = client.post(
                OVERPASS_URL,
                data={"data": query},
                headers=OVERPASS_HTTP_HEADERS,
            )
            if response.status_code in (429, 504) and attempt == 0:
                logger.warning(
                    "Overpass %s for tile (%s,%s,%s,%s) — retrying in %ss",
                    response.status_code,
                    sw_lat,
                    sw_lng,
                    ne_lat,
                    ne_lng,
                    RETRY_WAIT_SECONDS,
                )
                time.sleep(RETRY_WAIT_SECONDS)
                continue
            response.raise_for_status()
            data = response.json()
            return data.get("elements", [])
        return []
    finally:
        if owns_client:
            client.close()


def _upsert_sql(db: Session) -> Any:
    dialect = db.bind.dialect.name if db.bind else "postgresql"
    return SQLITE_UPSERT_SQL if dialect == "sqlite" else POSTGIS_UPSERT_SQL


def _place_params(place: dict[str, Any]) -> dict[str, Any]:
    return {
        "osm_id": place["osm_id"],
        "name": place["name"],
        "category": place["category"],
        "subcategory": place["subcategory"],
        "lat": place["lat"],
        "lng": place["lng"],
        "address": json.dumps(place["address"]),
        "tags": json.dumps(place["tags"]),
        "website": place.get("website"),
        "phone": place.get("phone"),
        "opening_hours": place.get("opening_hours"),
    }


def upsert_place(db: Session, place: dict[str, Any], upsert_sql: Any | None = None) -> None:
    """Insert or update a single place row."""
    sql = _upsert_sql(db) if upsert_sql is None else upsert_sql
    db.execute(sql, _place_params(place))


def _is_deadlock(exc: OperationalError) -> bool:
    orig = getattr(exc, "orig", None)
    return orig is not None and orig.__class__.__name__ == "DeadlockDetected"


def upsert_places(db: Session, places: list[dict[str, Any]]) -> int:
    """Upsert places in small batches with deadlock retries."""
    if not places:
        return 0

    upsert_sql = _upsert_sql(db)
    inserted = 0
    for batch_start in range(0, len(places), UPSERT_BATCH_SIZE):
        batch = places[batch_start : batch_start + UPSERT_BATCH_SIZE]
        for attempt in range(DEADLOCK_MAX_RETRIES):
            try:
                for place in batch:
                    upsert_place(db, place, upsert_sql)
                db.commit()
                inserted += len(batch)
                break
            except OperationalError as exc:
                db.rollback()
                if _is_deadlock(exc) and attempt < DEADLOCK_MAX_RETRIES - 1:
                    wait = 0.5 * (attempt + 1)
                    logger.warning("Deadlock on upsert batch — retry %d in %.1fs", attempt + 1, wait)
                    time.sleep(wait)
                    continue
                raise
    return inserted


def create_etl_session() -> Session:
    """Dedicated DB session for ETL — no SQL echo, longer statement timeout."""
    engine = create_engine(
        settings.DATABASE_URL,
        echo=False,
        pool_pre_ping=True,
        connect_args={"connect_timeout": 5},
    )
    db = sessionmaker(bind=engine)()
    if engine.dialect.name != "sqlite":
        db.execute(text("SET statement_timeout = '300s'"))
    return db


def _configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    if sys.platform == "win32":
        for handler in logging.root.handlers:
            stream = getattr(handler, "stream", None)
            if stream is not None and hasattr(stream, "reconfigure"):
                stream.reconfigure(encoding="utf-8", errors="replace")


def _pid_running(pid: int) -> bool:
    if pid <= 0:
        return False
    if sys.platform == "win32":
        import ctypes

        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        handle = ctypes.windll.kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
        if handle:
            ctypes.windll.kernel32.CloseHandle(handle)
            return True
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def acquire_etl_lock() -> None:
    """Prevent concurrent ETL runs that deadlock on places upserts."""
    if LOCK_FILE.exists():
        try:
            existing_pid = int(LOCK_FILE.read_text().strip())
        except ValueError:
            existing_pid = 0
        if _pid_running(existing_pid):
            raise SystemExit(
                f"OSM ETL already running (PID {existing_pid}). "
                "Stop it before starting another run."
            )
        LOCK_FILE.unlink(missing_ok=True)
    LOCK_FILE.write_text(str(os.getpid()), encoding="utf-8")


def release_etl_lock() -> None:
    if LOCK_FILE.exists() and LOCK_FILE.read_text(encoding="utf-8").strip() == str(os.getpid()):
        LOCK_FILE.unlink(missing_ok=True)


def run_etl(
    sw_lat: float,
    sw_lng: float,
    ne_lat: float,
    ne_lng: float,
    db: Session | None = None,
    client: httpx.Client | None = None,
    start_tile: int = 1,
) -> dict[str, int]:
    """Run full ETL over a bounding box grid."""
    owns_db = db is None
    if owns_db:
        db = create_etl_session()

    tiles = generate_tiles(sw_lat, sw_lng, ne_lat, ne_lng)
    if start_tile < 1 or start_tile > len(tiles):
        raise ValueError(f"start_tile must be between 1 and {len(tiles)}")

    tiles_completed = 0
    total_fetched = 0
    total_inserted = 0

    owns_client = client is None
    if owns_client:
        client = httpx.Client(timeout=120.0)

    try:
        for idx, (t_sw_lat, t_sw_lng, t_ne_lat, t_ne_lng) in enumerate(tiles):
            if idx + 1 < start_tile:
                continue

            elements = fetch_overpass_tile(
                t_sw_lat, t_sw_lng, t_ne_lat, t_ne_lng, client=client
            )
            places: list[dict[str, Any]] = []
            for element in elements:
                if element.get("type") != "node":
                    continue
                place = map_node_to_place(element)
                if place:
                    places.append(place)

            inserted = upsert_places(db, places)
            tiles_completed += 1
            total_fetched += len(elements)
            total_inserted += inserted

            logger.info(
                "Tile %d/%d [%s,%s,%s,%s]: fetched=%d inserted=%d | "
                "totals: tiles=%d fetched=%d inserted=%d",
                idx + 1,
                len(tiles),
                t_sw_lat,
                t_sw_lng,
                t_ne_lat,
                t_ne_lng,
                len(elements),
                inserted,
                tiles_completed,
                total_fetched,
                total_inserted,
            )

            if idx < len(tiles) - 1:
                time.sleep(TILE_SLEEP_SECONDS)
    finally:
        if owns_client:
            client.close()
        if owns_db:
            db.close()

    return {
        "tiles_completed": tiles_completed,
        "total_fetched": total_fetched,
        "total_inserted": total_inserted,
    }


def main() -> None:
    _configure_logging()

    parser = argparse.ArgumentParser(description="Import OSM POIs via Overpass API")
    parser.add_argument("--sw_lat", type=float, default=USA_SW_LAT)
    parser.add_argument("--sw_lng", type=float, default=USA_SW_LNG)
    parser.add_argument("--ne_lat", type=float, default=USA_NE_LAT)
    parser.add_argument("--ne_lng", type=float, default=USA_NE_LNG)
    parser.add_argument(
        "--start-tile",
        type=int,
        default=1,
        help="Resume from this 1-based tile index (default: 1)",
    )
    args = parser.parse_args()

    acquire_etl_lock()
    try:
        logger.info(
            "Starting OSM ETL bbox=(%s,%s,%s,%s) start_tile=%d",
            args.sw_lat,
            args.sw_lng,
            args.ne_lat,
            args.ne_lng,
            args.start_tile,
        )
        stats = run_etl(
            args.sw_lat,
            args.sw_lng,
            args.ne_lat,
            args.ne_lng,
            start_tile=args.start_tile,
        )
        logger.info(
            "OSM ETL complete — tiles=%d fetched=%d inserted=%d",
            stats["tiles_completed"],
            stats["total_fetched"],
            stats["total_inserted"],
        )
    finally:
        release_etl_lock()


if __name__ == "__main__":
    main()
