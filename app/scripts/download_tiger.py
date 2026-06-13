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

STATE_FIPS = [
    "01", "02", "04", "05", "06", "08", "09", "10", "11", "12", "13",
    "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25",
    "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36",
    "37", "38", "39", "40", "41", "42", "44", "45", "46", "47", "48",
    "49", "50", "51", "53", "54", "55", "56",
    "60", "66", "69", "72", "74", "78",
]

NATION_ZIPS: list[tuple[str, str]] = [
    ("tl_2024_us_state", f"{TIGER_BASE}/STATE/tl_2024_us_state.zip"),
    ("tl_2024_us_zcta520", f"{TIGER_BASE}/ZCTA520/tl_2024_us_zcta520.zip"),
]

STATE_LAYER_ZIPS: list[tuple[str, str, str]] = [
    ("place", "PLACE", "place"),
    ("cousub", "COUSUB", "cousub"),
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


def _download_nation_layer(
    client: httpx.Client,
    output_dir: Path,
    layer_name: str,
    url: str,
) -> Path:
    zip_path = output_dir / f"{layer_name}.zip"
    extract_dir = output_dir / layer_name
    _download_file(client, url, zip_path)
    _extract_zip(zip_path, extract_dir)
    return extract_dir


def _download_state_layers(
    client: httpx.Client,
    output_dir: Path,
    layer_key: str,
    folder: str,
    suffix: str,
) -> list[Path]:
    layer_root = output_dir / layer_key
    extracted_dirs: list[Path] = []

    for fips in STATE_FIPS:
        layer_name = f"tl_2024_{fips}_{suffix}"
        url = f"{TIGER_BASE}/{folder}/{layer_name}.zip"
        zip_path = layer_root / f"{layer_name}.zip"
        extract_dir = layer_root / layer_name

        try:
            _download_file(client, url, zip_path)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                logger.warning("Skipping missing layer %s", layer_name)
                continue
            raise

        _extract_zip(zip_path, extract_dir)
        extracted_dirs.append(extract_dir)

    logger.info(
        "Downloaded %d/%d state %s layers",
        len(extracted_dirs),
        len(STATE_FIPS),
        layer_key,
    )
    return extracted_dirs


def download_tiger(
    output_dir: Path = DEFAULT_OUTPUT_DIR,
    *,
    client: httpx.Client | None = None,
) -> dict[str, list[Path]]:
    """Download and extract all TIGER shapefile archives."""
    owns_client = client is None
    if owns_client:
        client = httpx.Client(headers=HTTP_HEADERS, timeout=600.0)

    results: dict[str, list[Path]] = {"nation": [], "place": [], "cousub": []}
    try:
        for layer_name, url in NATION_ZIPS:
            results["nation"].append(_download_nation_layer(client, output_dir, layer_name, url))

        for layer_key, folder, suffix in STATE_LAYER_ZIPS:
            results[layer_key] = _download_state_layers(
                client, output_dir, layer_key, folder, suffix
            )
    finally:
        if owns_client:
            client.close()

    return results


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

    results = download_tiger(args.output_dir)
    nation_count = len(results["nation"])
    place_count = len(results["place"])
    cousub_count = len(results["cousub"])
    logger.info(
        "TIGER download complete — nation=%d place=%d cousub=%d",
        nation_count,
        place_count,
        cousub_count,
    )


if __name__ == "__main__":
    main()
