"""
app/routes/data_export.py — Data export endpoints

POST   /api/v1/data/export                       — Request a full account export
POST   /api/v1/data/export/trips                 — Request a trip export (JSON or ICS)
GET    /api/v1/data/export/history               — List past exports
GET    /api/v1/data/export/{request_id}          — Poll export status
GET    /api/v1/data/export/{request_id}/download — Stream local export file
"""
from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.schemas.data_export import (
    ExportHistoryOut,
    ExportMapsIn,
    ExportRequestIn,
    ExportStatusOut,
    ExportTripsIn,
)
from app.services import data_export_service as svc
from app.services import maps_export_service as maps_svc
from app.services import trip_export_service as trip_svc
from app.utils.auth import get_current_user
from app.utils.database import get_db
from app.utils.exceptions import AppException

router = APIRouter(prefix="/data", tags=["Data & Integrations"])


@router.post(
    "/export",
    response_model=ExportStatusOut,
    status_code=202,
    summary="Request a full account data export",
)
def request_export(
    body: ExportRequestIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> ExportStatusOut:
    req = svc.create_export_request(db, current_user.id, body.export_type)
    background_tasks.add_task(svc.process_export, str(req.id))
    return ExportStatusOut.model_validate(req)


@router.post(
    "/export/trips",
    response_model=ExportStatusOut,
    status_code=202,
    summary="Request an export of selected trips (JSON or ICS)",
)
def request_trip_export(
    body: ExportTripsIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> ExportStatusOut:
    req = trip_svc.create_trip_export_request(
        db, current_user.id, body.trip_ids, body.format
    )
    background_tasks.add_task(trip_svc.process_trip_export, str(req.id))
    return ExportStatusOut.model_validate(req)


@router.post(
    "/export/maps",
    response_model=ExportStatusOut,
    status_code=202,
    summary="Request an export of saved places as GeoJSON",
)
def request_maps_export(
    body: ExportMapsIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> ExportStatusOut:
    req = maps_svc.create_maps_export_request(db, current_user.id)
    background_tasks.add_task(maps_svc.process_maps_export, str(req.id))
    return ExportStatusOut.model_validate(req)


@router.get(
    "/export/history",
    response_model=list[ExportHistoryOut],
    summary="List up to 20 past export requests",
)
def export_history(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> list[ExportHistoryOut]:
    rows = svc.list_export_history(db, current_user.id)
    return [ExportHistoryOut.model_validate(r) for r in rows]


@router.get(
    "/export/{request_id}",
    response_model=ExportStatusOut,
    summary="Poll the status of a specific export request",
)
def get_export_status(
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> ExportStatusOut:
    req = svc.get_export_request(db, request_id, current_user.id)
    return ExportStatusOut.model_validate(req)


@router.get(
    "/export/{request_id}/download",
    summary="Download the export ZIP file (local storage only)",
)
def download_export(
    request_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> FileResponse:
    req = svc.get_export_request(db, request_id, current_user.id)

    if req.status != "ready":
        raise AppException.bad_request("Export is not ready yet")

    tmp_path = Path(f"/tmp/rovvy_exports/{request_id}.zip")
    if not tmp_path.exists():
        raise AppException.not_found("Export file not found; it may have expired")

    return FileResponse(
        path=str(tmp_path),
        media_type="application/zip",
        filename=f"rovvy_export_{request_id}.zip",
    )
