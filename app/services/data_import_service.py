"""
app/services/data_import_service.py — Import saved places and trips

Supported formats:
  - GeoJSON FeatureCollection (places)
  - GPX waypoints             (places)
  - CSV                       (places or trips)

Flow:
  1. parse_file()         → list of raw parsed rows
  2. classify_rows()      → splits into valid / duplicate / error
  3. create_preview()     → persists DataImportRequest(status=preview)
  4. confirm_import()     → inserts valid rows, updates status=imported
"""
from __future__ import annotations

import csv
import io
import json
import logging
import re
import secrets
import xml.etree.ElementTree as ET
from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.data_import import DataImportRequest
from app.models.group import Group, GroupMember, MemberRole
from app.models.saved_pin import SavedPin
from app.models.trip import Trip, TripStatus
from app.models.trip_roster import TripRoster
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

MAX_FILE_BYTES = 10 * 1024 * 1024          # 10 MB
ALLOWED_EXTENSIONS = {".geojson", ".json", ".gpx", ".csv"}
_DUPLICATE_DEGREES = 0.0001                # ≈11 m


# ── File validation ───────────────────────────────────────────────────────────

def validate_upload(filename: str | None, content: bytes) -> str:
    """
    Returns the detected format string ("geojson", "gpx", "csv").
    Raises AppException on invalid size or extension.
    """
    if len(content) > MAX_FILE_BYTES:
        raise AppException.bad_request("File too large — maximum size is 10 MB")

    ext = ""
    if filename:
        ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext not in ALLOWED_EXTENSIONS:
        raise AppException.bad_request(
            f"Unsupported file type '{ext}'. "
            "Allowed: .geojson, .json, .gpx, .csv"
        )

    if ext in (".geojson", ".json"):
        return "geojson"
    if ext == ".gpx":
        return "gpx"
    return "csv"


# ── Parsers ───────────────────────────────────────────────────────────────────

def _parse_geojson(content: bytes) -> list[dict[str, Any]]:
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        raise AppException.bad_request(f"Invalid JSON: {e}") from e

    if data.get("type") != "FeatureCollection":
        raise AppException.bad_request("Expected a GeoJSON FeatureCollection")

    rows: list[dict[str, Any]] = []
    for feature in data.get("features", []):
        geom = feature.get("geometry") or {}
        props = feature.get("properties") or {}
        if geom.get("type") != "Point":
            continue
        coords = geom.get("coordinates", [])
        if len(coords) < 2:
            continue
        rows.append({
            "name":      str(props.get("name") or "Unnamed Place"),
            "latitude":  float(coords[1]),
            "longitude": float(coords[0]),
            "address":   props.get("address"),
            "category":  props.get("category") or props.get("flag_type"),
            "notes":     props.get("notes") or props.get("note"),
        })
    return rows


def _parse_gpx(content: bytes) -> list[dict[str, Any]]:
    try:
        root = ET.fromstring(content)
    except ET.ParseError as e:
        raise AppException.bad_request(f"Invalid GPX/XML: {e}") from e

    # GPX 1.1 namespace; fall back to no-namespace
    ns_map = {"g": "http://www.topografix.com/GPX/1/1"}
    waypoints = root.findall("g:wpt", ns_map)
    if not waypoints:
        waypoints = root.findall("wpt")

    rows: list[dict[str, Any]] = []
    for wpt in waypoints:
        lat = wpt.get("lat")
        lon = wpt.get("lon")
        if lat is None or lon is None:
            continue
        name_el = wpt.find("{http://www.topografix.com/GPX/1/1}name")
        if name_el is None:
            name_el = wpt.find("name")
        desc_el = wpt.find("{http://www.topografix.com/GPX/1/1}desc")
        if desc_el is None:
            desc_el = wpt.find("desc")
        rows.append({
            "name":      (name_el.text if name_el is not None else "Waypoint"),
            "latitude":  float(lat),
            "longitude": float(lon),
            "address":   None,
            "category":  None,
            "notes":     (desc_el.text if desc_el is not None else None),
        })
    return rows


def _parse_csv_places(content: bytes) -> list[dict[str, Any]]:
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    required = {"name", "latitude", "longitude"}
    if reader.fieldnames is None:
        raise AppException.bad_request("CSV file is empty")
    cols = {c.strip().lower() for c in reader.fieldnames}
    missing = required - cols
    if missing:
        raise AppException.bad_request(
            f"CSV missing required columns: {', '.join(sorted(missing))}"
        )

    rows: list[dict[str, Any]] = []
    for row in reader:
        r = {k.strip().lower(): (v.strip() if v else None) for k, v in row.items()}
        rows.append({
            "name":      r.get("name") or "Unnamed",
            "latitude":  r.get("latitude"),
            "longitude": r.get("longitude"),
            "address":   r.get("address"),
            "category":  r.get("category"),
            "notes":     r.get("notes"),
        })
    return rows


def _parse_csv_trips(content: bytes) -> list[dict[str, Any]]:
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    required = {"title", "start_date", "end_date"}
    if reader.fieldnames is None:
        raise AppException.bad_request("CSV file is empty")
    cols = {c.strip().lower() for c in reader.fieldnames}
    missing = required - cols
    if missing:
        raise AppException.bad_request(
            f"CSV missing required columns: {', '.join(sorted(missing))}"
        )

    rows: list[dict[str, Any]] = []
    for row in reader:
        r = {k.strip().lower(): (v.strip() if v else None) for k, v in row.items()}
        rows.append({
            "title":       r.get("title") or "Untitled",
            "start_date":  r.get("start_date"),
            "end_date":    r.get("end_date"),
            "description": r.get("description"),
        })
    return rows


def parse_file(
    content: bytes,
    fmt: str,
    import_type: str,
) -> list[dict[str, Any]]:
    if fmt == "geojson":
        return _parse_geojson(content)
    if fmt == "gpx":
        return _parse_gpx(content)
    # csv
    if import_type == "trips":
        return _parse_csv_trips(content)
    return _parse_csv_places(content)


# ── Duplicate detection ───────────────────────────────────────────────────────

def _load_existing_pins(db: Session, user_id: UUID) -> list[tuple[float, float, str]]:
    pins = db.execute(
        select(SavedPin).where(SavedPin.user_id == user_id)
    ).scalars().all()
    return [(p.latitude, p.longitude, p.name.lower()) for p in pins]


def _is_duplicate_place(
    lat: float,
    lon: float,
    name: str,
    existing: list[tuple[float, float, str]],
) -> bool:
    name_lower = name.lower()
    for ex_lat, ex_lon, ex_name in existing:
        if (
            abs(ex_lat - lat) < _DUPLICATE_DEGREES
            and abs(ex_lon - lon) < _DUPLICATE_DEGREES
        ):
            return True
        if ex_name == name_lower and abs(ex_lat - lat) < 0.001:
            return True
    return False


def _load_existing_trips(db: Session, user_id: UUID) -> list[tuple[str, str | None]]:
    """Returns (title_lower, start_date_str) for trips the user is on."""
    roster_rows = db.execute(
        select(TripRoster).where(TripRoster.user_id == user_id)
    ).scalars().all()
    trip_ids = [r.trip_id for r in roster_rows]
    if not trip_ids:
        return []
    trips = db.execute(
        select(Trip).where(Trip.id.in_(trip_ids))
    ).scalars().all()
    return [(t.title.lower(), str(t.start_date) if t.start_date else None) for t in trips]


def _is_duplicate_trip(
    title: str,
    start_date: str | None,
    existing: list[tuple[str, str | None]],
) -> bool:
    title_lower = title.lower()
    for ex_title, ex_date in existing:
        if ex_title == title_lower and ex_date == start_date:
            return True
    return False


# ── Row classification ────────────────────────────────────────────────────────

def _classify_place_row(
    idx: int,
    row: dict[str, Any],
    existing: list[tuple[float, float, str]],
) -> dict[str, Any]:
    """Returns a classified preview row dict."""
    name = str(row.get("name") or "")
    if not name:
        return {"index": idx, "status": "error", "data": row, "reason": "Missing name"}
    try:
        lat = float(row["latitude"])
        lon = float(row["longitude"])
    except (TypeError, ValueError, KeyError):
        return {"index": idx, "status": "error", "data": row, "reason": "Invalid coordinates"}

    if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        return {"index": idx, "status": "error", "data": row, "reason": "Coordinates out of range"}

    # Normalize into the final insert shape
    clean: dict[str, Any] = {
        "name": name,
        "latitude": lat,
        "longitude": lon,
        "flag_type": str(row.get("category") or "dream"),
        "note": row.get("notes"),
    }

    if _is_duplicate_place(lat, lon, name, existing):
        return {"index": idx, "status": "duplicate", "data": clean, "reason": "Already saved"}

    return {"index": idx, "status": "valid", "data": clean, "reason": None}


def _classify_trip_row(
    idx: int,
    row: dict[str, Any],
    existing: list[tuple[str, str | None]],
) -> dict[str, Any]:
    title = str(row.get("title") or "")
    if not title:
        return {"index": idx, "status": "error", "data": row, "reason": "Missing title"}

    start_date = row.get("start_date")
    clean: dict[str, Any] = {
        "title": title,
        "start_date": start_date,
        "end_date": row.get("end_date"),
        "description": row.get("description"),
    }

    if _is_duplicate_trip(title, start_date, existing):
        return {"index": idx, "status": "duplicate", "data": clean, "reason": "Trip already exists"}

    return {"index": idx, "status": "valid", "data": clean, "reason": None}


def classify_rows(
    db: Session,
    user_id: UUID,
    import_type: str,
    rows: list[dict[str, Any]],
) -> tuple[list[dict], list[dict], list[dict]]:
    """
    Returns (valid_rows, duplicate_rows, error_rows).
    Each item is a classified preview row dict.
    """
    if import_type == "places":
        existing = _load_existing_pins(db, user_id)
        classified = [_classify_place_row(i, r, existing) for i, r in enumerate(rows)]
    else:
        existing_trips = _load_existing_trips(db, user_id)
        classified = [_classify_trip_row(i, r, existing_trips) for i, r in enumerate(rows)]

    valid      = [r for r in classified if r["status"] == "valid"]
    duplicates = [r for r in classified if r["status"] == "duplicate"]
    errors     = [r for r in classified if r["status"] == "error"]
    return valid, duplicates, errors


# ── Preview creation ──────────────────────────────────────────────────────────

def create_preview(
    db: Session,
    user_id: UUID,
    import_type: str,
    fmt: str,
    filename: str | None,
    valid: list[dict],
    duplicates: list[dict],
    errors: list[dict],
) -> DataImportRequest:
    req = DataImportRequest(
        user_id=user_id,
        import_type=import_type,
        format=fmt,
        status="preview",
        original_filename=filename,
        total_items=len(valid) + len(duplicates) + len(errors),
        valid_items=len(valid),
        duplicate_items=len(duplicates),
        error_items=len(errors),
        preview_data={
            "valid":      valid,
            "duplicates": duplicates,
            "errors":     errors,
        },
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


# ── Confirm import ────────────────────────────────────────────────────────────

def confirm_import(
    db: Session,
    import_id: UUID,
    user_id: UUID,
) -> DataImportRequest:
    req = db.execute(
        select(DataImportRequest).where(DataImportRequest.id == import_id)
    ).scalar_one_or_none()

    if req is None:
        raise AppException.not_found("Import request not found")
    if req.user_id != user_id:
        raise AppException.forbidden("You do not have access to this import")
    if req.status != "preview":
        raise AppException.bad_request(
            "This import has already been confirmed or failed"
        )

    valid_rows: list[dict] = req.preview_data.get("valid", [])
    imported = 0

    if req.import_type == "places":
        for row in valid_rows:
            d = row["data"]
            pin = SavedPin(
                user_id=user_id,
                name=d["name"],
                latitude=float(d["latitude"]),
                longitude=float(d["longitude"]),
                flag_type=d.get("flag_type") or "dream",
                note=d.get("note"),
            )
            db.add(pin)
            imported += 1

    elif req.import_type == "trips":
        if valid_rows:
            group = _get_or_create_import_group(db, user_id)
            for row in valid_rows:
                d = row["data"]
                start = _parse_date(d.get("start_date"))
                end   = _parse_date(d.get("end_date"))
                trip  = Trip(
                    group_id=group.id,
                    title=d["title"],
                    description=d.get("description"),
                    start_date=start,
                    end_date=end,
                    created_by=user_id,
                    status=TripStatus.planning,
                )
                db.add(trip)
                db.flush()   # get trip.id
                db.add(TripRoster(trip_id=trip.id, user_id=user_id))
                imported += 1

    now = datetime.now(timezone.utc)
    req.status = "imported"
    req.imported_at = now
    req.valid_items = imported    # may differ if some rows fail
    db.commit()
    db.refresh(req)
    return req


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def _get_or_create_import_group(db: Session, user_id: UUID) -> Group:
    """Find or create a personal 'Rovvy Imports' group for the user."""
    existing = db.execute(
        select(Group).where(
            Group.created_by == user_id,
            Group.name == "Rovvy Imports",
        )
    ).scalar_one_or_none()
    if existing:
        return existing

    code = secrets.token_hex(6)   # 12-char hex, unique enough
    group = Group(
        name="Rovvy Imports",
        group_type="regular",
        created_by=user_id,
        invite_code=code,
    )
    db.add(group)
    db.flush()
    db.add(GroupMember(group_id=group.id, user_id=user_id, role=MemberRole.admin))
    db.flush()
    return group


# ── History query ─────────────────────────────────────────────────────────────

def list_import_history(db: Session, user_id: UUID) -> list[DataImportRequest]:
    return list(
        db.execute(
            select(DataImportRequest)
            .where(DataImportRequest.user_id == user_id)
            .order_by(DataImportRequest.created_at.desc())
            .limit(20)
        ).scalars().all()
    )
