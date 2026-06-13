"""
Download US Census TIGER/Line shapefiles for spatial address enrichment.

Usage:
    python -m app.scripts.download_tiger
"""
from __future__ import annotations

import argparse
import logging
import zipfile
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

TIGER_BASE = "https://www2.census.gov/geo/tiger/TIGER2024"
HTTP_HEADERS = {
    "User-Agent": "Rovvy/1.0 (contact@rovvy.app)",
}

TIGER_FILES: list[tuple[str, str]] = [
    ("state", f"{TIGER_BASE}/STATE/tl_2024_us_state.zip"),
    ("place", f"{TIGER_BASE}/PLACE/tl_2024_us_place.zip"),
    ("zcta520", f"{TIGER_BASE}/ZCTA520/tl_2024_us_zcta520.zip"),
    ("cousub", f"{TIGER_BASE}/COUSUB/tl_2024_us_cousub.zip"),
]

DEFAULT_OUTPUT_DIR = Path("scripts/tiger")


def _download_file(client: httpx.Client, url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    logger.info("Downloading %s -> %s", url, dest)

    with client.stream("GET", url, follow_redirects=True) as response:
        response.raise_for_status()
        total = int(response.headers.get("content-length", 0))
        downloaded = 0

        with dest.open("wb") as handle:
            for chunk in response.iter_bytes(chunk_size=1024 * 1024):
                handle.write(chunk)
                downloaded += len(chunk)
                if total:
                    pct = 100.0 * downloaded / total
                    logger.info(
                        "  %s: %.1f%% (%d / %d bytes)",
                        dest.name,
                        pct,
                        downloaded,
                        total,
                    )
                else:
                    logger.info("  %s: %d bytes downloaded", dest.name, downloaded)

    logger.info("Download complete: %s (%d bytes)", dest, dest.stat().st_size)


def _extract_zip(zip_path: Path, extract_dir: Path) -> None:
    extract_dir.mkdir(parents=True, exist_ok=True)
    logger.info("Extracting %s -> %s", zip_path, extract_dir)
    with zipfile.ZipFile(zip_path, "r") as archive:
        archive.extractall(extract_dir)
    logger.info("Extracted %d files to %s", len(list(extract_dir.iterdir())), extract_dir)


def download_tiger(
    output_dir: Path = DEFAULT_OUTPUT_DIR,
    *,
    client: httpx.Client | None = None,
) -> list[Path]:
    """Download and extract all TIGER shapefile archives."""
    owns_client = client is None
    if owns_client:
        client = httpx.Client(headers=HTTP_HEADERS, timeout=600.0)

    extracted_dirs: list[Path] = []
    try:
        for name, url in TIGER_FILES:
            zip_name = url.rsplit("/", 1)[-1]
            zip_path = output_dir / zip_name
            extract_dir = output_dir / zip_name.replace(".zip", "")

            _download_file(client, url, zip_path)
            _extract_zip(zip_path, extract_dir)
            extracted_dirs.append(extract_dir)
    finally:
        if owns_client:
            client.close()

    return extracted_dirs


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    parser = argparse.ArgumentParser(description="Download US Census TIGER/Line shapefiles")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Directory for downloaded zips and extracted shapefiles",
    )
    args = parser.parse_args()

    dirs = download_tiger(args.output_dir)
    logger.info("TIGER download complete — %d shapefile directories ready", len(dirs))
    for directory in dirs:
        logger.info("  %s", directory)


if __name__ == "__main__":
    main()
