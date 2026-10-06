#!/usr/bin/env python3
"""
Wikimedia Commons photos for places that already carry a Wikidata QID.

wikidata_qid -> Wikidata P18 (image) -> Commons imageinfo (thumbnail, author,
license) -> place_media row (source=open_license, approved, place_key=gers:<id>).

Stores URLs and attribution only; no image bytes. Only freely licensed files
(CC0 / public domain / CC BY / CC BY-SA) are kept, with author + license so the
UI can show the credit the license requires.

Usage:
    python scripts/07_enrich_wikimedia_photos.py --metros chicago --dry-run
    python scripts/07_enrich_wikimedia_photos.py --metros chicago
"""
from __future__ import annotations

import argparse
import html
import os
import re
import sys
import time
import uuid
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).resolve().parents[1]
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "Rovvy/0.1 (https://rovvy.app; contact@rovvy.app)"
BATCH = 50  # MediaWiki API limit for ids/titles per request
THUMB_WIDTH = 1024
REQUEST_PAUSE_S = 0.5

_TAGS = re.compile(r"<[^>]+>")
# CC0 / public domain / CC BY / CC BY-SA only. NC (non-commercial) and ND are rejected:
# Rovvy is commercial and resizes images.
_FREE_LICENSE = re.compile(r"^(cc0|public domain|pd\b|cc[ -]by(?:[ -]sa)?(?![ -]?(?:nc|nd))\b)", re.IGNORECASE)


@dataclass(frozen=True)
class CommonsPhoto:
    filename: str
    thumbnail_url: str
    original_url: str
    author: str | None
    license: str

    @property
    def attribution(self) -> str:
        who = self.author or "Unknown author"
        return f"{who} · Wikimedia Commons"


def place_key(gers_id: str) -> str:
    return f"gers:{gers_id}"


def chunks(items: list[str], size: int = BATCH) -> Iterator[list[str]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def p18_filename(entity: dict[str, Any]) -> str | None:
    """First 'image' (P18) claim value, e.g. 'Pritzker Park Chicago.jpg'."""
    for claim in (entity.get("claims") or {}).get("P18") or []:
        value = ((claim.get("mainsnak") or {}).get("datavalue") or {}).get("value")
        if isinstance(value, str) and value.strip() and claim.get("rank") != "deprecated":
            return value.strip()
    return None


def plain_text(value: str | None, *, max_len: int = 200) -> str | None:
    """Commons extmetadata values are HTML fragments; keep readable text only."""
    if not value:
        return None
    text = html.unescape(_TAGS.sub(" ", value))
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_len] or None


def clean_author(value: str | None) -> str | None:
    """'kimberlyhobart at English Wikipedia . The original uploader was ...' -> 'kimberlyhobart at English Wikipedia'."""
    text = plain_text(value)
    if not text:
        return None
    text = re.split(r"\s*\.?\s*The original uploader was", text, maxsplit=1)[0]
    return text.strip(" .,;") or None


def is_free_license(name: str | None) -> bool:
    return bool(name and _FREE_LICENSE.match(name.strip()))


def photo_from_imageinfo(page: dict[str, Any]) -> CommonsPhoto | None:
    info = (page.get("imageinfo") or [None])[0]
    if not isinstance(info, dict):
        return None
    meta = info.get("extmetadata") or {}
    license_name = plain_text((meta.get("LicenseShortName") or {}).get("value"), max_len=60)
    if not is_free_license(license_name):
        return None
    thumb = info.get("thumburl") or info.get("url")
    if not thumb or not info.get("url"):
        return None
    title = str(page.get("title") or "")
    return CommonsPhoto(
        filename=title.removeprefix("File:"),
        thumbnail_url=str(thumb),
        original_url=str(info["url"]),
        author=clean_author((meta.get("Artist") or {}).get("value")),
        license=license_name or "",
    )


class WikimediaClient:
    def __init__(self, session: requests.Session | None = None, pause: float = REQUEST_PAUSE_S) -> None:
        self.session = session or requests.Session()
        self.session.headers["User-Agent"] = USER_AGENT
        self.pause = pause

    def _get(self, url: str, params: dict[str, Any]) -> dict[str, Any]:
        for attempt in range(4):
            response = self.session.get(url, params={**params, "format": "json", "formatversion": 2}, timeout=30)
            if response.status_code in (429, 503):
                time.sleep(float(response.headers.get("Retry-After") or 2 ** attempt))
                continue
            response.raise_for_status()
            time.sleep(self.pause)
            return response.json()
        raise RuntimeError(f"{url}: rate limited after retries")

    def image_filenames(self, qids: list[str]) -> dict[str, str]:
        out: dict[str, str] = {}
        for batch in chunks(qids):
            body = self._get(WIKIDATA_API, {"action": "wbgetentities", "ids": "|".join(batch), "props": "claims"})
            entities = body.get("entities") or {}
            for qid, entity in entities.items():
                filename = p18_filename(entity) if isinstance(entity, dict) else None
                if filename:
                    out[qid] = filename
        return out

    def photos(self, filenames: Iterable[str]) -> dict[str, CommonsPhoto]:
        out: dict[str, CommonsPhoto] = {}
        for batch in chunks(sorted(set(filenames))):
            body = self._get(
                COMMONS_API,
                {
                    "action": "query",
                    "titles": "|".join(f"File:{name}" for name in batch),
                    "prop": "imageinfo",
                    "iiprop": "url|extmetadata",
                    "iiurlwidth": THUMB_WIDTH,
                    "iiextmetadatafilter": "Artist|LicenseShortName",
                },
            )
            # Normalized titles use spaces; P18 values may use underscores.
            for page in (body.get("query") or {}).get("pages") or []:
                photo = photo_from_imageinfo(page)
                if photo:
                    out[photo.filename.replace("_", " ")] = photo
        return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--metros", nargs="+", required=True, help="city_slug values, e.g. chicago orlando")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0, help="max places (0 = all)")
    args = parser.parse_args(argv)

    from dotenv import load_dotenv
    import psycopg2
    from psycopg2.extras import Json, execute_values

    load_dotenv(ROOT / ".env")
    conn = psycopg2.connect(os.environ["DATABASE_URL"], connect_timeout=15)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT p.gers_id, p.wikidata_qid
        FROM places p
        WHERE p.city_slug = ANY(%s) AND p.gers_id IS NOT NULL AND p.wikidata_qid IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM place_media m
            WHERE m.place_key = 'gers:' || p.gers_id AND m.source = 'open_license'
          )
        ORDER BY p.confidence DESC NULLS LAST
        """,
        (args.metros,),
    )
    rows = cur.fetchall()
    if args.limit:
        rows = rows[: args.limit]
    print(f"places with QID and no Commons photo yet: {len(rows)}", flush=True)

    client = WikimediaClient()
    by_qid = client.image_filenames(sorted({qid for _, qid in rows}))
    print(f"QIDs with a P18 image: {len(by_qid)}", flush=True)
    photos = client.photos(by_qid.values())
    print(f"freely licensed Commons files resolved: {len(photos)}", flush=True)

    records = []
    for gers_id, qid in rows:
        filename = by_qid.get(qid)
        photo = photos.get(filename.replace("_", " ")) if filename else None
        if photo:
            records.append((gers_id, photo))

    for gers_id, photo in records[:5]:
        print(f"  {gers_id}: {photo.filename} | {photo.license} | {photo.attribution}")
    print(f"place_media rows to insert: {len(records)}", flush=True)
    if args.dry_run or not records:
        return 0

    execute_values(
        cur,
        """
        INSERT INTO place_media
          (id, place_key, thumbnail_url, storage_url, caption, tags, source,
           attribution, license, moderation_status, created_at)
        VALUES %s
        """,
        [
            (
                str(uuid.uuid4()),
                place_key(gers_id),
                photo.thumbnail_url,
                photo.original_url,
                photo.filename,
                Json(["wikimedia_commons"]),
                "open_license",
                photo.attribution[:500],
                photo.license[:120],
                "approved",
            )
            for gers_id, photo in records
        ],
        template="(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())",
    )
    conn.commit()
    print(f"inserted {len(records)} place_media rows", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
