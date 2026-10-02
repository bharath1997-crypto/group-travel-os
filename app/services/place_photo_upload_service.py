"""
User photo uploads for Explore places.

Every upload is re-encoded (EXIF incl. GPS dropped), resized, stored as two
JPEGs (full + thumbnail) and recorded in place_media as `pending`. Nothing is
shown publicly until an admin approves it (scripts/08_moderate_place_media.py).

Storage: Cloudflare R2 (S3 API, no egress fees) when R2_ENDPOINT_URL,
R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_MEDIA_BUCKET and
R2_MEDIA_PUBLIC_BASE_URL are set; else the local disk in development only.
"""
from __future__ import annotations

import io
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.models.place_registry import PlaceMedia
from config import settings

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
FULL_MAX_PX = 1600
THUMB_MAX_PX = 640
DAILY_UPLOAD_LIMIT = 10
LOCAL_DIR = Path(__file__).resolve().parents[2] / "data" / "place_media_uploads"
LOCAL_FILES_ROUTE = "/api/v1/explore/place-photos/files"
USER_ATTRIBUTION = "Rovvy community photo"


class PhotoRejected(ValueError):
    """The file is not an acceptable image (type, size, decode)."""


class UploadsNotConfigured(RuntimeError):
    """No storage backend is available in this environment."""


@dataclass(frozen=True)
class ProcessedPhoto:
    full: bytes
    thumbnail: bytes


def process_image(data: bytes) -> ProcessedPhoto:
    """Validate, orient, strip metadata (EXIF/GPS) and produce full + thumbnail JPEGs."""
    if not data:
        raise PhotoRejected("Empty file")
    if len(data) > MAX_UPLOAD_BYTES:
        raise PhotoRejected("Photo is larger than 10 MB")
    try:
        with Image.open(io.BytesIO(data)) as probe:
            fmt = probe.format
            probe.verify()
        if fmt not in ALLOWED_FORMATS:
            raise PhotoRejected("Use a JPEG, PNG or WebP photo")
        with Image.open(io.BytesIO(data)) as img:
            img = ImageOps.exif_transpose(img).convert("RGB")
            return ProcessedPhoto(full=_jpeg(img, FULL_MAX_PX), thumbnail=_jpeg(img, THUMB_MAX_PX))
    except PhotoRejected:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, SyntaxError) as exc:
        raise PhotoRejected("Could not read this image") from exc


def _jpeg(img: Image.Image, max_px: int) -> bytes:
    copy = img.copy()
    copy.thumbnail((max_px, max_px))
    out = io.BytesIO()
    # No exif= argument: the re-encoded file carries no camera or location metadata.
    copy.save(out, format="JPEG", quality=85, optimize=True)
    return out.getvalue()


def _local_uploads_allowed() -> bool:
    env = (settings.ENVIRONMENT or "").strip().lower()
    return bool(settings.DEBUG) or env in ("development", "dev", "local", "test")


R2_ENV = ("R2_ENDPOINT_URL", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_MEDIA_BUCKET", "R2_MEDIA_PUBLIC_BASE_URL")


def r2_config() -> dict[str, str] | None:
    """All R2 settings, or None when any is missing (same credential names as 06_publish_places_r2.py)."""
    values = {key: (os.environ.get(key) or "").strip() for key in R2_ENV}
    return values if all(values.values()) else None


def _r2_client(config: dict[str, str]):  # pragma: no cover - thin boto3 wrapper
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=config["R2_ENDPOINT_URL"],
        aws_access_key_id=config["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=config["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )


def store_photo(photo: ProcessedPhoto, media_id: uuid.UUID) -> tuple[str, str]:
    """Persist both renditions; returns (storage_url, thumbnail_url)."""
    names = (f"{media_id}.jpg", f"{media_id}_thumb.jpg")
    config = r2_config()
    if config:
        client = _r2_client(config)
        base = config["R2_MEDIA_PUBLIC_BASE_URL"].rstrip("/")
        for name, body in zip(names, (photo.full, photo.thumbnail)):
            client.put_object(
                Bucket=config["R2_MEDIA_BUCKET"],
                Key=f"place-media/{name}",
                Body=body,
                ContentType="image/jpeg",
                CacheControl="public, max-age=31536000, immutable",
            )
        return f"{base}/place-media/{names[0]}", f"{base}/place-media/{names[1]}"
    if _local_uploads_allowed():
        LOCAL_DIR.mkdir(parents=True, exist_ok=True)
        for name, body in zip(names, (photo.full, photo.thumbnail)):
            (LOCAL_DIR / name).write_bytes(body)
        base = (settings.API_PUBLIC_URL or "http://localhost:8000").rstrip("/")
        return f"{base}{LOCAL_FILES_ROUTE}/{names[0]}", f"{base}{LOCAL_FILES_ROUTE}/{names[1]}"
    raise UploadsNotConfigured("Photo uploads are not configured (set the R2_* media settings)")


def place_exists(db: Session, gers_id: str) -> bool:
    if db.bind is None or db.bind.dialect.name != "postgresql":
        return False
    return bool(db.execute(text("SELECT 1 FROM places WHERE gers_id = :g"), {"g": gers_id}).scalar())


def uploads_in_last_day(db: Session, user_id: uuid.UUID) -> int:
    since = datetime.now(timezone.utc) - timedelta(days=1)
    return int(
        db.execute(
            select(func.count())
            .select_from(PlaceMedia)
            .where(PlaceMedia.created_by == user_id, PlaceMedia.source == "rovvy_user", PlaceMedia.created_at >= since)
        ).scalar_one()
    )


def record_upload(
    db: Session,
    *,
    gers_id: str,
    user_id: uuid.UUID,
    media_id: uuid.UUID,
    storage_url: str,
    thumbnail_url: str,
    caption: str | None,
) -> PlaceMedia:
    row = PlaceMedia(
        id=media_id,
        place_key=f"gers:{gers_id}",
        thumbnail_url=thumbnail_url,
        storage_url=storage_url,
        caption=(caption or "").strip()[:200] or None,
        tags=["user_upload"],
        source="rovvy_user",
        attribution=USER_ATTRIBUTION,
        license=None,
        moderation_status="pending",
        created_by=user_id,
    )
    db.add(row)
    db.commit()
    return row
