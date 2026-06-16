"""
app/routes/data_import.py — Data import endpoints

POST   /api/v1/data/import/preview            — Upload file, get preview
POST   /api/v1/data/import/{import_id}/confirm — Confirm a previewed import
GET    /api/v1/data/import/history             — List past import requests
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.schemas.data_import import (
    ImportConfirmOut,
    ImportHistoryOut,
    ImportPreviewOut,
    ImportPreviewRow,
)
from app.services import data_import_service as svc
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(prefix="/data/import", tags=["Data Import"])


@router.post(
    "/preview",
    response_model=ImportPreviewOut,
    status_code=200,
    summary="Upload a file and return a preview of what would be imported",
)
async def preview_import(
    file: UploadFile = File(...),
    import_type: str = Form(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> ImportPreviewOut:
    content = await file.read()
    fmt = svc.validate_upload(file.filename, content)
    rows = svc.parse_file(content, fmt, import_type)
    valid, duplicates, errors = svc.classify_rows(db, current_user.id, import_type, rows)
    req = svc.create_preview(
        db, current_user.id, import_type, fmt,
        file.filename, valid, duplicates, errors,
    )

    all_classified = valid + duplicates + errors
    all_classified.sort(key=lambda r: r["index"])
    preview_rows = [
        ImportPreviewRow(
            index=r["index"],
            status=r["status"],
            data=r["data"],
            reason=r.get("reason"),
        )
        for r in all_classified[:10]
    ]

    return ImportPreviewOut(
        import_id=req.id,
        status=req.status,
        import_type=req.import_type,
        format=req.format,
        original_filename=req.original_filename,
        total_items=req.total_items,
        valid_items=req.valid_items,
        duplicate_items=req.duplicate_items,
        error_items=req.error_items,
        preview=preview_rows,
    )


@router.post(
    "/{import_id}/confirm",
    response_model=ImportConfirmOut,
    status_code=200,
    summary="Confirm a previewed import — inserts valid non-duplicate rows",
)
def confirm_import(
    import_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> ImportConfirmOut:
    req = svc.confirm_import(db, import_id, current_user.id)
    return ImportConfirmOut(
        import_id=req.id,
        status=req.status,
        import_type=req.import_type,
        imported_count=req.valid_items,
        skipped_duplicates=req.duplicate_items,
    )


@router.get(
    "/history",
    response_model=list[ImportHistoryOut],
    summary="List up to 20 past import requests for the current user",
)
def import_history(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> list[ImportHistoryOut]:
    rows = svc.list_import_history(db, current_user.id)
    return [ImportHistoryOut.model_validate(r) for r in rows]
