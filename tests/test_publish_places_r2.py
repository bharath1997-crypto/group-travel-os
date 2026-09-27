from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "06_publish_places_r2.py"


def _write_parquet(path: Path, rows: int) -> None:
    con = duckdb.connect()
    con.execute(
        f"COPY (SELECT * FROM generate_series(1, {rows})) TO ? (FORMAT PARQUET)",
        [str(path)],
    )


def test_dry_run_manifest_with_valid_parquet(tmp_path: Path) -> None:
    artifact = tmp_path / "places.parquet"
    _write_parquet(artifact, 42)
    proc = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--artifact",
            str(artifact),
            "--release-id",
            "2026-03-18.0",
            "--region-key",
            "chicago",
            "--row-count",
            "42",
            "--dry-run",
        ],
        capture_output=True,
        text=True,
        cwd=str(ROOT),
        check=False,
    )
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout)
    assert payload["dry_run"] is True
    assert payload["manifest"]["sha256"]
    assert payload["manifest"]["row_count"] == 42
    assert payload["parquet_key"] == "overture/places/2026-03-18.0/chicago/places.parquet"


def test_dry_run_rejects_invalid_parquet(tmp_path: Path) -> None:
    artifact = tmp_path / "places.parquet"
    artifact.write_bytes(b"not-a-parquet")
    proc = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--artifact",
            str(artifact),
            "--release-id",
            "2026-03-18.0",
            "--region-key",
            "chicago",
            "--row-count",
            "1",
            "--dry-run",
        ],
        capture_output=True,
        text=True,
        cwd=str(ROOT),
        check=False,
    )
    assert proc.returncode == 1
