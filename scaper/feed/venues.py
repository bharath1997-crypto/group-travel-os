"""Batch venue matching for feed staging (place_links + tiered matcher)."""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Connection

from scaper.models import VenueRecord


def count_unlinked_staging_venues(conn: Connection) -> int:
    return int(
        conn.execute(
            text(
                """
                SELECT count(DISTINCT venue_id) FROM ingest.tm_feed_staging
                WHERE venue_id IS NOT NULL
                  AND NOT EXISTS (
                    SELECT 1 FROM ingest.place_links pl
                    WHERE pl.connector = 'ticketmaster' AND pl.external_id = venue_id
                  )
                """
            )
        ).scalar()
        or 0
    )


def match_staging_venues(
    conn: Connection,
    store,
    *,
    batch_size: int = 500,
    dry_run: bool = False,
) -> int:
    """
    Link distinct staging venues lacking place_links.
    Dry-run: no writes — returns count of venues that would be matched.
    """
    if dry_run:
        return count_unlinked_staging_venues(conn)

    rows = conn.execute(
        text(
            """
            SELECT DISTINCT ON (venue_id)
              venue_id, venue_name, lat, lng, venue_street, venue_city, venue_state,
              venue_zip, country_code, city_slug
            FROM ingest.tm_feed_staging
            WHERE venue_id IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM ingest.place_links pl
                WHERE pl.connector = 'ticketmaster' AND pl.external_id = venue_id
              )
            ORDER BY venue_id
            """
        )
    ).mappings().all()
    matched = 0
    resolve = getattr(store, "resolve_place_connection", None)
    if resolve is None:
        raise RuntimeError("store must implement resolve_place_connection for feed loads")
    for i in range(0, len(rows), batch_size):
        for row in rows[i : i + batch_size]:
            venue = VenueRecord(
                external_id=str(row["venue_id"]),
                name=row["venue_name"],
                lat=float(row["lat"]),
                lng=float(row["lng"]),
                freeform=row["venue_street"],
                locality=row["venue_city"],
                region=row["venue_state"],
                postcode=row["venue_zip"],
                country=row["country_code"],
            )
            resolve(conn, "ticketmaster", venue, row["city_slug"])
            matched += 1
    return matched
