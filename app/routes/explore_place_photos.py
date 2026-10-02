"""User photo uploads for Explore places (moderated; never public until approved)."""
from __future__ import annotations

import re
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.models.user import User
from app.services import place_photo_upload_service as photos
from app.utils.auth import get_current_user
from app.utils.database import get_db

router = APIRouter(prefix="/explore", tags=["Explore place photos"])

_GERS_ID = re.compile(r"^[0-9a-fA-F-]{8,64}$")
_LOCAL_FILE = re.compile(r"^[0-9a-f-]{36}(_thumb)?\.jpg$")


@router.post("/places/{gers_id}/photos", status_code=status.HTTP_201_CREATED)
async def upload_place_photo(
    gers_id: str,
    file: UploadFile = File(...),
    caption: str | None = Form(None, max_length=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    if not _GERS_ID.match(gers_id) or not photos.place_exists(db, gers_id):
        raise HTTPException(status_code=404, detail="Place not found")
    if photos.uploads_in_last_day(db, current_user.id) >= photos.DAILY_UPLOAD_LIMIT:
        raise HTTPException(status_code=429, detail="Daily photo upload limit reached; try again tomorrow")

    data = await file.read(photos.MAX_UPLOAD_BYTES + 1)
    try:
        processed = photos.process_image(data)
    except photos.PhotoRejected as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    media_id = uuid.uuid4()
    try:
        storage_url, thumbnail_url = photos.store_photo(processed, media_id)
    except photos.UploadsNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    photos.record_upload(
        db,
        gers_id=gers_id,
        user_id=current_user.id,
        media_id=media_id,
        storage_url=storage_url,
        thumbnail_url=thumbnail_url,
        caption=caption,
    )
    return {
        "id": str(media_id),
        "status": "pending",
        "message": "Thanks! Your photo will appear after review.",
    }


@router.get("/place-photos/files/{name}", include_in_schema=False)
def local_place_photo(name: str) -> FileResponse:
    """Development-only file server for the local storage backend."""
    path = photos.LOCAL_DIR / name
    if not photos._local_uploads_allowed() or not _LOCAL_FILE.match(name) or not path.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path, media_type="image/jpeg")
