"""
app/services/trip_export_service.py — Export selected trips as JSON or ICS

Reuses data_export_requests table and the existing storage helpers from
data_export_service.  No new dependencies required — ICS is generated as plain
text per RFC 5545.
"""
from __future__ import annotations

import io
import json
import logging
import textwrap
import zipfile
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.data_export import DataExportRequest
from app.models.expense import Expense
from app.models.group import Group
from app.models.location import TripLocation
from app.models.poll import Poll
from app.models.trip import Trip
from app.models.trip_roster import TripRoster
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)

_EXPORT_TTL_HOURS = 24


# ── Membership validation ─────────────────────────────────────────────────────

def _validate_trip_access(
    db: Session,
    user_id: UUID,
    trip_ids: list[UUID],
) -> list[Trip]:
    """
    Returns the Trip objects in the requested order.
    Raises 404 if any trip_id doesn't exist, 403 if user isn't on the roster.
    """
    trips: list[Trip] = []
    for tid in trip_ids:
        trip = db.execute(
            select(Trip).where(Trip.id == tid)
        ).scalar_one_or_none()
        if trip is None:
            raise AppException.not_found(f"Trip {tid} not found")

        member = db.execute(
            select(TripRoster).where(
                TripRoster.trip_id == tid,
                TripRoster.user_id == user_id,
            )
        ).scalar_one_or_none()
        if member is None:
            raise AppException.forbidden(f"You do not have access to trip {tid}")
        trips.append(trip)
    return trips


# ── Request creation ──────────────────────────────────────────────────────────

def create_trip_export_request(
    db: Session,
    user_id: UUID,
    trip_ids: list[UUID],
    fmt: str,
) -> DataExportRequest:
    _validate_trip_access(db, user_id, trip_ids)

    req = DataExportRequest(
        user_id=user_id,
        export_type="trips",
        format=fmt,
        status="pending",
        metadata_={"trip_ids": [str(tid) for tid in trip_ids]},
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


# ── JSON builder ──────────────────────────────────────────────────────────────

def _build_trip_json(db: Session, trips: list[Trip]) -> bytes:
    output: list[dict] = []
    for trip in trips:
        group = db.execute(
            select(Group).where(Group.id == trip.group_id)
        ).scalar_one_or_none()

        locations = db.execute(
            select(TripLocation).where(TripLocation.trip_id == trip.id)
        ).scalars().all()

        expenses = db.execute(
            select(Expense).where(Expense.trip_id == trip.id)
        ).scalars().all()

        polls = db.execute(
            select(Poll).where(Poll.trip_id == trip.id)
        ).scalars().all()

        output.append({
            "id": str(trip.id),
            "title": trip.title,
            "description": trip.description,
            "status": trip.status.value if trip.status else None,
            "start_date": str(trip.start_date) if trip.start_date else None,
            "end_date": str(trip.end_date) if trip.end_date else None,
            "created_at": trip.created_at.isoformat() if trip.created_at else None,
            "group": {
                "id": str(group.id),
                "name": group.name,
                "description": group.description,
            } if group else None,
            "locations": [
                {
                    "location_id": str(loc.location_id),
                    "status": loc.status,
                    "added_at": loc.added_at.isoformat() if loc.added_at else None,
                }
                for loc in locations
            ],
            "expenses_summary": {
                "count": len(expenses),
                "total_by_currency": _sum_by_currency(expenses),
            },
            "polls": [
                {
                    "id": str(p.id),
                    "question": p.question,
                    "type": p.poll_type.value if p.poll_type else None,
                    "status": p.status.value if p.status else None,
                }
                for p in polls
            ],
        })

    return json.dumps(
        {"exported_at": datetime.now(timezone.utc).isoformat(), "trips": output},
        indent=2,
        default=str,
    ).encode()


def _sum_by_currency(expenses: list[Expense]) -> dict[str, float]:
    totals: dict[str, float] = {}
    for e in expenses:
        totals[e.currency] = round(totals.get(e.currency, 0.0) + e.amount, 2)
    return totals


# ── ICS builder ───────────────────────────────────────────────────────────────

_ICS_DATE_FMT = "%Y%m%d"
_ICS_STAMP_FMT = "%Y%m%dT%H%M%SZ"


def _ics_escape(text: str) -> str:
    """Escape special characters per RFC 5545 §3.3.11."""
    return text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _ics_fold(line: str) -> str:
    """Fold lines longer than 75 octets per RFC 5545 §3.1."""
    encoded = line.encode("utf-8")
    if len(encoded) <= 75:
        return line
    result = []
    pos = 0
    first = True
    while pos < len(encoded):
        limit = 75 if first else 74
        chunk = encoded[pos : pos + limit]
        # Walk back to avoid splitting a multi-byte character
        while len(chunk) == limit and chunk[-1:] & b'\x80' and not (chunk[-1:] & b'\xc0' == b'\xc0'):
            chunk = chunk[:-1]
        result.append((" " if not first else "") + chunk.decode("utf-8", errors="replace"))
        pos += len(chunk)
        first = False
    return "\r\n".join(result)


def _build_ics(trips: list[Trip]) -> bytes:
    now_stamp = datetime.now(timezone.utc).strftime(_ICS_STAMP_FMT)
    lines: list[str] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Rovvy//Export//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
    ]

    for trip in trips:
        start: date = trip.start_date or date.today()
        end: date = (trip.end_date + timedelta(days=1)) if trip.end_date else (start + timedelta(days=1))

        description_parts = []
        if trip.description:
            description_parts.append(trip.description)
        description_parts.append(f"Status: {trip.status.value}" if trip.status else "Status: planning")
        description_parts.append("Exported from Rovvy")

        lines += [
            "BEGIN:VEVENT",
            f"UID:trip-{trip.id}@rovvy.app",
            f"DTSTAMP:{now_stamp}",
            f"DTSTART;VALUE=DATE:{start.strftime(_ICS_DATE_FMT)}",
            f"DTEND;VALUE=DATE:{end.strftime(_ICS_DATE_FMT)}",
            f"SUMMARY:{_ics_escape(trip.title)}",
            f"DESCRIPTION:{_ics_escape(' | '.join(description_parts))}",
            "END:VEVENT",
        ]

    lines.append("END:VCALENDAR")
    return "\r\n".join(_ics_fold(l) for l in lines).encode("utf-8")


# ── Archive builder ───────────────────────────────────────────────────────────

def _build_archive(fmt: str, db: Session, trips: list[Trip]) -> tuple[bytes, str]:
    """Returns (file_bytes, filename)."""
    if fmt == "ics":
        return _build_ics(trips), "rovvy_trips.ics"

    # json — wrap in ZIP for consistency with full export
    payload = _build_trip_json(db, trips)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("trips.json", payload)
        zf.writestr(
            "README.txt",
            "Rovvy Trip Export\n=================\n\n"
            "trips.json — selected trips with group info, locations, expenses summary, and polls.\n",
        )
    return buf.getvalue(), "rovvy_trips.zip"


# ── Background task ───────────────────────────────────────────────────────────

def process_trip_export(request_id: str) -> None:
    """
    Background task: validate, collect, build archive, store, update DB row.
    """
    from app.services.data_export_service import _store_export
    from app.utils.database import SessionLocal

    db = SessionLocal()
    try:
        req = db.execute(
            select(DataExportRequest).where(DataExportRequest.id == UUID(request_id))
        ).scalar_one_or_none()
        if not req:
            logger.error("Trip export request %s not found", request_id)
            return

        req.status = "processing"
        db.commit()

        trip_ids = [UUID(tid) for tid in req.metadata_.get("trip_ids", [])]
        trips = db.execute(
            select(Trip).where(Trip.id.in_(trip_ids))
        ).scalars().all()
        # Preserve original request order
        id_order = {tid: i for i, tid in enumerate(trip_ids)}
        trips = sorted(trips, key=lambda t: id_order.get(t.id, 999))

        archive_bytes, _filename = _build_archive(req.format, db, list(trips))
        file_url, file_size_kb = _store_export(req.id, archive_bytes)

        now = datetime.now(timezone.utc)
        req.status = "ready"
        req.file_url = file_url
        req.file_size_kb = file_size_kb
        req.ready_at = now
        req.expires_at = now + timedelta(hours=_EXPORT_TTL_HOURS)
        db.commit()

        logger.info("Trip export %s ready — %d KB", request_id, file_size_kb)

    except Exception as exc:
        logger.exception("Trip export %s failed: %s", request_id, exc)
        try:
            req.status = "failed"  # type: ignore[union-attr]
            req.error_message = str(exc)[:500]
            db.commit()
        except Exception:
            pass
    finally:
        db.close()
