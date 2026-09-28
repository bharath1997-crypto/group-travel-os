#!/usr/bin/env python3
"""
Step 1 — extract Overture Places for the launch-city bbox.

Uses the overturemaps CLI (anonymous S3 access — no AWS credentials).

Usage:
    pip install overturemaps
    python scripts/01_extract.py --city Chicago --bbox -87.94,41.64,-87.52,42.03

Environment (optional defaults):
    ROVVY_LAUNCH_CITY   Launch city label (printed in logs)
    ROVVY_BBOX          minlon,minlat,maxlon,maxlat

Output:
    data/raw.geojson

On success prints the feature row count.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "data" / "raw.geojson"

# Spec §1 example — Chicago metro
DEFAULT_CITY = "Chicago"
DEFAULT_BBOX = "-87.94,41.64,-87.52,42.03"


def _parse_bbox(raw: str) -> tuple[float, float, float, float]:
    parts = [p.strip() for p in raw.split(",")]
    if len(parts) != 4:
        raise argparse.ArgumentTypeError(
            "bbox must be minlon,minlat,maxlon,maxlat (four comma-separated numbers)"
        )
    try:
        minlon, minlat, maxlon, maxlat = (float(p) for p in parts)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("bbox values must be numbers") from exc
    if minlon >= maxlon or minlat >= maxlat:
        raise argparse.ArgumentTypeError("bbox min values must be less than max values")
    return minlon, minlat, maxlon, maxlat


def _bbox_cli(values: tuple[float, float, float, float]) -> str:
    minlon, minlat, maxlon, maxlat = values
    return f"{minlon},{minlat},{maxlon},{maxlat}"


def _find_overturemaps_cli() -> str:
    exe = shutil.which("overturemaps")
    if exe:
        return exe
    scripts_dir = Path(sys.executable).parent
    for name in ("overturemaps", "overturemaps.exe"):
        candidate = scripts_dir / name
        if candidate.exists():
            return str(candidate)
    raise SystemExit(
        "overturemaps CLI not found. Install with: pip install overturemaps"
    )


def _count_geojson_features(path: Path) -> int:
    with path.open(encoding="utf-8") as fh:
        payload = json.load(fh)
    if payload.get("type") != "FeatureCollection":
        raise SystemExit(f"Expected GeoJSON FeatureCollection in {path}")
    return len(payload.get("features") or [])


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract Overture Places for a bbox.")
    parser.add_argument(
        "--city",
        default=os.environ.get("ROVVY_LAUNCH_CITY", DEFAULT_CITY),
        help=f"Launch city label (default: {DEFAULT_CITY} or ROVVY_LAUNCH_CITY)",
    )
    parser.add_argument(
        "--bbox",
        type=_parse_bbox,
        default=_parse_bbox(os.environ.get("ROVVY_BBOX", DEFAULT_BBOX)),
        help=f"Bbox minlon,minlat,maxlon,maxlat (default: spec Chicago or ROVVY_BBOX)",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Output GeoJSON path (default: data/raw.geojson)",
    )
    args = parser.parse_args()

    bbox = _bbox_cli(args.bbox)
    output: Path = args.output
    output.parent.mkdir(parents=True, exist_ok=True)

    cli = _find_overturemaps_cli()
    cmd = [
        cli,
        "download",
        f"--bbox={bbox}",
        "-f",
        "geojson",
        "--type=place",
        "-o",
        str(output),
    ]

    print(f"city={args.city}")
    print(f"bbox={bbox}")
    print(f"output={output}")
    print("running:", " ".join(cmd))

    subprocess.run(cmd, check=True)

    if not output.is_file():
        raise SystemExit(f"Download finished but output file missing: {output}")

    row_count = _count_geojson_features(output)
    size_mb = output.stat().st_size / (1024 * 1024)
    print(f"row_count={row_count}")
    print(f"file_size_mb={size_mb:.2f}")


if __name__ == "__main__":
    main()
