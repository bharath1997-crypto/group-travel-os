"""Shared DB helpers for the Overture places data-spine scripts."""
from __future__ import annotations

import re
import sys
from pathlib import Path

import psycopg2
from psycopg2.extensions import connection as PgConnection

ROOT = Path(__file__).resolve().parents[1]


def _import_settings():
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    from config import settings

    return settings


def normalize_database_url(url: str) -> str:
    """Use Supabase session pooler (5432) instead of transaction pooler (6543)."""
    match = re.match(
        r"^(postgres(?:ql)?://[^?]+:)(6543)(/.*)$",
        url,
    )
    if match and "pooler.supabase.com" in url:
        return f"{match.group(1)}5432{match.group(3)}"
    return url


def connect() -> PgConnection:
    settings = _import_settings()
    url = normalize_database_url(settings.DATABASE_URL)
    kwargs: dict = {"dsn": url}
    if "supabase.com" in url:
        kwargs["sslmode"] = "require"
    return psycopg2.connect(**kwargs)


def resync_places(conn: PgConnection, staging_path: Path, *, commit: bool = True) -> int:
    """
    Monthly Overture refresh (data-spine §2 Stage 3).

    Updates only name, geog, and confidence for rows joined on gers_id.
    Hand-enriched columns are never touched.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TEMP TABLE places_resync_staging (
              gers_id     text,
              name        text,
              lon         double precision,
              lat         double precision,
              confidence  real
            ) ON COMMIT DROP
            """
        )
        copy_sql = """
            COPY places_resync_staging (gers_id, name, lon, lat, confidence)
            FROM STDIN WITH (FORMAT CSV, HEADER TRUE, NULL '')
        """
        with staging_path.open("r", encoding="utf-8") as fh:
            cur.copy_expert(copy_sql, fh)

        cur.execute(
            """
            UPDATE places p SET
              name = s.name,
              geog = ST_SetSRID(ST_MakePoint(s.lon, s.lat), 4326)::geography,
              confidence = LEAST(s.confidence, 1.0)
            FROM places_resync_staging s
            WHERE p.gers_id = s.gers_id
            """
        )
        updated = cur.rowcount

    if commit:
        conn.commit()
    return updated
