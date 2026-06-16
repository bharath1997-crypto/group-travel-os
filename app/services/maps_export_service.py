"""
app/services/maps_export_service.py — Export saved places as GeoJSON

Builds a standards-compliant GeoJSON FeatureCollection from the user's SavedPin
rows.  Reuses the existing _store_export helper from data_export_service.
An empty FeatureCollection is returned when the user has no saved places.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.data_export import DataExportRequest
from app.models.saved_pin import SavedPin

logger = logging.getLogger(__name__)

_EXPORT_TTL_HOURS = 24


# ── Request creation ──────────────────────────────────────────────────────────

def create_maps_export_request(db: Session, user_id: UUID) -> DataExportRequest:
    req = DataExportRequest(
        user_id=user_id,
        export_type="maps",
        format="geojson",
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


# ── GeoJSON builder ───────────────────────────────────────────────────────────

def _collect_pins(db: Session, user_id: UUID) -> list[SavedPin]:
    return list(
        db.execute(
            select(SavedPin)
            .where(SavedPin.user_id == user_id)
            .order_by(SavedPin.created_at.desc())
        ).scalars().all()
    )


def _pin_to_feature(pin: SavedPin) -> dict:
    return {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [pin.longitude, pin.latitude],
        },
        "properties": {
            "id": str(pin.id),
            "name": pin.name,
            "address": None,           # SavedPin has no address field
            "category": pin.flag_type,
            "notes": pin.note,
            "is_visited": None,        # SavedPin has no is_visited field
            "created_at": pin.created_at.isoformat() if pin.created_at else None,
        },
    }


def build_geojson(pins: list[SavedPin]) -> bytes:
    """Returns a GeoJSON FeatureCollection as UTF-8 bytes."""
    collection = {
        "type": "FeatureCollection",
        "features": [_pin_to_feature(p) for p in pins],
        "metadata": {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "feature_count": len(pins),
            "source": "Rovvy",
        },
    }
    return json.dumps(collection, indent=2, default=str).encode("utf-8")


# ── Background task ───────────────────────────────────────────────────────────

def process_maps_export(request_id: str) -> None:
    """
    Background task: collect pins, build GeoJSON, store file, update DB row.
    """
    from app.services.data_export_service import _store_export
    from app.utils.database import SessionLocal

    db = SessionLocal()
    try:
        req = db.execute(
            select(DataExportRequest).where(DataExportRequest.id == UUID(request_id))
        ).scalar_one_or_none()
        if not req:
            logger.error("Maps export request %s not found", request_id)
            return

        req.status = "processing"
        db.commit()

        pins = _collect_pins(db, req.user_id)
        geojson_bytes = build_geojson(pins)
        file_url, file_size_kb = _store_export(req.id, geojson_bytes)

        now = datetime.now(timezone.utc)
        req.status = "ready"
        req.file_url = file_url
        req.file_size_kb = file_size_kb
        req.ready_at = now
        req.expires_at = now + timedelta(hours=_EXPORT_TTL_HOURS)
        db.commit()

        logger.info("Maps export %s ready — %d pins, %d KB", request_id, len(pins), file_size_kb)

    except Exception as exc:
        logger.exception("Maps export %s failed: %s", request_id, exc)
        try:
            req.status = "failed"  # type: ignore[union-attr]
            req.error_message = str(exc)[:500]
            db.commit()
        except Exception:
            pass
    finally:
        db.close()


# ── Query helpers (shared with route) ────────────────────────────────────────

def get_maps_export_request(
    db: Session, request_id: UUID, user_id: UUID
) -> DataExportRequest:
    from app.services.data_export_service import get_export_request
    return get_export_request(db, request_id, user_id)


def list_maps_export_history(db: Session, user_id: UUID) -> list[DataExportRequest]:
    return list(
        db.execute(
            select(DataExportRequest)
            .where(
                DataExportRequest.user_id == user_id,
                DataExportRequest.export_type == "maps",
            )
            .order_by(DataExportRequest.requested_at.desc())
            .limit(20)
        ).scalars().all()
    )
