"""Count places rows with incomplete address JSONB."""
from sqlalchemy import text

from app.scripts.osm_etl import create_etl_session

TOTAL_SQL = text("SELECT COUNT(*) FROM places")

# No usable address fields — only default country or all null/empty.
INCOMPLETE_SQL = text(
    """
    SELECT COUNT(*) FROM places
    WHERE address IS NULL
       OR (
            COALESCE(NULLIF(TRIM(address->>'street'), ''), NULL) IS NULL
        AND COALESCE(NULLIF(TRIM(address->>'city'), ''), NULL) IS NULL
        AND COALESCE(NULLIF(TRIM(address->>'state'), ''), NULL) IS NULL
        AND COALESCE(NULLIF(TRIM(address->>'postcode'), ''), NULL) IS NULL
       )
    """
)

# Has at least one meaningful address field.
COMPLETE_SQL = text(
    """
    SELECT COUNT(*) FROM places
    WHERE address IS NOT NULL
      AND (
            COALESCE(NULLIF(TRIM(address->>'street'), ''), NULL) IS NOT NULL
         OR COALESCE(NULLIF(TRIM(address->>'city'), ''), NULL) IS NOT NULL
         OR COALESCE(NULLIF(TRIM(address->>'state'), ''), NULL) IS NOT NULL
         OR COALESCE(NULLIF(TRIM(address->>'postcode'), ''), NULL) IS NOT NULL
      )
    """
)

BREAKDOWN_SQL = text(
    """
    SELECT
        SUM(CASE WHEN address IS NULL THEN 1 ELSE 0 END) AS null_address,
        SUM(CASE WHEN COALESCE(NULLIF(TRIM(address->>'street'), ''), NULL) IS NULL THEN 1 ELSE 0 END) AS missing_street,
        SUM(CASE WHEN COALESCE(NULLIF(TRIM(address->>'city'), ''), NULL) IS NULL THEN 1 ELSE 0 END) AS missing_city,
        SUM(CASE WHEN COALESCE(NULLIF(TRIM(address->>'state'), ''), NULL) IS NULL THEN 1 ELSE 0 END) AS missing_state,
        SUM(CASE WHEN COALESCE(NULLIF(TRIM(address->>'postcode'), ''), NULL) IS NULL THEN 1 ELSE 0 END) AS missing_postcode
    FROM places
    """
)


def main() -> None:
    db = create_etl_session()
    try:
        total = db.execute(TOTAL_SQL).scalar()
        incomplete = db.execute(INCOMPLETE_SQL).scalar()
        complete = db.execute(COMPLETE_SQL).scalar()
        breakdown = db.execute(BREAKDOWN_SQL).mappings().one()

        pct = (incomplete / total * 100) if total else 0
        print(f"total rows: {total:,}")
        print(f"incomplete address (no street/city/state/postcode): {incomplete:,} ({pct:.1f}%)")
        print(f"has some address detail: {complete:,} ({100 - pct:.1f}%)")
        print("field missing counts:")
        print(f"  null address JSON: {breakdown['null_address']:,}")
        print(f"  missing street: {breakdown['missing_street']:,}")
        print(f"  missing city: {breakdown['missing_city']:,}")
        print(f"  missing state: {breakdown['missing_state']:,}")
        print(f"  missing postcode: {breakdown['missing_postcode']:,}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
