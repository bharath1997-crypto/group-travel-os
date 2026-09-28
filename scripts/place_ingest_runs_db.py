"""Record Overture ingest runs from spine scripts (psycopg2)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable

from psycopg2.extensions import connection as PgConnection

DATASET_OVERTURE = "overture_places"


class IngestRunError(RuntimeError):
    """Ingest run state could not be updated as expected."""


class IngestAlreadySucceeded(IngestRunError):
    def __init__(self, run_id: str) -> None:
        super().__init__(f"ingest already succeeded for scope (run_id={run_id})")
        self.run_id = run_id


class IngestRunInProgress(IngestRunError):
    pass


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _scope_region(region_key: str | None) -> str:
    return (region_key or "").strip()


def _scope_city(city_slug: str | None) -> str:
    return (city_slug or "").strip()


def _fetch_scope_row(
    conn: PgConnection,
    *,
    release_id: str,
    region_key: str | None,
    city_slug: str | None,
    schema_version: str,
) -> tuple[str, str] | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id::text, status
            FROM place_ingest_runs
            WHERE dataset = %s
              AND release_id = %s
              AND COALESCE(region_key, '') = %s
              AND COALESCE(city_slug, '') = %s
              AND schema_version = %s
            ORDER BY started_at DESC
            LIMIT 1
            """,
            (
                DATASET_OVERTURE,
                release_id,
                _scope_region(region_key),
                _scope_city(city_slug),
                schema_version,
            ),
        )
        row = cur.fetchone()
    if not row:
        return None
    return str(row[0]), str(row[1])


def begin_ingest_run(
    conn: PgConnection,
    *,
    release_id: str,
    region_key: str | None = None,
    city_slug: str | None = None,
    schema_version: str = "1",
    artifact_key: str | None = None,
    artifact_sha256: str | None = None,
) -> tuple[str, str]:
    """
    Start or restart an ingest run for a release/scope.
    Returns (run_id, mode) where mode is new|restarted.
    Raises IngestAlreadySucceeded or IngestRunInProgress when load must not proceed.
    """
    existing = _fetch_scope_row(
        conn,
        release_id=release_id,
        region_key=region_key,
        city_slug=city_slug,
        schema_version=schema_version,
    )
    if existing:
        run_id, status = existing
        if status == "succeeded":
            raise IngestAlreadySucceeded(run_id)
        if status == "running":
            raise IngestRunInProgress(f"ingest already running (run_id={run_id})")
        if status == "failed":
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE place_ingest_runs
                    SET status = 'running',
                        started_at = %s,
                        completed_at = NULL,
                        row_count = NULL,
                        error_summary = NULL,
                        artifact_key = COALESCE(%s, artifact_key),
                        artifact_sha256 = COALESCE(%s, artifact_sha256)
                    WHERE id = %s::uuid AND status = 'failed'
                    """,
                    (_utcnow(), artifact_key, artifact_sha256, run_id),
                )
                if cur.rowcount != 1:
                    raise IngestRunError("failed to restart ingest run")
            conn.commit()
            return run_id, "restarted"

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO place_ingest_runs (
              dataset, release_id, region_key, city_slug, schema_version,
              status, started_at, artifact_key, artifact_sha256
            )
            VALUES (%s, %s, %s, %s, %s, 'running', %s, %s, %s)
            RETURNING id::text
            """,
            (
                DATASET_OVERTURE,
                release_id,
                region_key,
                city_slug,
                schema_version,
                _utcnow(),
                artifact_key,
                artifact_sha256,
            ),
        )
        run_id = cur.fetchone()[0]
    conn.commit()
    return str(run_id), "new"


def replace_run_cities(conn: PgConnection, run_id: str, city_slugs: Iterable[str]) -> None:
    slugs = sorted({s.strip().lower() for s in city_slugs if s and str(s).strip()})
    with conn.cursor() as cur:
        cur.execute("DELETE FROM place_ingest_run_cities WHERE run_id = %s::uuid", (run_id,))
        if slugs:
            cur.executemany(
                """
                INSERT INTO place_ingest_run_cities (run_id, city_slug)
                VALUES (%s::uuid, %s)
                ON CONFLICT DO NOTHING
                """,
                [(run_id, slug) for slug in slugs],
            )
    conn.commit()


def complete_ingest_run(
    conn: PgConnection,
    run_id: str,
    *,
    row_count: int,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE place_ingest_runs
            SET status = 'succeeded',
                completed_at = %s,
                row_count = %s,
                error_summary = NULL
            WHERE id = %s::uuid AND status = 'running'
            """,
            (_utcnow(), row_count, run_id),
        )
        if cur.rowcount != 1:
            raise IngestRunError(f"complete_ingest_run updated {cur.rowcount} rows, expected 1")
    conn.commit()


def fail_ingest_run(conn: PgConnection, run_id: str, *, error_summary: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE place_ingest_runs
            SET status = 'failed',
                completed_at = %s,
                error_summary = %s
            WHERE id = %s::uuid AND status = 'running'
            """,
            (_utcnow(), error_summary[:2000], run_id),
        )
        if cur.rowcount != 1:
            raise IngestRunError(f"fail_ingest_run updated {cur.rowcount} rows, expected 1")
    conn.commit()


def distinct_cities_for_staging_gers(conn: PgConnection, staging_path: str) -> list[str]:
    """City slugs for gers_id rows present in a resync staging CSV."""
    import csv

    gers_ids: list[str] = []
    with open(staging_path, encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            gid = (row.get("gers_id") or "").strip()
            if gid:
                gers_ids.append(gid)
    if not gers_ids:
        return []
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT city_slug
            FROM places
            WHERE gers_id = ANY(%s)
              AND city_slug IS NOT NULL
              AND city_slug <> ''
            ORDER BY 1
            """,
            (gers_ids,),
        )
        return [str(r[0]) for r in cur.fetchall()]
