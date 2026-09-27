from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import duckdb
import pytest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "06_publish_places_r2.py"


class S3Error(Exception):
    def __init__(self, code: str, *, http_status: int | None = None) -> None:
        self.response = {
            "Error": {"Code": code, "Message": code},
            "ResponseMetadata": {"HTTPStatusCode": http_status or (404 if code in ("404", "NoSuchKey", "NotFound") else 403)},
        }
        super().__init__(code)


def _mod():
    spec = importlib.util.spec_from_file_location("publish_places_r2", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _write_parquet(path: Path, rows: int) -> None:
    con = duckdb.connect()
    con.execute(
        f"COPY (SELECT * FROM generate_series(1, {rows})) TO ? (FORMAT PARQUET)",
        [str(path)],
    )


def test_dry_run_real_parquet_row_count(tmp_path: Path) -> None:
    mod = _mod()
    artifact = tmp_path / "places.parquet"
    _write_parquet(artifact, 4)
    result = mod.publish(
        artifact=artifact,
        release_id="2026-03-18.0",
        region_key="chicago",
        schema_version="1",
        row_count=4,
        dry_run=True,
    )
    assert result["dry_run"] is True
    assert result["manifest"]["row_count"] == 4


def test_row_count_mismatch_rejected(tmp_path: Path) -> None:
    mod = _mod()
    artifact = tmp_path / "places.parquet"
    _write_parquet(artifact, 2)
    with pytest.raises(ValueError, match="row-count mismatch"):
        mod.prepare_local_artifact(artifact, expected_row_count=3)


def test_invalid_parquet_rejected(tmp_path: Path) -> None:
    mod = _mod()
    bad = tmp_path / "places.parquet"
    bad.write_bytes(b"not-parquet")
    with pytest.raises(ValueError, match="invalid"):
        mod.prepare_local_artifact(bad, expected_row_count=1)


def test_access_denied_propagates() -> None:
    mod = _mod()
    client = MagicMock()
    client.head_object.side_effect = S3Error("AccessDenied", http_status=403)
    with pytest.raises(S3Error):
        mod.head_object_exists(client, "bucket", "key")


def test_malformed_manifest_raises() -> None:
    mod = _mod()
    client = MagicMock()
    client.get_object.return_value = {"Body": MagicMock(read=lambda: b"{not-json")}
    with pytest.raises(mod.R2PublishSafetyError):
        mod.read_manifest_sha256(client, "b", "manifest.json")


def test_parquet_without_manifest_fails_safe() -> None:
    mod = _mod()
    client = MagicMock()
    err404 = S3Error("NoSuchKey")

    def head_side_effect(Bucket, Key):  # noqa: N803
        if Key.endswith("places.parquet"):
            return {}
        raise S3Error("404")

    client.head_object.side_effect = head_side_effect
    client.get_object.side_effect = err404
    with pytest.raises(mod.R2PublishSafetyError, match="without valid manifest"):
        mod.evaluate_remote_state(
            client,
            "b",
            parquet_key="overture/places/r/rk/places.parquet",
            manifest_key="overture/places/r/rk/manifest.json",
            expected_sha256="abc",
        )


def test_network_error_propagates_from_manifest_read() -> None:
    mod = _mod()
    client = MagicMock()
    client.get_object.side_effect = TimeoutError("network down")
    with pytest.raises(TimeoutError):
        mod.read_manifest_sha256(client, "b", "manifest.json")


def test_idempotent_skip_when_hashes_match() -> None:
    mod = _mod()
    assert mod.ensure_publish_allowed(expected_sha256="abc", existing_sha256="abc") == "skip"


def test_hash_conflict_returns_exit_code_2(tmp_path: Path) -> None:
    mod = _mod()
    artifact = tmp_path / "places.parquet"
    _write_parquet(artifact, 1)
    argv = [
        "06_publish_places_r2.py",
        "--artifact",
        str(artifact),
        "--release-id",
        "2026-03-18.0",
        "--region-key",
        "chicago",
        "--row-count",
        "1",
    ]
    with patch.object(sys, "argv", argv), patch.object(
        mod,
        "evaluate_remote_state",
        side_effect=mod.R2PublishConflictError("conflict"),
    ), patch.object(mod, "r2_client_from_env", return_value=(MagicMock(), "b")):
        rc = mod.main()
    assert rc == 2


def test_mocked_successful_upload_main(tmp_path: Path) -> None:
    mod = _mod()
    artifact = tmp_path / "places.parquet"
    _write_parquet(artifact, 2)

    client = MagicMock()
    missing = S3Error("404")

    client.head_object.side_effect = missing
    client.get_object.side_effect = missing
    client.upload_file = MagicMock()

    argv = [
        "06_publish_places_r2.py",
        "--artifact",
        str(artifact),
        "--release-id",
        "2026-03-18.0",
        "--region-key",
        "chicago",
        "--row-count",
        "2",
    ]
    with patch.object(sys, "argv", argv), patch.object(mod, "r2_client_from_env", return_value=(client, "b")):
        rc = mod.publish(
            artifact=artifact,
            release_id="2026-03-18.0",
            region_key="chicago",
            schema_version="1",
            row_count=2,
            dry_run=False,
            client=client,
            bucket="b",
        )
    assert rc["uploaded"] is True
    assert client.upload_file.call_count == 2
