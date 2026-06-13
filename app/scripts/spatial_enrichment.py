"""
Spatial address enrichment for the places table using TIGER/Line boundaries.

Usage:
    python -m app.scripts.spatial_enrichment
    python -m app.scripts.spatial_enrichment --stage 1
    python -m app.scripts.spatial_enrichment --dry-run
    python -m app.scripts.spatial_enrichment --stage 5 --batch-size 500
"""
from __future__ import annotations

import argparse
import logging
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import SessionLocal

logger = logging.getLogger(__name__)

STAGE_1_STATE_SQL = text("""
UPDATE places p
SET
  address = jsonb_set(COALESCE(p.address, '{}'::jsonb), '{state}', to_jsonb(s.stusps)),
  state_source = 'tiger_state',
  geocode_confidence = 'high',
  geocode_updated_at = NOW()
FROM tiger_states s
WHERE s.stusps = :scope
  AND p.address->>'state' IS NULL
  AND p.geom IS NOT NULL
  AND ST_Intersects(s.geom, p.geom)
  AND ST_Contains(s.geom, p.geom)
""")

STAGE_1_UPDATE_SQL = text("""
UPDATE places p
SET
  address = jsonb_set(COALESCE(p.address, '{}'::jsonb), '{state}', to_jsonb(s.stusps)),
  state_source = 'tiger_state',
  geocode_confidence = 'high',
  geocode_updated_at = NOW()
FROM tiger_states s
WHERE p.address->>'state' IS NULL
  AND p.geom IS NOT NULL
  AND ST_Intersects(s.geom, p.geom)
  AND ST_Contains(s.geom, p.geom)
""")

STAGE_1_COUNT_SQL = text("""
SELECT COUNT(*) AS n
FROM places p
JOIN tiger_states s ON ST_Intersects(s.geom, p.geom) AND ST_Contains(s.geom, p.geom)
WHERE p.address->>'state' IS NULL
  AND p.geom IS NOT NULL
""")

STAGE_2_STATE_SQL = text("""
UPDATE places p
SET
  address = jsonb_set(COALESCE(p.address, '{}'::jsonb), '{city}', to_jsonb(pl.name)),
  city_source = 'tiger_place',
  geocode_confidence = 'high',
  geocode_updated_at = NOW()
FROM tiger_places pl
WHERE pl.statefp = :scope
  AND p.address->>'city' IS NULL
  AND p.geom IS NOT NULL
  AND ST_Intersects(pl.geom, p.geom)
  AND ST_Contains(pl.geom, p.geom)
""")

STAGE_2_UPDATE_SQL = text("""
UPDATE places p
SET
  address = jsonb_set(COALESCE(p.address, '{}'::jsonb), '{city}', to_jsonb(pl.name)),
  city_source = 'tiger_place',
  geocode_confidence = 'high',
  geocode_updated_at = NOW()
FROM tiger_places pl
WHERE p.address->>'city' IS NULL
  AND p.geom IS NOT NULL
  AND ST_Intersects(pl.geom, p.geom)
  AND ST_Contains(pl.geom, p.geom)
""")

STAGE_2_COUNT_SQL = text("""
SELECT COUNT(*) AS n
FROM places p
JOIN tiger_places pl ON ST_Intersects(pl.geom, p.geom) AND ST_Contains(pl.geom, p.geom)
WHERE p.address->>'city' IS NULL
  AND p.geom IS NOT NULL
""")

STAGE_3_BATCH_SQL = text("""
WITH batch AS (
  SELECT id
  FROM places
  WHERE address->>'postcode' IS NULL
    AND geom IS NOT NULL
  LIMIT :batch_size
)
UPDATE places p
SET
  address = jsonb_set(COALESCE(p.address, '{}'::jsonb), '{postcode}', to_jsonb(z.zcta5ce20)),
  postcode_source = 'census_zcta_approx',
  geocode_updated_at = NOW()
FROM tiger_zcta z, batch b
WHERE p.id = b.id
  AND ST_Intersects(z.geom, p.geom)
  AND ST_Contains(z.geom, p.geom)
""")

STAGE_3_UPDATE_SQL = text("""
UPDATE places p
SET
  address = jsonb_set(COALESCE(p.address, '{}'::jsonb), '{postcode}', to_jsonb(z.zcta5ce20)),
  postcode_source = 'census_zcta_approx',
  geocode_updated_at = NOW()
FROM tiger_zcta z
WHERE p.address->>'postcode' IS NULL
  AND p.geom IS NOT NULL
  AND ST_Intersects(z.geom, p.geom)
  AND ST_Contains(z.geom, p.geom)
""")

STAGE_3_COUNT_SQL = text("""
SELECT COUNT(*) AS n
FROM places p
JOIN tiger_zcta z ON ST_Intersects(z.geom, p.geom) AND ST_Contains(z.geom, p.geom)
WHERE p.address->>'postcode' IS NULL
  AND p.geom IS NOT NULL
""")

STAGE_4_STATE_SQL = text("""
UPDATE places p
SET
  address = jsonb_set(COALESCE(p.address, '{}'::jsonb), '{city}', to_jsonb(cs.name)),
  city_source = 'county_subdivision',
  geocode_confidence = 'medium',
  geocode_updated_at = NOW()
FROM tiger_cousub cs
WHERE cs.statefp = :scope
  AND p.address->>'city' IS NULL
  AND p.geom IS NOT NULL
  AND ST_Intersects(cs.geom, p.geom)
  AND ST_Contains(cs.geom, p.geom)
""")

STAGE_4_UPDATE_SQL = text("""
UPDATE places p
SET
  address = jsonb_set(COALESCE(p.address, '{}'::jsonb), '{city}', to_jsonb(cs.name)),
  city_source = 'county_subdivision',
  geocode_confidence = 'medium',
  geocode_updated_at = NOW()
FROM tiger_cousub cs
WHERE p.address->>'city' IS NULL
  AND p.geom IS NOT NULL
  AND ST_Intersects(cs.geom, p.geom)
  AND ST_Contains(cs.geom, p.geom)
""")

STAGE_4_COUNT_SQL = text("""
SELECT COUNT(*) AS n
FROM places p
JOIN tiger_cousub cs ON ST_Intersects(cs.geom, p.geom) AND ST_Contains(cs.geom, p.geom)
WHERE p.address->>'city' IS NULL
  AND p.geom IS NOT NULL
""")

FETCH_NULL_CITY_SQL = text("""
SELECT id, lat, lng FROM places
WHERE address->>'city' IS NULL
  AND lat IS NOT NULL
  AND lng IS NOT NULL
""")

STAGE_5_UPDATE_SQL = text("""
UPDATE places SET
  address = jsonb_set(COALESCE(address, '{}'::jsonb), '{city}', to_jsonb(:city::text)),
  city_source = 'reverse_geocoder_fallback',
  geocode_confidence = 'low',
  geocode_updated_at = NOW()
WHERE id = :id AND address->>'city' IS NULL
""")

SUMMARY_SQL = text("""
SELECT city_source, COUNT(*) AS n
FROM places
GROUP BY city_source
ORDER BY n DESC
""")


def _configure_session(db: Session) -> None:
    """Allow long-running spatial UPDATE statements on Supabase/Postgres."""
    if db.bind is not None and db.bind.dialect.name != "sqlite":
        db.execute(text("SET statement_timeout = '900s'"))
        db.commit()


STATE_SCOPES_SQL = text("SELECT DISTINCT stusps AS scope FROM tiger_states ORDER BY scope")
STATEFP_SCOPES_SQL = text("SELECT DISTINCT statefp AS scope FROM tiger_places ORDER BY scope")
COUSUB_SCOPES_SQL = text("SELECT DISTINCT statefp AS scope FROM tiger_cousub ORDER BY scope")

SPATIAL_BATCH_SIZE = 5000


def _execute_count(db: Session, sql: Any) -> int:
    result = db.execute(sql).scalar_one()
    return int(result or 0)


def _run_scoped_updates(
    db: Session,
    *,
    scopes_sql: Any,
    update_sql: Any,
) -> int:
    scopes = [row.scope for row in db.execute(scopes_sql).fetchall()]
    total = 0
    for scope in scopes:
        result = db.execute(update_sql, {"scope": scope})
        db.commit()
        batch_count = int(result.rowcount or 0)
        total += batch_count
        if batch_count:
            logger.info("  scope=%s updated=%d", scope, batch_count)
    return total


def run_stage_1(db: Session, *, dry_run: bool = False) -> int:
    if dry_run:
        count = _execute_count(db, STAGE_1_COUNT_SQL)
        logger.info("Stage 1 dry-run: %d rows would be updated with state", count)
        return count

    count = _run_scoped_updates(
        db,
        scopes_sql=STATE_SCOPES_SQL,
        update_sql=STAGE_1_STATE_SQL,
    )
    logger.info("Stage 1 complete: %d rows updated with state", count)
    return count


def run_stage_2(db: Session, *, dry_run: bool = False) -> int:
    if dry_run:
        count = _execute_count(db, STAGE_2_COUNT_SQL)
        logger.info("Stage 2 dry-run: %d rows would be updated with city", count)
        return count

    count = _run_scoped_updates(
        db,
        scopes_sql=STATEFP_SCOPES_SQL,
        update_sql=STAGE_2_STATE_SQL,
    )
    logger.info("Stage 2 complete: %d rows updated with city", count)
    return count


def run_stage_3(db: Session, *, dry_run: bool = False, batch_size: int = SPATIAL_BATCH_SIZE) -> int:
    if dry_run:
        count = _execute_count(db, STAGE_3_COUNT_SQL)
        logger.info("Stage 3 dry-run: %d rows would be updated with postcode", count)
        return count

    total = 0
    while True:
        result = db.execute(STAGE_3_BATCH_SQL, {"batch_size": batch_size})
        db.commit()
        batch_count = int(result.rowcount or 0)
        if batch_count == 0:
            break
        total += batch_count
        logger.info("Stage 3 batch: %d rows updated (%d total)", batch_count, total)

    logger.info("Stage 3 complete: %d rows updated with postcode", total)
    return total


def run_stage_4(db: Session, *, dry_run: bool = False) -> int:
    if dry_run:
        count = _execute_count(db, STAGE_4_COUNT_SQL)
        logger.info(
            "Stage 4 dry-run: %d rows would be updated with county subdivision",
            count,
        )
        return count

    count = _run_scoped_updates(
        db,
        scopes_sql=COUSUB_SCOPES_SQL,
        update_sql=STAGE_4_STATE_SQL,
    )
    logger.info("Stage 4 complete: %d rows updated with county subdivision", count)
    return count


def run_stage_5(
    db: Session,
    *,
    batch_size: int = 1000,
    dry_run: bool = False,
) -> int:
    rows = db.execute(FETCH_NULL_CITY_SQL).fetchall()
    if not rows:
        logger.info("Stage 5 complete: 0 rows updated via reverse_geocoder")
        return 0

    if dry_run:
        logger.info(
            "Stage 5 dry-run: %d rows would be updated via reverse_geocoder",
            len(rows),
        )
        return len(rows)

    import reverse_geocoder as rg

    coords = [(float(row.lat), float(row.lng)) for row in rows]
    results = rg.search(coords)

    updated = 0
    for index, (row, result) in enumerate(zip(rows, results, strict=True)):
        db.execute(
            STAGE_5_UPDATE_SQL,
            {"city": result["name"], "id": str(row.id)},
        )
        updated += 1
        if index > 0 and index % batch_size == 0:
            db.commit()
            logger.info("Stage 5: %d/%d rows processed", index, len(rows))

    db.commit()
    logger.info("Stage 5 complete: %d rows updated via reverse_geocoder", updated)
    return updated


def log_city_source_summary(db: Session) -> None:
    rows = db.execute(SUMMARY_SQL).fetchall()
    logger.info("City source summary:")
    for row in rows:
        logger.info("  %s: %s", row.city_source, row.n)


def run_enrichment(
    db: Session,
    *,
    stage: str = "all",
    dry_run: bool = False,
    batch_size: int = 1000,
) -> dict[str, int]:
    """Run one or all spatial enrichment stages."""
    stage_runners = {
        "1": lambda: run_stage_1(db, dry_run=dry_run),
        "2": lambda: run_stage_2(db, dry_run=dry_run),
        "3": lambda: run_stage_3(db, dry_run=dry_run, batch_size=batch_size),
        "4": lambda: run_stage_4(db, dry_run=dry_run),
        "5": lambda: run_stage_5(db, batch_size=batch_size, dry_run=dry_run),
    }

    if stage == "all":
        selected = ["1", "2", "3", "4", "5"]
    else:
        selected = [stage]

    counts: dict[str, int] = {}
    for stage_id in selected:
        if stage_id not in stage_runners:
            raise ValueError(f"Invalid stage: {stage_id}")
        counts[f"stage_{stage_id}"] = stage_runners[stage_id]()

    if not dry_run:
        log_city_source_summary(db)

    return counts


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    parser = argparse.ArgumentParser(
        description="Fill missing city/state/postcode on places using TIGER boundaries"
    )
    parser.add_argument(
        "--stage",
        choices=["1", "2", "3", "4", "5", "all"],
        default="all",
        help="Run a specific stage (default: all)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print counts without writing to the database",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=1000,
        help="Commit interval for stage 5 (default: 1000)",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        _configure_session(db)
        logger.info(
            "Starting spatial enrichment stage=%s dry_run=%s batch_size=%d",
            args.stage,
            args.dry_run,
            args.batch_size,
        )
        counts = run_enrichment(
            db,
            stage=args.stage,
            dry_run=args.dry_run,
            batch_size=args.batch_size,
        )
        logger.info("Spatial enrichment complete: %s", counts)
    finally:
        db.close()


if __name__ == "__main__":
    main()
