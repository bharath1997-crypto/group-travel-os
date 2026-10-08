"""Rules for purging stale ingest.raw_records without a public.events row."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.sql.elements import TextClause

_EVENTBRITE_ORPHAN_RAW_DELETE = """
DELETE FROM ingest.raw_records r
WHERE r.source_id = :sid
  AND r.connector = :connector
  AND NOT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.provider = r.connector AND e.external_id = r.external_id
  )
  AND (
    (
      NULLIF(r.payload->'end'->>'utc', '') IS NOT NULL
      AND (r.payload->'end'->>'utc')::timestamptz < now()
    )
    OR (
      NULLIF(r.payload->'start'->>'utc', '') IS NOT NULL
      AND (
        NULLIF(r.payload->'end'->>'utc', '') IS NULL
        OR (r.payload->'end'->>'utc')::timestamptz IS NULL
      )
      AND ((r.payload->'start'->>'utc')::timestamptz + interval '6 hours') < now()
    )
  )
"""

_TICKETMASTER_ORPHAN_RAW_DELETE = """
DELETE FROM ingest.raw_records r
WHERE r.source_id = :sid
  AND r.connector = :connector
  AND NOT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.provider = r.connector AND e.external_id = r.external_id
  )
  AND NULLIF(r.payload->'dates'->'start'->>'dateTime', '') IS NOT NULL
  AND (
    COALESCE(
      NULLIF(r.payload->'dates'->'end'->>'dateTime', '')::timestamptz,
      (r.payload->'dates'->'start'->>'dateTime')::timestamptz + interval '6 hours'
    ) + interval '7 days'
  ) < now()
"""


def orphan_past_raw_delete_sql(connector: str) -> TextClause:
    if connector == "eventbrite":
        return text(_EVENTBRITE_ORPHAN_RAW_DELETE)
    if connector == "ticketmaster":
        return text(_TICKETMASTER_ORPHAN_RAW_DELETE)
    raise ValueError(f"no orphan raw purge SQL for connector {connector}")


def _parse_utc(value: str | None) -> datetime | None:
    if not value or not str(value).strip():
        return None
    raw = str(value).strip()
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def raw_payload_past(connector: str, payload: dict[str, Any], *, now: datetime) -> bool:
    """True when payload event timing is past per connector retention (no events row assumed)."""
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    if connector == "eventbrite":
        start = _parse_utc((payload.get("start") or {}).get("utc"))
        end = _parse_utc((payload.get("end") or {}).get("utc"))
        if end is not None:
            return end < now
        if start is not None:
            return start + timedelta(hours=6) < now
        return False
    if connector == "ticketmaster":
        dates = payload.get("dates") or {}
        start = _parse_utc((dates.get("start") or {}).get("dateTime"))
        end = _parse_utc((dates.get("end") or {}).get("dateTime"))
        if start is None:
            return False
        effective_end = end if end is not None else start + timedelta(hours=6)
        return effective_end + timedelta(days=7) < now
    return False
