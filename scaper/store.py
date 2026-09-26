"""Persistence for Scaper. The pipeline depends on the Store protocol only."""
from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Protocol

from sqlalchemy import Engine, text
from sqlalchemy.exc import IntegrityError

from scaper.models import EventRecord, RawItem, RunStats, RunStatus, Source, VenueRecord

# Venue -> places matching thresholds. Conservative: a wrong link attaches an
# event to the wrong venue, a missed link only creates a duplicate place row.
MATCH_RADIUS_M = 100.0
MATCH_MIN_SIMILARITY = 0.45
# Stale 'running' rows older than this are treated as crashed workers.
RUN_LEASE = "2 hours"


class RunInProgress(Exception):
    """Another worker holds the single-flight lease for this source."""


@dataclass(frozen=True)
class RunHandle:
    id: uuid.UUID
    started_at: datetime


class Store(Protocol):
    def get_source(self, name: str) -> Source | None: ...
    def due_sources(self) -> list[Source]: ...
    def start_run(self, source: Source) -> RunHandle: ...
    def finish_run(self, run: RunHandle, status: RunStatus, stats: RunStats, error: str | None) -> None: ...
    def upsert_raw(self, source: Source, run: RunHandle, connector: str, item: RawItem) -> tuple[int, bool]: ...
    def mark_raw(self, raw_id: int, status: Literal["extracted", "rejected", "failed"], error: str | None = None) -> None: ...
    def touch_event(self, connector: str, external_id: str) -> None: ...
    def resolve_place(self, connector: str, venue: VenueRecord, city_slug: str | None) -> uuid.UUID: ...
    def upsert_event(
        self, connector: str, source: Source, raw_id: int, event: EventRecord, place_id: uuid.UUID | None
    ) -> Literal["inserted", "updated"]: ...
    def expire_unseen(self, source: Source, run: RunHandle) -> int: ...
    def purge_past_events(self) -> int: ...


_SOURCE_COLUMNS = "id, connector, name, config, city_slug, enabled, interval_minutes, last_run_at"


class PostgresStore:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    # ── sources ──────────────────────────────────────────────────────────
    def add_source(
        self,
        *,
        connector: str,
        name: str,
        config: dict,
        city_slug: str | None,
        interval_minutes: int = 360,
    ) -> Source:
        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    f"""
                    INSERT INTO ingest.sources (connector, name, config, city_slug, interval_minutes)
                    VALUES (:connector, :name, CAST(:config AS jsonb), :city_slug, :interval_minutes)
                    ON CONFLICT (name) DO UPDATE SET
                      connector = EXCLUDED.connector,
                      config = EXCLUDED.config,
                      city_slug = EXCLUDED.city_slug,
                      interval_minutes = EXCLUDED.interval_minutes,
                      updated_at = now()
                    RETURNING {_SOURCE_COLUMNS}
                    """
                ),
                {
                    "connector": connector,
                    "name": name,
                    "config": json.dumps(config),
                    "city_slug": city_slug,
                    "interval_minutes": interval_minutes,
                },
            ).mappings().one()
        return Source.model_validate(dict(row))

    def get_source(self, name: str) -> Source | None:
        with self.engine.connect() as conn:
            row = conn.execute(
                text(f"SELECT {_SOURCE_COLUMNS} FROM ingest.sources WHERE name = :name"),
                {"name": name},
            ).mappings().first()
        return Source.model_validate(dict(row)) if row else None

    def list_sources(self) -> list[Source]:
        with self.engine.connect() as conn:
            rows = conn.execute(
                text(f"SELECT {_SOURCE_COLUMNS} FROM ingest.sources ORDER BY name")
            ).mappings().all()
        return [Source.model_validate(dict(r)) for r in rows]

    def due_sources(self) -> list[Source]:
        with self.engine.connect() as conn:
            rows = conn.execute(
                text(
                    f"""
                    SELECT {_SOURCE_COLUMNS} FROM ingest.sources
                    WHERE enabled
                      AND (last_run_at IS NULL
                           OR last_run_at < now() - make_interval(mins => interval_minutes))
                    ORDER BY last_run_at NULLS FIRST
                    """
                )
            ).mappings().all()
        return [Source.model_validate(dict(r)) for r in rows]

    # ── runs ─────────────────────────────────────────────────────────────
    def start_run(self, source: Source) -> RunHandle:
        try:
            with self.engine.begin() as conn:
                conn.execute(
                    text(
                        f"""
                        UPDATE ingest.runs
                        SET status = 'failed', finished_at = now(),
                            error_summary = 'abandoned: lease expired'
                        WHERE source_id = :sid AND status = 'running'
                          AND started_at < now() - interval '{RUN_LEASE}'
                        """
                    ),
                    {"sid": source.id},
                )
                row = conn.execute(
                    text(
                        """
                        INSERT INTO ingest.runs (source_id, status)
                        VALUES (:sid, 'running')
                        RETURNING id, started_at
                        """
                    ),
                    {"sid": source.id},
                ).one()
        except IntegrityError as exc:
            raise RunInProgress(source.name) from exc
        return RunHandle(id=row.id, started_at=row.started_at)

    def finish_run(self, run: RunHandle, status: RunStatus, stats: RunStats, error: str | None) -> None:
        with self.engine.begin() as conn:
            source_id = conn.execute(
                text(
                    """
                    UPDATE ingest.runs SET
                      status = :status, finished_at = now(), error_summary = :error,
                      fetched = :fetched, unchanged = :unchanged, inserted = :inserted,
                      updated = :updated, rejected = :rejected, failed = :failed,
                      purged = :purged
                    WHERE id = :id
                    RETURNING source_id
                    """
                ),
                {"id": run.id, "status": status, "error": error, **stats.model_dump()},
            ).scalar_one()
            conn.execute(
                text("UPDATE ingest.sources SET last_run_at = now(), updated_at = now() WHERE id = :sid"),
                {"sid": source_id},
            )

    # ── raw records ──────────────────────────────────────────────────────
    def upsert_raw(self, source: Source, run: RunHandle, connector: str, item: RawItem) -> tuple[int, bool]:
        """Returns (raw_id, needs_extraction). Unchanged + already-extracted payloads skip extraction."""
        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    INSERT INTO ingest.raw_records
                      (connector, external_id, source_id, last_run_id, payload, payload_sha256)
                    VALUES (:connector, :external_id, :sid, :run_id, CAST(:payload AS jsonb), :sha)
                    ON CONFLICT (connector, external_id) DO UPDATE SET
                      source_id = EXCLUDED.source_id,
                      last_run_id = EXCLUDED.last_run_id,
                      last_seen_at = now(),
                      payload = EXCLUDED.payload,
                      payload_sha256 = EXCLUDED.payload_sha256,
                      extraction_status = CASE
                        WHEN ingest.raw_records.payload_sha256 = EXCLUDED.payload_sha256
                         AND ingest.raw_records.extraction_status IN ('extracted', 'rejected')
                        THEN ingest.raw_records.extraction_status ELSE 'pending' END
                    RETURNING id, extraction_status = 'pending' AS needs_extraction
                    """
                ),
                {
                    "connector": connector,
                    "external_id": item.external_id,
                    "sid": source.id,
                    "run_id": run.id,
                    "payload": json.dumps(item.payload, default=str),
                    "sha": item.sha256,
                },
            ).one()
        return int(row.id), bool(row.needs_extraction)

    def mark_raw(self, raw_id: int, status: Literal["extracted", "rejected", "failed"], error: str | None = None) -> None:
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    UPDATE ingest.raw_records
                    SET extraction_status = :status, extraction_error = :error, extracted_at = now()
                    WHERE id = :id
                    """
                ),
                {"id": raw_id, "status": status, "error": error[:1000] if error else None},
            )

    # ── places ───────────────────────────────────────────────────────────
    def resolve_place(self, connector: str, venue: VenueRecord, city_slug: str | None) -> uuid.UUID:
        """Provider venue -> public.places id: existing link, else geo+name match, else new row."""
        with self.engine.begin() as conn:
            conn.execute(
                text("SELECT pg_advisory_xact_lock(hashtext(:key))"),
                {"key": f"scaper-venue:{connector}:{venue.external_id}"},
            )
            linked = conn.execute(
                text(
                    "SELECT place_id FROM ingest.place_links "
                    "WHERE connector = :connector AND external_id = :external_id"
                ),
                {"connector": connector, "external_id": venue.external_id},
            ).scalar()
            if linked:
                return linked

            point = {"lat": venue.lat, "lng": venue.lng, "name": venue.name}
            match = conn.execute(
                text(
                    """
                    SELECT id, similarity(name, :name) AS score
                    FROM places
                    WHERE ST_DWithin(geog, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)
                      AND similarity(name, :name) >= :min_sim
                    ORDER BY score DESC,
                             ST_Distance(geog, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)
                    LIMIT 1
                    """
                ),
                {**point, "radius": MATCH_RADIUS_M, "min_sim": MATCH_MIN_SIMILARITY},
            ).first()
            if match:
                place_id, method, score = match.id, "geo_name", float(match.score)
            else:
                # gers_id stays NULL: the Overture hot index (gers_id IS NOT NULL)
                # never mixes these rows into place listings.
                place_id = conn.execute(
                    text(
                        """
                        INSERT INTO places (name, geog, address, city_slug, depth_tier)
                        VALUES (:name, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                                CAST(:address AS jsonb), :city_slug, 0)
                        RETURNING id
                        """
                    ),
                    {**point, "address": json.dumps(venue.overture_address()), "city_slug": city_slug},
                ).scalar_one()
                method, score = "created", None
            conn.execute(
                text(
                    """
                    INSERT INTO ingest.place_links (connector, external_id, place_id, method, score)
                    VALUES (:connector, :external_id, :place_id, :method, :score)
                    """
                ),
                {
                    "connector": connector,
                    "external_id": venue.external_id,
                    "place_id": place_id,
                    "method": method,
                    "score": score,
                },
            )
        return place_id

    # ── events ───────────────────────────────────────────────────────────
    def upsert_event(
        self, connector: str, source: Source, raw_id: int, event: EventRecord, place_id: uuid.UUID | None
    ) -> Literal["inserted", "updated"]:
        venue = event.venue
        with self.engine.begin() as conn:
            inserted = conn.execute(
                text(
                    """
                    INSERT INTO public.events (
                      id, provider, external_id, title, description, category,
                      start_time, end_time, timezone, status, is_free,
                      price_min, price_max, currency, ticket_url, image_url,
                      venue_name, venue_place_id, lat, lng, geom, city_slug,
                      source_id, raw_record_id, fetched_at, expires_at,
                      first_seen_at, last_seen_at, updated_at
                    ) VALUES (
                      gen_random_uuid(), :provider, :external_id, :title, :description, :category,
                      :starts_at, :ends_at, :timezone, :status, :is_free,
                      :price_min, :price_max, :currency, :url, :image_url,
                      :venue_name, :place_id, :lat, :lng,
                      CASE WHEN :lat IS NULL THEN NULL
                           ELSE ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) END,
                      :city_slug, :source_id, :raw_id, now(),
                      COALESCE(:ends_at, :starts_at + interval '6 hours'),
                      now(), now(), now()
                    )
                    ON CONFLICT (provider, external_id) DO UPDATE SET
                      title = EXCLUDED.title, description = EXCLUDED.description,
                      category = EXCLUDED.category, start_time = EXCLUDED.start_time,
                      end_time = EXCLUDED.end_time, timezone = EXCLUDED.timezone,
                      status = EXCLUDED.status, is_free = EXCLUDED.is_free,
                      price_min = EXCLUDED.price_min, price_max = EXCLUDED.price_max,
                      currency = EXCLUDED.currency, ticket_url = EXCLUDED.ticket_url,
                      image_url = EXCLUDED.image_url, venue_name = EXCLUDED.venue_name,
                      venue_place_id = EXCLUDED.venue_place_id, lat = EXCLUDED.lat,
                      lng = EXCLUDED.lng, geom = EXCLUDED.geom, city_slug = EXCLUDED.city_slug,
                      source_id = EXCLUDED.source_id, raw_record_id = EXCLUDED.raw_record_id,
                      fetched_at = now(), expires_at = EXCLUDED.expires_at,
                      last_seen_at = now(), updated_at = now()
                    RETURNING (xmax = 0) AS inserted
                    """
                ),
                {
                    "provider": connector,
                    "external_id": event.external_id,
                    "title": event.title,
                    "description": event.description,
                    "category": event.category,
                    "starts_at": event.starts_at,
                    "ends_at": event.ends_at,
                    "timezone": event.timezone,
                    "status": event.status,
                    "is_free": event.is_free,
                    "price_min": event.price_min,
                    "price_max": event.price_max,
                    "currency": event.currency,
                    "url": event.url,
                    "image_url": event.image_url,
                    "venue_name": venue.name if venue else None,
                    "place_id": place_id,
                    "lat": venue.lat if venue else None,
                    "lng": venue.lng if venue else None,
                    "city_slug": source.city_slug,
                    "source_id": source.id,
                    "raw_id": raw_id,
                },
            ).scalar_one()
        return "inserted" if inserted else "updated"

    def touch_event(self, connector: str, external_id: str) -> None:
        """Payload unchanged: record that the provider still lists it (undoes a prior expiry)."""
        with self.engine.begin() as conn:
            conn.execute(
                text(
                    """
                    UPDATE public.events
                    SET last_seen_at = now(),
                        expires_at = COALESCE(end_time, start_time + interval '6 hours')
                    WHERE provider = :provider AND external_id = :external_id
                    """
                ),
                {"provider": connector, "external_id": external_id},
            )

    def expire_unseen(self, source: Source, run: RunHandle) -> int:
        """Hide this source's upcoming events the provider no longer lists."""
        with self.engine.begin() as conn:
            result = conn.execute(
                text(
                    """
                    UPDATE public.events
                    SET expires_at = now(), updated_at = now()
                    WHERE source_id = :sid
                      AND last_seen_at < :run_started
                      AND COALESCE(expires_at, 'infinity'::timestamptz) > now()
                    """
                ),
                {"sid": source.id, "run_started": run.started_at},
            )
        return result.rowcount or 0

    def purge_past_events(self) -> int:
        """Delete finished Scaper events. source_id is set only by Scaper, so other writers' rows are untouched."""
        with self.engine.begin() as conn:
            result = conn.execute(
                text(
                    """
                    DELETE FROM public.events
                    WHERE source_id IS NOT NULL
                      AND COALESCE(end_time, start_time + interval '6 hours') < now()
                    """
                )
            )
        return result.rowcount or 0
