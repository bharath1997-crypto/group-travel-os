"""User place photo uploads: privacy (EXIF/GPS stripped), validation, endpoint status codes."""
from __future__ import annotations

import io
import uuid
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.services import place_photo_upload_service as photos
from app.utils.auth import get_current_user
from app.utils.database import get_db

GERS = "5d1bbd9b-7a0d-4427-ba73-632cc1dc3f84"
URL = f"/api/v1/explore/places/{GERS}/photos"


def _jpeg_with_gps(size=(3000, 2000)) -> bytes:
    img = Image.new("RGB", size, (30, 120, 90))
    exif = Image.Exif()
    exif[0x010F] = "TestCam"  # Make
    gps = exif.get_ifd(0x8825)
    gps[2] = (41.0, 52.0, 41.0)  # GPSLatitude
    gps[1] = "N"
    out = io.BytesIO()
    img.save(out, format="JPEG", exif=exif)
    return out.getvalue()


def test_process_strips_exif_and_gps_and_resizes() -> None:
    raw = _jpeg_with_gps()
    assert Image.open(io.BytesIO(raw)).getexif().get_ifd(0x8825), "fixture must carry GPS"

    processed = photos.process_image(raw)
    full = Image.open(io.BytesIO(processed.full))
    thumb = Image.open(io.BytesIO(processed.thumbnail))
    assert max(full.size) == photos.FULL_MAX_PX
    assert max(thumb.size) == photos.THUMB_MAX_PX
    for img in (full, thumb):
        assert img.format == "JPEG"
        assert len(img.getexif()) == 0
        assert not img.getexif().get_ifd(0x8825)


@pytest.mark.parametrize(
    ("data", "message"),
    [
        (b"", "Empty file"),
        (b"not an image at all", "Could not read this image"),
        (b"x" * (photos.MAX_UPLOAD_BYTES + 1), "larger than 10 MB"),
    ],
    ids=["empty", "garbage", "too-large"],
)
def test_process_rejects_bad_input(data, message) -> None:
    with pytest.raises(photos.PhotoRejected, match=message):
        photos.process_image(data)


def test_process_rejects_gif() -> None:
    out = io.BytesIO()
    Image.new("RGB", (10, 10)).save(out, format="GIF")
    with pytest.raises(photos.PhotoRejected, match="JPEG, PNG or WebP"):
        photos.process_image(out.getvalue())


def _clear_r2(monkeypatch) -> None:
    for key in photos.R2_ENV:
        monkeypatch.delenv(key, raising=False)


def test_store_uploads_both_renditions_to_r2(monkeypatch) -> None:
    for key, value in {
        "R2_ENDPOINT_URL": "https://acct.r2.cloudflarestorage.com",
        "R2_ACCESS_KEY_ID": "id",
        "R2_SECRET_ACCESS_KEY": "secret",
        "R2_MEDIA_BUCKET": "rovvy-place-media",
        "R2_MEDIA_PUBLIC_BASE_URL": "https://media.rovvy.app/",
    }.items():
        monkeypatch.setenv(key, value)
    client = MagicMock()
    monkeypatch.setattr(photos, "_r2_client", lambda config: client)
    media_id = uuid.uuid4()

    full_url, thumb_url = photos.store_photo(photos.ProcessedPhoto(b"full", b"thumb"), media_id)

    assert full_url == f"https://media.rovvy.app/place-media/{media_id}.jpg"
    assert thumb_url == f"https://media.rovvy.app/place-media/{media_id}_thumb.jpg"
    puts = [call.kwargs for call in client.put_object.call_args_list]
    assert [p["Key"] for p in puts] == [f"place-media/{media_id}.jpg", f"place-media/{media_id}_thumb.jpg"]
    assert all(p["Bucket"] == "rovvy-place-media" and p["ContentType"] == "image/jpeg" for p in puts)
    assert [p["Body"] for p in puts] == [b"full", b"thumb"]


def test_partial_r2_config_is_ignored(monkeypatch) -> None:
    _clear_r2(monkeypatch)
    monkeypatch.setenv("R2_MEDIA_BUCKET", "only-bucket")
    assert photos.r2_config() is None


def test_store_without_bucket_outside_dev_is_not_configured(monkeypatch) -> None:
    _clear_r2(monkeypatch)
    monkeypatch.setattr(photos, "_local_uploads_allowed", lambda: False)
    with pytest.raises(photos.UploadsNotConfigured):
        photos.store_photo(photos.ProcessedPhoto(b"a", b"b"), uuid.uuid4())


def test_store_local_dev_writes_both_files(monkeypatch, tmp_path) -> None:
    _clear_r2(monkeypatch)
    monkeypatch.setattr(photos, "_local_uploads_allowed", lambda: True)
    monkeypatch.setattr(photos, "LOCAL_DIR", tmp_path)
    media_id = uuid.uuid4()
    full_url, thumb_url = photos.store_photo(photos.ProcessedPhoto(b"full", b"thumb"), media_id)
    assert (tmp_path / f"{media_id}.jpg").read_bytes() == b"full"
    assert (tmp_path / f"{media_id}_thumb.jpg").read_bytes() == b"thumb"
    assert full_url.endswith(f"{photos.LOCAL_FILES_ROUTE}/{media_id}.jpg")
    assert thumb_url.endswith(f"{media_id}_thumb.jpg")


# ── endpoint ──────────────────────────────────────────────────────────────

@pytest.fixture()
def client(monkeypatch):
    user = MagicMock(id=uuid.uuid4(), is_active=True)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: MagicMock()
    monkeypatch.setattr(photos, "place_exists", lambda db, g: g == GERS)
    monkeypatch.setattr(photos, "uploads_in_last_day", lambda db, uid: 0)
    recorded: list[dict] = []
    monkeypatch.setattr(photos, "record_upload", lambda db, **kw: recorded.append(kw))
    monkeypatch.setattr(photos, "store_photo", lambda p, mid: (f"https://cdn.test/{mid}.jpg", f"https://cdn.test/{mid}_thumb.jpg"))
    yield TestClient(app), recorded, user
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_db, None)


def _upload(c: TestClient, data: bytes, url: str = URL, **form):
    return c.post(url, files={"file": ("p.jpg", data, "image/jpeg")}, data=form)


def test_upload_happy_path_records_pending(client) -> None:
    c, recorded, user = client
    response = _upload(c, _jpeg_with_gps((800, 600)), caption="Fountain at dusk")
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    assert recorded[0]["gers_id"] == GERS
    assert recorded[0]["user_id"] == user.id
    assert recorded[0]["caption"] == "Fountain at dusk"
    assert recorded[0]["storage_url"] == f"https://cdn.test/{body['id']}.jpg"


def test_upload_unknown_place_is_404(client) -> None:
    c, recorded, _ = client
    other = "aaaaaaaa-0000-0000-0000-000000000000"
    assert _upload(c, _jpeg_with_gps((50, 50)), url=f"/api/v1/explore/places/{other}/photos").status_code == 404
    assert _upload(c, _jpeg_with_gps((50, 50)), url="/api/v1/explore/places/not!valid/photos").status_code == 404
    assert recorded == []


def test_upload_bad_image_is_422(client) -> None:
    c, recorded, _ = client
    assert _upload(c, b"definitely not a photo").status_code == 422
    assert recorded == []


def test_upload_daily_limit_is_429(client, monkeypatch) -> None:
    c, recorded, _ = client
    monkeypatch.setattr(photos, "uploads_in_last_day", lambda db, uid: photos.DAILY_UPLOAD_LIMIT)
    assert _upload(c, _jpeg_with_gps((50, 50))).status_code == 429
    assert recorded == []


def test_upload_without_storage_is_503(client, monkeypatch) -> None:
    c, recorded, _ = client

    def not_configured(p, mid):
        raise photos.UploadsNotConfigured("Photo uploads are not configured (set the R2_* media settings)")

    monkeypatch.setattr(photos, "store_photo", not_configured)
    response = _upload(c, _jpeg_with_gps((50, 50)))
    assert response.status_code == 503
    assert "R2_" in response.json()["detail"]
    assert recorded == []


def test_local_file_route_rejects_path_tricks(monkeypatch) -> None:
    monkeypatch.setattr(photos, "_local_uploads_allowed", lambda: True)
    c = TestClient(app)
    assert c.get("/api/v1/explore/place-photos/files/..%2F..%2F.env").status_code == 404
    assert c.get("/api/v1/explore/place-photos/files/notauuid.jpg").status_code == 404
