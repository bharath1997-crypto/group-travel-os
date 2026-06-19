"""
app/services/data_export_service.py — Full-account data export (Phase 1)

Architecture:
  - All exports are generated asynchronously via FastAPI BackgroundTasks.
  - Files are built as in-memory ZIPs then written to /tmp/{request_id}.zip.
  - If GCS_BUCKET is configured, the file is uploaded to GCS and a 24h
    signed URL is stored. Otherwise, a local download URL is stored.
  - Rate limit: 1 full export per user per 24 hours.
"""
from __future__ import annotations

import io
import json
import logging
import os
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.data_export import DataExportRequest
from app.models.expense import Expense, ExpenseSplit
from app.models.saved_pin import SavedPin
from app.models.trip import Trip
from app.models.trip_roster import TripRoster
from app.models.user import User
from app.models.wayra import WayraPersonalMemory
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)

# Local temp directory for export files
_TMP_DIR = Path("/tmp/rovvy_exports")
_TMP_DIR.mkdir(parents=True, exist_ok=True)

# Rate limiting
_RATE_LIMIT_HOURS = 24
_MAX_PENDING = 2

# Export file TTL
_EXPORT_TTL_HOURS = 24


# ── Rate-limit check ──────────────────────────────────────────────────────────

def _check_rate_limit(db: Session, user_id: UUID) -> None:
    """Raises 429 if user already has a recent export or too many pending."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=_RATE_LIMIT_HOURS)

    recent = db.execute(
        select(func.count(DataExportRequest.id)).where(
            DataExportRequest.user_id == user_id,
            DataExportRequest.requested_at >= cutoff,
            DataExportRequest.status.in_(["pending", "processing", "ready"]),
        )
    ).scalar_one()

    if recent >= _MAX_PENDING:
        raise AppException.bad_request(
            "You can only request one export per 24 hours. "
            "Check your previous export or wait before requesting again."
        )


# ── Request creation ──────────────────────────────────────────────────────────

def create_export_request(
    db: Session,
    user_id: UUID,
    export_type: str = "full",
) -> DataExportRequest:
    _check_rate_limit(db, user_id)

    req = DataExportRequest(
        user_id=user_id,
        export_type=export_type,
        format="zip",
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


# ── Data collectors ───────────────────────────────────────────────────────────

def _collect_profile(db: Session, user_id: UUID) -> dict:
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not user:
        return {}
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": getattr(user, "full_name", None),
        "bio": getattr(user, "bio", None),
        "avatar_url": getattr(user, "avatar_url", None),
        "home_city": getattr(user, "home_city", None),
        "home_airport": getattr(user, "home_airport", None),
        "nationality": getattr(user, "nationality", None),
        "date_of_birth": str(getattr(user, "date_of_birth", "") or ""),
        "created_at": user.created_at.isoformat() if getattr(user, "created_at", None) else None,
    }


def _collect_trips(db: Session, user_id: UUID) -> list[dict]:
    roster_rows = db.execute(
        select(TripRoster).where(TripRoster.user_id == user_id)
    ).scalars().all()
    trip_ids = [r.trip_id for r in roster_rows]
    if not trip_ids:
        return []

    trips = db.execute(
        select(Trip).where(Trip.id.in_(trip_ids))
    ).scalars().all()

    return [
        {
            "id": str(t.id),
            "title": t.title,
            "status": str(t.status) if t.status else None,
            "start_date": str(t.start_date) if getattr(t, "start_date", None) else None,
            "end_date": str(t.end_date) if getattr(t, "end_date", None) else None,
            "destination": getattr(t, "destination", None),
            "description": getattr(t, "description", None),
            "created_at": t.created_at.isoformat() if getattr(t, "created_at", None) else None,
        }
        for t in trips
    ]


def _collect_expenses(db: Session, user_id: UUID) -> list[dict]:
    splits = db.execute(
        select(ExpenseSplit).where(ExpenseSplit.user_id == user_id)
    ).scalars().all()
    expense_ids = list({s.expense_id for s in splits})
    if not expense_ids:
        return []

    expenses = db.execute(
        select(Expense).where(Expense.id.in_(expense_ids))
    ).scalars().all()

    return [
        {
            "id": str(e.id),
            "title": getattr(e, "title", None),
            "amount": float(getattr(e, "amount", 0) or 0),
            "currency": getattr(e, "currency", "USD"),
            "paid_by": str(getattr(e, "paid_by_id", "") or ""),
            "trip_id": str(getattr(e, "trip_id", "") or ""),
            "created_at": e.created_at.isoformat() if getattr(e, "created_at", None) else None,
        }
        for e in expenses
    ]


def _collect_saved_pins(db: Session, user_id: UUID) -> list[dict]:
    pins = db.execute(
        select(SavedPin).where(SavedPin.user_id == user_id)
    ).scalars().all()
    return [
        {
            "id": str(p.id),
            "name": p.name,
            "latitude": p.latitude,
            "longitude": p.longitude,
            "note": p.note,
            "flag_type": p.flag_type,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in pins
    ]


def _collect_ai_history(db: Session, user_id: UUID) -> list[dict]:
    memories = db.execute(
        select(WayraPersonalMemory).where(WayraPersonalMemory.user_id == user_id)
    ).scalars().all()
    return [
        {
            "id": str(m.id),
            "key": getattr(m, "key", None),
            "value": getattr(m, "value", None),
            "created_at": m.created_at.isoformat() if getattr(m, "created_at", None) else None,
        }
        for m in memories
    ]


# ── ZIP builder ───────────────────────────────────────────────────────────────

def _build_zip(user_id: UUID, data: dict[str, object]) -> bytes:
    """Build an in-memory ZIP containing one JSON file per data category."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("README.txt", _readme_text())
        for name, payload in data.items():
            zf.writestr(f"{name}.json", json.dumps(payload, indent=2, default=str))
    return buf.getvalue()


def _readme_text() -> str:
    return (
        "Rovvy Data Export\n"
        "=================\n\n"
        "This archive contains a copy of your Rovvy account data.\n\n"
        "Files:\n"
        "  profile.json       — Account information\n"
        "  trips.json         — Trips you participated in\n"
        "  expenses.json      — Shared expenses\n"
        "  saved_pins.json    — Saved map places\n"
        "  ai_history.json    — Wayra AI memory entries\n\n"
        "Data is current as of the export request date.\n"
        "For questions: privacy@rovvy.app\n"
    )


# ── Storage ───────────────────────────────────────────────────────────────────

def _store_export(request_id: UUID, zip_bytes: bytes) -> tuple[str, int]:
    """
    Save the ZIP. Returns (file_url, file_size_kb).

    If GCS_BUCKET env var is set, uploads to GCS and returns a signed URL.
    Otherwise saves to /tmp and returns a local API download URL.
    """
    bucket_name = os.environ.get("GCS_BUCKET")
    if bucket_name:
        return _upload_to_gcs(bucket_name, request_id, zip_bytes)
    return _save_to_tmp(request_id, zip_bytes)


def _save_to_tmp(request_id: UUID, zip_bytes: bytes) -> tuple[str, int]:
    path = _TMP_DIR / f"{request_id}.zip"
    path.write_bytes(zip_bytes)
    file_size_kb = len(zip_bytes) // 1024
    download_url = f"/api/v1/data/export/{request_id}/download"
    return download_url, file_size_kb


def _upload_to_gcs(bucket_name: str, request_id: UUID, zip_bytes: bytes) -> tuple[str, int]:
    from datetime import timedelta

    try:
        from google.cloud import storage as gcs_storage  # type: ignore[import-untyped]
    except ImportError:
        logger.warning("google-cloud-storage not installed; falling back to /tmp")
        return _save_to_tmp(request_id, zip_bytes)

    client = gcs_storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(f"exports/{request_id}.zip")
    blob.upload_from_string(zip_bytes, content_type="application/zip")

    signed_url = blob.generate_signed_url(
        expiration=timedelta(hours=_EXPORT_TTL_HOURS),
        method="GET",
    )
    file_size_kb = len(zip_bytes) // 1024
    return signed_url, file_size_kb


# ── Background job ────────────────────────────────────────────────────────────

def process_export(request_id: str) -> None:
    """
    Background task: collect data, build ZIP, store it, update DB row.
    Uses its own DB session so it runs safely outside the request context.
    """
    from app.utils.database import SessionLocal

    db = SessionLocal()
    try:
        req = db.execute(
            select(DataExportRequest).where(DataExportRequest.id == UUID(request_id))
        ).scalar_one_or_none()
        if not req:
            logger.error("Export request %s not found", request_id)
            return

        req.status = "processing"
        db.commit()

        data: dict[str, object] = {
            "profile": _collect_profile(db, req.user_id),
            "trips": _collect_trips(db, req.user_id),
            "expenses": _collect_expenses(db, req.user_id),
            "saved_pins": _collect_saved_pins(db, req.user_id),
            "ai_history": _collect_ai_history(db, req.user_id),
        }

        zip_bytes = _build_zip(req.user_id, data)
        file_url, file_size_kb = _store_export(req.id, zip_bytes)

        now = datetime.now(timezone.utc)
        req.status = "ready"
        req.file_url = file_url
        req.file_size_kb = file_size_kb
        req.ready_at = now
        req.expires_at = now + timedelta(hours=_EXPORT_TTL_HOURS)
        db.commit()

        logger.info("Export %s ready — %d KB", request_id, file_size_kb)
        _send_ready_notification(db, req)

    except Exception as exc:
        logger.exception("Export %s failed: %s", request_id, exc)
        try:
            req.status = "failed"  # type: ignore[union-attr]
            req.error_message = str(exc)[:500]
            db.commit()
        except Exception:
            pass
    finally:
        db.close()


def _send_ready_notification(db: Session, req: DataExportRequest) -> None:
    try:
        user = db.execute(select(User).where(User.id == req.user_id)).scalar_one_or_none()
        if not user:
            return
        from app.services.notification_service import NotificationService
        NotificationService.create_notification(
            db=db,
            user_id=req.user_id,
            notif_type="data_export",
            title="Your data export is ready",
            body="Your Rovvy data export has been prepared. Open the app to download it.",
            data={"request_id": str(req.id)},
        )
    except Exception as exc:
        logger.warning("Could not send export ready notification: %s", exc)


# ── Query helpers ─────────────────────────────────────────────────────────────

def get_export_request(db: Session, request_id: UUID, user_id: UUID) -> DataExportRequest:
    req = db.execute(
        select(DataExportRequest).where(
            DataExportRequest.id == request_id,
            DataExportRequest.user_id == user_id,
        )
    ).scalar_one_or_none()
    if not req:
        raise AppException.not_found("Export request not found")
    return req


def list_export_history(db: Session, user_id: UUID) -> list[DataExportRequest]:
    rows = db.execute(
        select(DataExportRequest)
        .where(DataExportRequest.user_id == user_id)
        .order_by(DataExportRequest.requested_at.desc())
        .limit(20)
    ).scalars().all()
    return list(rows)
