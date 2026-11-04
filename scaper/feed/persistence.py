"""Postgres helpers for Ticketmaster bulk feed loads."""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from sqlalchemy import Connection, text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

EXPIRY_DROP_FRACTION = 0.30


def provider_enabled(conn: Connection, provider: str) -> bool:
    row = conn.execute(
        text("SELECT enabled FROM ingest.provider_registry WHERE provider = :p"),
        {"p": provider},
    ).scalar()
    return bool(row)


def get_feed_state(conn: Connection, provider: str, country: str) -> dict[str, Any] | None:
    row = conn.execute(
        text(
            """
            SELECT last_md5, last_updated, num_events, loaded_at, status
            FROM ingest.feed_state WHERE provider = :p AND country = :c
            """
        ),
        {"p": provider, "c": country.upper()},
    ).mappings().first()
    return dict(row) if row else None


def write_feed_state(
    conn: Connection,
    *,
    provider: str,
    country: str,
    last_md5: str | None,
    last_updated: datetime | None,
    num_events: int | None,
    status: str,
) -> None:
    conn.execute(
        text(
            """
            INSERT INTO ingest.feed_state (provider, country, last_md5, last_updated, num_events, loaded_at, status)
            VALUES (:p, :c, :md5, :lu, :n, now(), :st)
            ON CONFLICT (provider, country) DO UPDATE SET
              last_md5 = EXCLUDED.last_md5,
              last_updated = EXCLUDED.last_updated,
              num_events = EXCLUDED.num_events,
              loaded_at = EXCLUDED.loaded_at,
              status = EXCLUDED.status
            """
        ),
        {
            "p": provider,
            "c": country.upper(),
            "md5": last_md5,
            "lu": last_updated,
            "n": num_events,
            "st": status,
        },
    )


def truncate_staging(conn: Connection) -> None:
    conn.execute(text("TRUNCATE ingest.tm_feed_staging"))


def insert_staging_batch(conn: Connection, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    conn.execute(
        text(
            """
            INSERT INTO ingest.tm_feed_staging (
              event_id, legacy_id, title, description, category, start_time, end_time, timezone,
              status, url, image_url, venue_id, venue_name, venue_street, venue_city,
              venue_state, venue_zip, country_code, lat, lng, city_slug
            ) VALUES (
              :event_id, :legacy_id, :title, :description, :category, :start_time, :end_time, :timezone,
              :status, :url, :image_url, :venue_id, :venue_name, :venue_street, :venue_city,
              :venue_state, :venue_zip, :country_code, :lat, :lng, :city_slug
            )
            """
        ),
        rows,
    )


def upsert_events_from_staging(
    conn: Connection,
    *,
    source_id: Any,
    country_code: str,
    horizon_cutoff: datetime,
) -> tuple[int, int]:
    """Set-based upsert from staging; returns (inserted, updated) counts."""
    result = conn.execute(
        text(
            """
            WITH raw_staged AS (
              SELECT s.*
              FROM ingest.tm_feed_staging s
              WHERE s.country_code = :cc
                AND s.start_time <= :horizon
            ),
            staged AS (
              SELECT DISTINCT ON (rs.event_id)
                rs.*,
                pl.place_id,
                COALESCE(rs.end_time, rs.start_time + interval '6 hours') AS expires_at
              FROM raw_staged rs
              LEFT JOIN LATERAL (
                SELECT place_id
                FROM ingest.place_links
                WHERE connector = 'ticketmaster' AND external_id = rs.venue_id
                LIMIT 1
              ) pl ON true
              ORDER BY rs.event_id, rs.start_time DESC NULLS LAST
            ),
            upserted AS (
              INSERT INTO public.events (
                id, provider, external_id, title, description, category,
                start_time, end_time, timezone, status, is_free,
                price_min, price_max, currency, ticket_url, image_url,
                venue_name, venue_place_id, lat, lng, geom, city_slug, state_code, country_code,
                source_id, raw_record_id, fetched_at, expires_at,
                first_seen_at, last_seen_at, updated_at
              )
              SELECT
                gen_random_uuid(), 'ticketmaster', event_id, title, description, category,
                start_time, end_time, timezone, status, NULL,
                NULL, NULL, NULL, url, image_url,
                venue_name, place_id, lat, lng,
                ST_SetSRID(ST_MakePoint(lng, lat), 4326),
                city_slug,
                venue_state, country_code,
                :source_id, NULL, now(), expires_at,
                now(), now(), now()
              FROM staged
              ON CONFLICT (provider, external_id) DO UPDATE SET
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                category = EXCLUDED.category,
                start_time = EXCLUDED.start_time,
                end_time = EXCLUDED.end_time,
                timezone = EXCLUDED.timezone,
                status = EXCLUDED.status,
                ticket_url = EXCLUDED.ticket_url,
                image_url = EXCLUDED.image_url,
                venue_name = EXCLUDED.venue_name,
                venue_place_id = EXCLUDED.venue_place_id,
                lat = EXCLUDED.lat,
                lng = EXCLUDED.lng,
                geom = EXCLUDED.geom,
                city_slug = EXCLUDED.city_slug,
                state_code = EXCLUDED.state_code,
                country_code = EXCLUDED.country_code,
                source_id = EXCLUDED.source_id,
                fetched_at = now(),
                expires_at = EXCLUDED.expires_at,
                last_seen_at = now(),
                updated_at = now()
              WHERE (
                public.events.title, public.events.description, public.events.category,
                public.events.start_time, public.events.end_time, public.events.timezone,
                public.events.status, public.events.ticket_url, public.events.image_url,
                public.events.venue_name, public.events.venue_place_id, public.events.lat,
                public.events.lng, public.events.city_slug, public.events.state_code,
                public.events.country_code, public.events.expires_at
              ) IS DISTINCT FROM (
                EXCLUDED.title, EXCLUDED.description, EXCLUDED.category,
                EXCLUDED.start_time, EXCLUDED.end_time, EXCLUDED.timezone,
                EXCLUDED.status, EXCLUDED.ticket_url, EXCLUDED.image_url,
                EXCLUDED.venue_name, EXCLUDED.venue_place_id, EXCLUDED.lat,
                EXCLUDED.lng, EXCLUDED.city_slug, EXCLUDED.state_code,
                EXCLUDED.country_code, EXCLUDED.expires_at
              )
              RETURNING (xmax = 0) AS inserted
            )
            SELECT
              COALESCE(sum(CASE WHEN inserted THEN 1 ELSE 0 END), 0)::int AS ins,
              COALESCE(sum(CASE WHEN inserted THEN 0 ELSE 1 END), 0)::int AS upd
            FROM upserted
            """
        ),
        {"source_id": source_id, "cc": country_code.upper(), "horizon": horizon_cutoff},
    ).one()
    return int(result.ins or 0), int(result.upd or 0)


def expire_unseen_for_country(
    conn: Connection,
    *,
    country_code: str,
    run_started: datetime,
    staged_count: int,
    previous_count: int | None,
) -> tuple[int, bool]:
    """
    Expire ticketmaster rows for this country not seen in staging.
    Returns (expired_count, guard_triggered).
    """
    if previous_count and staged_count < previous_count * (1 - EXPIRY_DROP_FRACTION):
        logger.warning(
            "feed expiry guard: staged %d vs previous %d for %s — skipping expiry",
            staged_count,
            previous_count,
            country_code,
        )
        return 0, True
    result = conn.execute(
        text(
            """
            UPDATE public.events e
            SET expires_at = now(), updated_at = now()
            WHERE e.provider = 'ticketmaster'
              AND e.country_code = :cc
              AND e.last_seen_at < :run_started
              AND COALESCE(e.expires_at, 'infinity'::timestamptz) > now()
              AND NOT EXISTS (
                SELECT 1 FROM ingest.tm_feed_staging s
                WHERE s.event_id = e.external_id AND s.country_code = :cc
              )
            """
        ),
        {"cc": country_code.upper(), "run_started": run_started},
    )
    return result.rowcount or 0, False


def feed_fresh_within_hours(engine: Engine, country: str, *, hours: float = 26.0) -> bool:
    """False when no fresh feed load exists, or when migration 019 is not applied yet.

    run-due calls this for every Ticketmaster source; a missing ingest.feed_state must
    never stop the Discovery API sources (it did on 2026-11-02 to 2026-11-04).
    """
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text(
                    """
                    SELECT 1 FROM ingest.feed_state
                    WHERE provider = 'ticketmaster_feed' AND country = :c
                      AND status IN ('succeeded', 'partial', 'unchanged')
                      AND loaded_at > now() - make_interval(hours => CAST(:h AS double precision))
                    """
                ),
                {"c": country.upper(), "h": hours},
            ).scalar()
    except Exception:
        logger.warning("ingest.feed_state unavailable (apply migrations/019_tm_feed.sql); treating the feed as not fresh")
        return False
    return row is not None
