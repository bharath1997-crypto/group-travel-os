"""Persistence for Scaper. The pipeline depends on the Store protocol only."""
from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal, Protocol

from sqlalchemy import Connection, Engine, text
from sqlalchemy.exc import IntegrityError, ProgrammingError

from scaper.dedup import EventRow, norm_postcode, plan_duplicates, same_venue_address, same_venue_name
from scaper.models import EventRecord, RawItem, RunStats, RunStatus, Source, VenueRecord
from scaper.ticketmaster_overlap import city_slugs_for_state

# Venue -> places matching thresholds. Conservative: a wrong link attaches an
# event to the wrong venue, a missed link only creates a duplicate place row.
MATCH_RADIUS_M = 100.0
MATCH_MIN_SIMILARITY = 0.45
# Tier A2: wider radius, but only for names equal after normalization (dedup spec §3).
WIDE_MATCH_RADIUS_M = 250.0
# Tier A3: providers scatter one venue's pin by hundreds of metres; require name + street + postcode.
ADDRESS_MATCH_RADIUS_M = 500.0
# Stale 'running' rows older than this are treated as crashed workers.
RUN_LEASE = "2 hours"


@dataclass(frozen=True)
class _ExtractionRow:
    raw_id: int
    event: EventRecord
    place_id: uuid.UUID | None
    city_slug: str | None
    state_code: str | None = None


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
    def persist_extractions(
        self,
        connector: str,
        source: Source,
        rows: list,
    ) -> tuple[int, int]: ...
    def expire_unseen(self, source: Source, run: RunHandle) -> int: ...
    def disable_ticketmaster_city_sources_for_state(self, state_code: str) -> int: ...
    def purge_past_events(self, source: Source) -> int: ...
    def dedupe_city(self, city_slug: str) -> int: ...
    def blocked_ids(self, provider: str) -> set[str]: ...
    def is_provider_blocked(self, provider: str, external_id: str) -> bool: ...
    def remove_provider_event(
        self, provider: str, external_id: str, *, reason: str | None = None
    ) -> dict[str, Any]: ...


_SOURCE_COLUMNS = (
    "id, connector, name, config, city_slug, state_code, enabled, interval_minutes, last_run_at"
)


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
        state_code: str | None = None,
        interval_minutes: int = 360,
    ) -> Source:
        state = state_code.strip().upper() if state_code else None
        with self.engine.begin() as conn:
            row = conn.execute(
                text(
                    f"""
                    INSERT INTO ingest.sources (connector, name, config, city_slug, state_code, interval_minutes)
                    VALUES (:connector, :name, CAST(:config AS jsonb), :city_slug, :state_code, :interval_minutes)
                    ON CONFLICT (name) DO UPDATE SET
                      connector = EXCLUDED.connector,
                      config = EXCLUDED.config,
                      city_slug = EXCLUDED.city_slug,
                      state_code = EXCLUDED.state_code,
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
                    "state_code": state,
                    "interval_minutes": interval_minutes,
                },
            ).mappings().one()
        source = Source.model_validate(dict(row))
        if source.connector == "ticketmaster" and source.state_code:
            self.disable_ticketmaster_city_sources_for_state(source.state_code)
        return source

    def disable_ticketmaster_city_sources_for_state(self, state_code: str) -> int:
        slugs = city_slugs_for_state(state_code)
        if not slugs:
            return 0
        with self.engine.begin() as conn:
            result = conn.execute(
                text(
                    """
                    UPDATE ingest.sources
                    SET enabled = false, updated_at = now()
                    WHERE connector = 'ticketmaster'
                      AND city_slug = ANY(:slugs)
                      AND enabled
                    """
                ),
                {"slugs": slugs},
            )
        return result.rowcount or 0

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

    def set_city_interval(self, city_slug: str, minutes: int) -> int:
        if minutes < 60:
            raise ValueError("Scaper source interval must be at least 60 minutes")
        with self.engine.begin() as conn:
            result = conn.execute(
                text("""
                    UPDATE ingest.sources SET interval_minutes = :minutes, updated_at = now()
                    WHERE city_slug = :city AND enabled
                """),
                {"minutes": minutes, "city": city_slug},
            )
        return result.rowcount

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
                      purged = :purged, deduped = :deduped
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
            match = _match_place(
                conn, venue.name, venue.lat, venue.lng, city_slug,
                street=venue.freeform, postcode=venue.postcode,
            )
            if match:
                place_id, method, score = match
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
        self,
        connector: str,
        source: Source,
        raw_id: int,
        event: EventRecord,
        place_id: uuid.UUID | None,
        *,
        city_slug: str | None = None,
        state_code: str | None = None,
    ) -> Literal["inserted", "updated"]:
        stamped_city = city_slug if city_slug is not None else source.city_slug
        inserted, _updated = self.persist_extractions(
            connector,
            source,
            [_ExtractionRow(raw_id, event, place_id, stamped_city, state_code)],
        )
        return "inserted" if inserted else "updated"

    def persist_extractions(
        self,
        connector: str,
        source: Source,
        rows: list[Any],
    ) -> tuple[int, int]:
        if not rows:
            return 0, 0
        inserted = updated = 0
        with self.engine.begin() as conn:
            for row in rows:
                venue = row.event.venue
                was_insert = conn.execute(
                    text(
                        """
                        INSERT INTO public.events (
                          id, provider, external_id, title, description, category,
                          start_time, end_time, timezone, status, is_free,
                          price_min, price_max, currency, ticket_url, image_url,
                          venue_name, venue_place_id, lat, lng, geom, city_slug, state_code,
                          source_id, raw_record_id, fetched_at, expires_at,
                          first_seen_at, last_seen_at, updated_at
                        ) VALUES (
                          gen_random_uuid(), :provider, :external_id, :title, :description, :category,
                          :starts_at, :ends_at, :timezone, :status, :is_free,
                          :price_min, :price_max, :currency, :url, :image_url,
                          :venue_name, :place_id, :lat, :lng,
                          CASE WHEN :lat IS NULL THEN NULL
                               ELSE ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) END,
                          :city_slug, :state_code, :source_id, :raw_id, now(),
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
                          state_code = EXCLUDED.state_code,
                          source_id = EXCLUDED.source_id, raw_record_id = EXCLUDED.raw_record_id,
                          fetched_at = now(), expires_at = EXCLUDED.expires_at,
                          last_seen_at = now(), updated_at = now()
                        RETURNING (xmax = 0) AS inserted
                        """
                    ),
                    {
                        "provider": connector,
                        "external_id": row.event.external_id,
                        "title": row.event.title,
                        "description": row.event.description,
                        "category": row.event.category,
                        "starts_at": row.event.starts_at,
                        "ends_at": row.event.ends_at,
                        "timezone": row.event.timezone,
                        "status": row.event.status,
                        "is_free": row.event.is_free,
                        "price_min": row.event.price_min,
                        "price_max": row.event.price_max,
                        "currency": row.event.currency,
                        "url": row.event.url,
                        "image_url": row.event.image_url,
                        "venue_name": venue.name if venue else None,
                        "place_id": row.place_id,
                        "lat": venue.lat if venue else None,
                        "lng": venue.lng if venue else None,
                        "city_slug": row.city_slug,
                        "state_code": row.state_code,
                        "source_id": source.id,
                        "raw_id": row.raw_id,
                    },
                ).scalar_one()
                if was_insert:
                    inserted += 1
                else:
                    updated += 1
                conn.execute(
                    text(
                        """
                        UPDATE ingest.raw_records
                        SET extraction_status = 'extracted', extraction_error = NULL, extracted_at = now()
                        WHERE id = :id
                        """
                    ),
                    {"id": row.raw_id},
                )
        return inserted, updated

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

    def purge_past_events(self, source: Source) -> int:
        """
        Delete finished rows for this source, drop their raw payloads, and for Eventbrite
        remove Scaper-created venue places nothing future still references.
        """
        if source.connector == "eventbrite":
            past_sql = """
                (end_time IS NOT NULL AND end_time < now())
                OR (end_time IS NULL AND start_time + interval '6 hours' < now())
            """
        elif source.connector == "ticketmaster":
            past_sql = """
                COALESCE(end_time, start_time + interval '6 hours') + interval '7 days' < now()
            """
        else:
            past_sql = "COALESCE(end_time, start_time + interval '6 hours') < now()"

        with self.engine.begin() as conn:
            deleted = conn.execute(
                text(
                    f"""
                    DELETE FROM public.events
                    WHERE source_id = :sid AND ({past_sql})
                    RETURNING provider, external_id, raw_record_id
                    """
                ),
                {"sid": source.id},
            ).mappings().all()
            if not deleted:
                return 0
            raw_ids = [int(r["raw_record_id"]) for r in deleted if r["raw_record_id"] is not None]
            if raw_ids:
                conn.execute(
                    text("DELETE FROM ingest.raw_records WHERE id = ANY(:ids)"),
                    {"ids": raw_ids},
                )
            for row in deleted:
                conn.execute(
                    text(
                        """
                        DELETE FROM ingest.raw_records
                        WHERE connector = :connector AND external_id = :external_id
                        """
                    ),
                    {"connector": row["provider"], "external_id": row["external_id"]},
                )
            if source.connector == "eventbrite":
                _purge_orphan_eventbrite_created_places(conn)
        return len(deleted)

    def blocked_ids(self, provider: str) -> set[str]:
        """All blocked external ids for a provider (one query per pipeline run)."""
        with self.engine.connect() as conn:
            try:
                rows = conn.execute(
                    text(
                        "SELECT external_id FROM ingest.blocklist WHERE provider = :provider"
                    ),
                    {"provider": provider},
                ).scalars().all()
            except ProgrammingError as exc:
                if getattr(getattr(exc, "orig", None), "pgcode", None) == "42P01":
                    return set()
                raise
        return set(rows)

    def is_provider_blocked(self, provider: str, external_id: str) -> bool:
        with self.engine.connect() as conn:
            try:
                found = conn.execute(
                    text(
                        "SELECT 1 FROM ingest.blocklist WHERE provider = :provider AND external_id = :external_id"
                    ),
                    {"provider": provider, "external_id": external_id},
                ).scalar()
            except ProgrammingError as exc:
                if getattr(getattr(exc, "orig", None), "pgcode", None) == "42P01":
                    return False
                raise
        return found is not None

    def remove_provider_event(
        self, provider: str, external_id: str, *, reason: str | None = None
    ) -> dict[str, Any]:
        """Delete public event + raw payload, then block re-ingest (owner removal).

        ``duplicate_of`` links from other events are cleared via ON DELETE SET NULL on
        ``events_duplicate_of_fk`` in the same transaction.
        """
        with self.engine.begin() as conn:
            event_ids = conn.execute(
                text(
                    """
                    DELETE FROM public.events
                    WHERE provider = :provider AND external_id = :external_id
                    RETURNING id
                    """
                ),
                {"provider": provider, "external_id": external_id},
            ).scalars().all()
            raw_deleted = conn.execute(
                text(
                    """
                    DELETE FROM ingest.raw_records
                    WHERE connector = :provider AND external_id = :external_id
                    """
                ),
                {"provider": provider, "external_id": external_id},
            ).rowcount or 0
            conn.execute(
                text(
                    """
                    INSERT INTO ingest.blocklist (provider, external_id, reason)
                    VALUES (:provider, :external_id, :reason)
                    ON CONFLICT (provider, external_id) DO UPDATE SET
                      reason = COALESCE(EXCLUDED.reason, ingest.blocklist.reason),
                      blocked_at = now()
                    """
                ),
                {"provider": provider, "external_id": external_id, "reason": reason},
            )
        return {
            "provider": provider,
            "external_id": external_id,
            "events_deleted": len(event_ids),
            "raw_records_deleted": int(raw_deleted),
            "blocked": True,
        }

    def relink_created_places(self, city_slug: str | None = None) -> int:
        """
        Backfill for widened venue matching: re-match every place Scaper created.
        On a match, all links and events pointing at the created place move to
        the match and the orphaned created place is deleted. Returns relinked count.
        """
        relinked = 0
        for _ in range(3):  # chains (created -> created -> Overture) settle within a few passes
            with self.engine.connect() as conn:
                created = conn.execute(
                    text(
                        """
                        SELECT DISTINCT p.id, p.name, p.city_slug,
                               p.address->>'freeform' AS street, p.address->>'postcode' AS postcode,
                               ST_Y(p.geog::geometry) AS lat, ST_X(p.geog::geometry) AS lng
                        FROM ingest.place_links l JOIN places p ON p.id = l.place_id
                        WHERE l.method = 'created'
                          AND (CAST(:city AS text) IS NULL OR p.city_slug = :city)
                        """
                    ),
                    {"city": city_slug},
                ).all()
            changed = 0
            for row in created:
                with self.engine.begin() as conn:
                    match = _match_place(
                        conn, row.name, row.lat, row.lng, row.city_slug,
                        street=row.street, postcode=row.postcode, exclude_id=row.id,
                    )
                    if not match:
                        continue
                    target, method, score = match
                    conn.execute(
                        text(
                            """
                            UPDATE ingest.place_links SET place_id = :target,
                              method = CASE WHEN method = 'created' THEN :method ELSE method END,
                              score = COALESCE(score, :score)
                            WHERE place_id = :old
                            """
                        ),
                        {"target": target, "method": method, "score": score, "old": row.id},
                    )
                    conn.execute(
                        text("UPDATE public.events SET venue_place_id = :target WHERE venue_place_id = :old"),
                        {"target": target, "old": row.id},
                    )
                    conn.execute(
                        text(
                            """
                            DELETE FROM places p WHERE p.id = :old AND p.gers_id IS NULL
                              AND NOT EXISTS (SELECT 1 FROM ingest.place_links WHERE place_id = :old)
                              AND NOT EXISTS (SELECT 1 FROM public.events WHERE venue_place_id = :old)
                            """
                        ),
                        {"old": row.id},
                    )
                    changed += 1
            relinked += changed
            if not changed:
                break
        return relinked

    def dedupe_city(self, city_slug: str) -> int:
        """Recompute duplicate_of for this city's current Scaper events. Returns rows newly hidden."""
        with self.engine.begin() as conn:
            rows = conn.execute(
                text(
                    """
                    SELECT id, provider, title, venue_name, venue_place_id, lat, lng, start_time,
                           end_time, price_min, image_url, first_seen_at, status, duplicate_of, timezone
                    FROM public.events
                    WHERE source_id IS NOT NULL AND city_slug = :city
                      AND COALESCE(expires_at, end_time, start_time) > now()
                    FOR UPDATE
                    """
                ),
                {"city": city_slug},
            ).mappings().all()
            events = [
                EventRow(
                    id=r["id"],
                    provider=r["provider"],
                    title=r["title"] or "",
                    venue_name=r["venue_name"],
                    venue_place_id=r["venue_place_id"],
                    lat=r["lat"],
                    lng=r["lng"],
                    start_time=r["start_time"],
                    end_time=r["end_time"],
                    price_min=float(r["price_min"]) if r["price_min"] is not None else None,
                    image_url=r["image_url"],
                    first_seen_at=r["first_seen_at"],
                    status=r["status"],
                    timezone=r["timezone"],
                )
                for r in rows
            ]
            plan = plan_duplicates(events, city_slug)
            current = {r["id"]: r["duplicate_of"] for r in rows}
            newly_hidden = 0
            for event_id, dup_of in plan.items():
                if current[event_id] == dup_of:
                    continue
                if dup_of is not None and current[event_id] is None:
                    newly_hidden += 1
                conn.execute(
                    text("UPDATE public.events SET duplicate_of = :dup, updated_at = now() WHERE id = :id"),
                    {"dup": dup_of, "id": event_id},
                )
        return newly_hidden


def _purge_orphan_eventbrite_created_places(conn: Connection) -> None:
    """Drop Eventbrite-only created places with no upcoming Eventbrite events."""
    removed_links = conn.execute(
        text(
            """
            DELETE FROM ingest.place_links l
            WHERE l.connector = 'eventbrite' AND l.method = 'created'
              AND EXISTS (
                SELECT 1 FROM places p
                WHERE p.id = l.place_id AND p.gers_id IS NULL
              )
              AND NOT EXISTS (
                SELECT 1 FROM public.events e
                WHERE e.venue_place_id = l.place_id AND e.provider = 'eventbrite'
                  AND (
                    (e.end_time IS NULL AND e.start_time + interval '6 hours' >= now())
                    OR (e.end_time IS NOT NULL AND e.end_time >= now())
                  )
              )
            RETURNING l.place_id
            """
        )
    ).scalars().all()
    if not removed_links:
        return
    conn.execute(
        text(
            """
            DELETE FROM places p
            WHERE p.id = ANY(:ids) AND p.gers_id IS NULL
              AND NOT EXISTS (SELECT 1 FROM ingest.place_links WHERE place_id = p.id)
              AND NOT EXISTS (SELECT 1 FROM public.events WHERE venue_place_id = p.id)
            """
        ),
        {"ids": list(removed_links)},
    )


def _match_place(
    conn: Connection,
    name: str,
    lat: float,
    lng: float,
    city_slug: str | None,
    *,
    street: str | None = None,
    postcode: str | None = None,
    exclude_id: uuid.UUID | None = None,
) -> tuple[uuid.UUID, str, float | None] | None:
    """
    Tier A1 (100 m + trigram), A2 (250 m + normalized name), then A3 (500 m +
    normalized name + street + postcode all equal). Overture rows win ties.
    """
    params = {"name": name, "lat": lat, "lng": lng, "exclude": exclude_id}
    tight = conn.execute(
        text(
            """
            SELECT id, similarity(name, :name) AS score
            FROM places
            WHERE ST_DWithin(geog, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)
              AND similarity(name, :name) >= :min_sim
              AND (CAST(:exclude AS uuid) IS NULL OR id <> CAST(:exclude AS uuid))
            ORDER BY score DESC, gers_id IS NULL,
                     ST_Distance(geog, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)
            LIMIT 1
            """
        ),
        {**params, "radius": MATCH_RADIUS_M, "min_sim": MATCH_MIN_SIMILARITY},
    ).first()
    if tight:
        return tight.id, "geo_name", float(tight.score)
    wide = conn.execute(
        text(
            """
            SELECT id, name
            FROM places
            WHERE ST_DWithin(geog, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)
              AND (CAST(:exclude AS uuid) IS NULL OR id <> CAST(:exclude AS uuid))
            ORDER BY gers_id IS NULL,
                     ST_Distance(geog, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)
            LIMIT 300
            """
        ),
        {**params, "radius": WIDE_MATCH_RADIUS_M},
    ).all()
    for candidate in wide:
        if same_venue_name(name, candidate.name, city_slug):
            return candidate.id, "geo_name_wide", None
    zip5 = norm_postcode(postcode)
    if not street or not zip5:
        return None
    by_address = conn.execute(
        text(
            """
            SELECT id, name, address->>'freeform' AS street, address->>'postcode' AS postcode
            FROM places
            WHERE ST_DWithin(geog, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)
              AND left(replace(upper(address->>'postcode'), ' ', ''), 5) = left(:zip, 5)
              AND (CAST(:exclude AS uuid) IS NULL OR id <> CAST(:exclude AS uuid))
            ORDER BY gers_id IS NULL,
                     ST_Distance(geog, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)
            LIMIT 300
            """
        ),
        {**params, "radius": ADDRESS_MATCH_RADIUS_M, "zip": zip5},
    ).all()
    for candidate in by_address:
        if same_venue_address(name, street, postcode, candidate.name, candidate.street, candidate.postcode, city_slug):
            return candidate.id, "geo_address", None
    return None
