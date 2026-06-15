"""
One-time cleanup — fix mis-mapped OSM place categories and remove duplicates.

Usage:
    python -m app.scripts.fix_category_mapping
"""
from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import SessionLocal

logger = logging.getLogger(__name__)

FIX_STATEMENTS: list[tuple[str, str]] = [
    (
        "entertainment_amenity",
        """
        UPDATE places SET category = 'entertainment'
        WHERE tags->>'amenity' IN ('theatre', 'arts_centre', 'cinema')
        """,
    ),
    (
        "gaming_amenity",
        """
        UPDATE places SET category = 'gaming'
        WHERE tags->>'amenity' IN ('bowling_alley', 'arcade', 'amusement_arcade')
        """,
    ),
    (
        "landmark_tourism",
        """
        UPDATE places SET category = 'landmark'
        WHERE tags->>'tourism' IN ('attraction', 'museum', 'gallery', 'zoo')
        """,
    ),
    (
        "amusement_tourism",
        """
        UPDATE places SET category = 'amusement'
        WHERE tags->>'tourism' = 'theme_park'
        """,
    ),
    (
        "photo_spot_tourism",
        """
        UPDATE places SET category = 'photo_spot'
        WHERE tags->>'tourism' IN ('viewpoint', 'artwork')
        """,
    ),
    (
        "shopping_shop",
        """
        UPDATE places SET category = 'shopping'
        WHERE tags->>'shop' IN ('mall', 'department_store', 'marketplace', 'supermarket')
        """,
    ),
    (
        "delete_playgrounds",
        """
        DELETE FROM places
        WHERE tags->>'leisure' = 'playground'
        """,
    ),
    (
        "dedupe_osm_id",
        """
        DELETE FROM places a USING places b
        WHERE a.id > b.id AND a.osm_id = b.osm_id
        """,
    ),
]


def _rowcount(result: object) -> int:
    rowcount = getattr(result, "rowcount", None)
    return int(rowcount) if rowcount is not None and rowcount >= 0 else 0


def run_fixes(db: Session) -> dict[str, int]:
    """Apply category cleanup SQL and return affected row counts."""
    db.execute(text("SET statement_timeout = '300s'"))
    counts: dict[str, int] = {}
    for name, sql in FIX_STATEMENTS:
        result = db.execute(text(sql))
        counts[name] = _rowcount(result)
        db.commit()
        logger.info("%s: %d rows affected", name, counts[name])
    return counts


def print_category_counts(db: Session) -> dict[str, int]:
    """Print and return places grouped by category."""
    rows = db.execute(
        text(
            """
            SELECT category, COUNT(*) AS count
            FROM places
            GROUP BY category
            ORDER BY category
            """
        )
    ).mappings().all()

    counts = {row["category"] or "(null)": int(row["count"]) for row in rows}
    logger.info("Category counts after fix:")
    for category, count in counts.items():
        logger.info("  %s: %d", category, count)
    return counts


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    db = SessionLocal()
    try:
        logger.info("Starting category mapping cleanup")
        fix_counts = run_fixes(db)
        category_counts = print_category_counts(db)
        total = sum(category_counts.values())
        logger.info(
            "Cleanup complete — fixes=%s total_places=%d",
            fix_counts,
            total,
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
