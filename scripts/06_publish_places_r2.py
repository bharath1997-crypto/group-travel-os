#!/usr/bin/env python3
"""
Publish verified Overture places artifact + manifest to Cloudflare R2 (cold storage).

Requires boto3 and R2 env vars for live upload. --dry-run validates locally only.

Layout:
  overture/places/{release_id}/{region_key}/places.parquet
  overture/places/{release_id}/{region_key}/manifest.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]

_KEY_SEGMENT_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$")


class R2PublishConflictError(RuntimeError):
    """Existing cold artifact hash does not match local file."""


class R2PublishSafetyError(RuntimeError):
    """Remote object state prevents safe upload."""


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def validate_key_segment(label: str, value: str) -> str:
    v = value.strip()
    if not v or not _KEY_SEGMENT_RE.match(v):
        raise ValueError(f"invalid {label}: {value!r}")
    if ".." in v or "/" in v or "\\" in v:
        raise ValueError(f"invalid {label}: {value!r}")
    return v


def object_keys(release_id: str, region_key: str) -> tuple[str, str]:
    rid = validate_key_segment("release_id", release_id)
    rk = validate_key_segment("region_key", region_key)
    base = f"overture/places/{rid}/{rk}"
    return f"{base}/places.parquet", f"{base}/manifest.json"


def build_manifest(
    *,
    release_id: str,
    region_key: str,
    schema_version: str,
    row_count: int,
    sha256: str,
    object_key: str,
) -> dict[str, Any]:
    return {
        "dataset": "overture_places",
        "release_id": release_id,
        "region_key": region_key,
        "schema_version": schema_version,
        "row_count": row_count,
        "sha256": sha256,
        "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "object_key": object_key,
    }


def parquet_row_count(path: Path) -> int:
    import duckdb

    con = duckdb.connect()
    try:
        row = con.execute("SELECT count(*)::BIGINT FROM read_parquet(?)", [str(path)]).fetchone()
    except Exception as exc:
        raise ValueError(f"invalid or unreadable parquet: {exc}") from exc
    if row is None:
        raise ValueError("invalid parquet: empty metadata")
    return int(row[0])


def r2_client_from_env():
    try:
        import boto3
    except ImportError as exc:
        raise RuntimeError(
            "boto3 is required for R2 upload. Install with: pip install boto3"
        ) from exc

    endpoint = os.environ.get("R2_ENDPOINT_URL", "").strip()
    access_key = os.environ.get("R2_ACCESS_KEY_ID", "").strip()
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY", "").strip()
    bucket = os.environ.get("R2_BUCKET", "").strip()
    if not all([endpoint, access_key, secret_key, bucket]):
        raise RuntimeError(
            "Missing R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, or R2_BUCKET"
        )
    client = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
    )
    return client, bucket


def _is_not_found(exc: Exception) -> bool:
    response = getattr(exc, "response", None)
    if isinstance(response, dict):
        code = str(response.get("Error", {}).get("Code", ""))
        status = response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        if code in ("404", "NoSuchKey", "NotFound") or status == 404:
            return True
    try:
        from botocore.exceptions import ClientError
    except ImportError:
        return False
    if isinstance(exc, ClientError):
        code = str(exc.response.get("Error", {}).get("Code", ""))
        status = exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        return code in ("404", "NoSuchKey", "NotFound") or status == 404
    return False


def head_object_exists(client, bucket: str, key: str) -> bool:
    try:
        client.head_object(Bucket=bucket, Key=key)
        return True
    except Exception as exc:
        if _is_not_found(exc):
            return False
        raise


def read_manifest_sha256(client, bucket: str, manifest_key: str) -> str | None:
    try:
        resp = client.get_object(Bucket=bucket, Key=manifest_key)
        body = resp["Body"].read().decode("utf-8")
    except Exception as exc:
        if _is_not_found(exc):
            return None
        raise
    try:
        data = json.loads(body)
    except json.JSONDecodeError as exc:
        raise R2PublishSafetyError(f"malformed manifest JSON at {manifest_key}") from exc
    if not isinstance(data, dict):
        raise R2PublishSafetyError(f"malformed manifest at {manifest_key}")
    sha = data.get("sha256")
    if sha is None or not str(sha).strip():
        raise R2PublishSafetyError(f"manifest missing sha256 at {manifest_key}")
    return str(sha).strip()


def ensure_publish_allowed(*, expected_sha256: str, existing_sha256: str | None) -> str:
    if not existing_sha256:
        return "upload"
    if existing_sha256 == expected_sha256:
        return "skip"
    raise R2PublishConflictError(
        f"Manifest already exists with different sha256 (remote={existing_sha256}, local={expected_sha256})"
    )


def evaluate_remote_state(
    client,
    bucket: str,
    *,
    parquet_key: str,
    manifest_key: str,
    expected_sha256: str,
) -> str:
    parquet_exists = head_object_exists(client, bucket, parquet_key)
    manifest_sha = read_manifest_sha256(client, bucket, manifest_key)
    manifest_exists = manifest_sha is not None

    if parquet_exists and not manifest_exists:
        raise R2PublishSafetyError(
            f"parquet object exists without valid manifest ({parquet_key})"
        )
    if manifest_exists and not parquet_exists:
        raise R2PublishSafetyError(
            f"manifest exists without parquet object ({parquet_key})"
        )
    if not parquet_exists and not manifest_exists:
        return "upload"
    return ensure_publish_allowed(expected_sha256=expected_sha256, existing_sha256=manifest_sha)


def upload_r2(client, bucket: str, local_path: Path, object_key: str, *, content_type: str) -> None:
    client.upload_file(
        str(local_path),
        bucket,
        object_key,
        ExtraArgs={"ContentType": content_type},
    )


def prepare_local_artifact(artifact: Path, *, expected_row_count: int) -> tuple[str, int]:
    if not artifact.is_file():
        raise FileNotFoundError(f"artifact missing: {artifact}")
    actual_rows = parquet_row_count(artifact)
    if actual_rows != expected_row_count:
        raise ValueError(
            f"row-count mismatch: parquet has {actual_rows} rows, expected {expected_row_count}"
        )
    return sha256_file(artifact), actual_rows


def publish(
    *,
    artifact: Path,
    release_id: str,
    region_key: str,
    schema_version: str,
    row_count: int,
    dry_run: bool,
    client=None,
    bucket: str | None = None,
) -> dict[str, Any]:
    digest, verified_rows = prepare_local_artifact(artifact, expected_row_count=row_count)
    parquet_key, manifest_key = object_keys(release_id, region_key)
    manifest = build_manifest(
        release_id=validate_key_segment("release_id", release_id),
        region_key=validate_key_segment("region_key", region_key),
        schema_version=schema_version,
        row_count=verified_rows,
        sha256=digest,
        object_key=parquet_key,
    )

    if dry_run:
        return {"dry_run": True, "parquet_key": parquet_key, "manifest": manifest}

    if client is None or bucket is None:
        client, bucket = r2_client_from_env()

    mode = evaluate_remote_state(
        client,
        bucket,
        parquet_key=parquet_key,
        manifest_key=manifest_key,
        expected_sha256=digest,
    )
    if mode == "skip":
        return {
            "uploaded": False,
            "idempotent": True,
            "parquet_key": parquet_key,
            "manifest_key": manifest_key,
        }

    upload_r2(client, bucket, artifact, parquet_key, content_type="application/octet-stream")
    manifest_path = artifact.with_suffix(".manifest.json")
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    try:
        upload_r2(client, bucket, manifest_path, manifest_key, content_type="application/json")
    finally:
        manifest_path.unlink(missing_ok=True)
    return {"uploaded": True, "parquet_key": parquet_key, "manifest_key": manifest_key}


def main() -> int:
    parser = argparse.ArgumentParser(description="Publish Overture places artifact to R2.")
    parser.add_argument("--artifact", type=Path, required=True, help="Local places.parquet path")
    parser.add_argument("--release-id", required=True)
    parser.add_argument("--region-key", required=True)
    parser.add_argument("--schema-version", default="1")
    parser.add_argument("--row-count", type=int, required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    try:
        result = publish(
            artifact=args.artifact.resolve(),
            release_id=args.release_id,
            region_key=args.region_key,
            schema_version=args.schema_version,
            row_count=args.row_count,
            dry_run=args.dry_run,
        )
    except R2PublishConflictError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    except (R2PublishSafetyError, ValueError, FileNotFoundError) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print(json.dumps(result, indent=2) if result.get("dry_run") else json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
