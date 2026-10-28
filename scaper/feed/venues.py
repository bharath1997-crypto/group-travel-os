"""Batch venue matching for feed staging (place_links + tiered matcher)."""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Connection

from scaper.models import VenueRecord


def match_staging_venues(conn: Connection, store, *, batch_size: int = 500) -> int:
    """Link distinct staging venues lacking place_links; returns venues processed."""
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
            store.resolve_place("ticketmaster", venue, row["city_slug"])
            matched += 1
    return matched
