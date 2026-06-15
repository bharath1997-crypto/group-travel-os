"""
Multi-source photo enrichment for the places table.

4-tier waterfall: Wikimedia → Mapillary → Pexels → Unsplash fallback.

Usage:
    python -m app.scripts.enrich_photos --tier 4
    python -m app.scripts.enrich_photos --tier all --limit 100
    python -m app.scripts.enrich_photos --tier 1 --category restaurant --dry-run
"""
from __future__ import annotations

import argparse
import hashlib
import logging
import os
import time
from typing import Any

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import SessionLocal

logger = logging.getLogger(__name__)

WIKIDATA_API = "https://www.wikidata.org/w/api.php"
MAPILLARY_API = "https://graph.mapillary.com/images"
PEXELS_API = "https://api.pexels.com/v1/search"

WIKIMEDIA_SLEEP_SECONDS = 0.3
MAPILLARY_SLEEP_SECONDS = 0.2
PEXELS_SLEEP_SECONDS = 0.1
PEXELS_PER_PAGE = 15

PEXELS_CATEGORY_QUERIES: dict[str, str] = {
    "restaurant": "restaurant food dining",
    "nightlife": "nightclub bar cocktails",
    "park": "city park nature green",
    "landmark": "landmark architecture monument",
    "trekking": "hiking trail mountain",
    "nature": "nature waterfall forest",
    "shopping": "shopping mall retail",
    "entertainment": "theatre cinema performance",
    "gaming": "arcade gaming esports",
    "amusement": "amusement park rides",
    "sports": "sports fitness gym",
    "photo_spot": "scenic viewpoint photography",
    "activities": "outdoor adventure activity",
}

UNSPLASH_FALLBACK_SQL = """
UPDATE places SET
    photo_url = CASE category
        WHEN 'restaurant' THEN 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'
        WHEN 'nightlife' THEN 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=400'
        WHEN 'park' THEN 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=400'
        WHEN 'landmark' THEN 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400'
        WHEN 'trekking' THEN 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400'
        WHEN 'nature' THEN 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400'
        WHEN 'shopping' THEN 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=400'
        WHEN 'entertainment' THEN 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400'
        WHEN 'gaming' THEN 'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=400'
        WHEN 'amusement' THEN 'https://images.unsplash.com/photo-1513031300226-c8fb12de9ade?w=400'
        WHEN 'sports' THEN 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400'
        WHEN 'photo_spot' THEN 'https://images.unsplash.com/photo-1452421822248-d4c2b47f0c81?w=400'
        WHEN 'activities' THEN 'https://images.unsplash.com/photo-1526772662000-3f88f10405ff?w=400'
        ELSE 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400'
    END,
    photo_source = 'unsplash'
WHERE photo_url IS NULL
"""


def build_wikimedia_commons_url(filename: str) -> str:
    """Build a Wikimedia Commons image URL from a filename."""
    normalized = filename.replace(" ", "_")
    digest = hashlib.md5(normalized.encode("utf-8")).hexdigest()
    return (
        f"https://upload.wikimedia.org/wikipedia/commons/"
        f"{digest[0]}/{digest[0:2]}/{normalized}"
    )


def pexels_photo_index(osm_id: int, per_page: int = PEXELS_PER_PAGE) -> int:
    """Pick a stable photo index for a place within a Pexels result page."""
    return int(osm_id) % per_page


def build_mapillary_params(
    lat: float,
    lng: float,
    access_token: str,
    *,
    radius: int = 50,
    limit: int = 1,
) -> dict[str, str | int | float]:
    """Build Mapillary image search query parameters."""
    return {
        "access_token": access_token,
        "fields": "id,thumb_256_url",
        "closeto": f"{lng},{lat}",
        "radius": radius,
        "limit": limit,
    }


def _rowcount(result: object) -> int:
    rowcount = getattr(result, "rowcount", None)
    return int(rowcount) if rowcount is not None and rowcount >= 0 else 0


def _set_statement_timeout(db: Session, seconds: int = 300) -> None:
    dialect = db.bind.dialect.name if db.bind else "postgresql"
    if dialect == "postgresql":
        db.execute(text(f"SET statement_timeout = '{seconds}s'"))


def _parse_tags(raw_tags: Any) -> dict[str, Any]:
    if isinstance(raw_tags, dict):
        return raw_tags
    return {}


def _category_filter(category: str | None) -> tuple[str, dict[str, Any]]:
    if category:
        return "AND category = :category", {"category": category}
    return "", {}


def _limit_clause(limit: int | None) -> str:
    return "LIMIT :limit" if limit is not None else ""


def fetch_wikidata_image_filename(
    wikidata_id: str,
    client: httpx.Client,
) -> str | None:
    """Fetch the P18 image filename for a Wikidata entity."""
    response = client.get(
        WIKIDATA_API,
        params={
            "action": "wbgetclaims",
            "entity": wikidata_id,
            "property": "P18",
            "format": "json",
        },
        timeout=20.0,
    )
    response.raise_for_status()
    payload = response.json()
    claims = payload.get("claims", {}).get("P18", [])
    if not claims:
        return None
    return claims[0]["mainsnak"]["datavalue"]["value"]


def fetch_pexels_photos(
    query: str,
    api_key: str,
    client: httpx.Client,
) -> list[dict[str, Any]]:
    """Search Pexels and return photo objects."""
    response = client.get(
        PEXELS_API,
        params={"query": query, "per_page": PEXELS_PER_PAGE, "page": 1},
        headers={"Authorization": api_key},
        timeout=20.0,
    )
    response.raise_for_status()
    payload = response.json()
    photos = payload.get("photos", [])
    return photos if isinstance(photos, list) else []


def fetch_mapillary_thumb_url(
    lat: float,
    lng: float,
    access_token: str,
    client: httpx.Client,
) -> str | None:
    """Fetch the nearest Mapillary thumbnail within 50m."""
    response = client.get(
        MAPILLARY_API,
        params=build_mapillary_params(lat, lng, access_token),
        timeout=20.0,
    )
    response.raise_for_status()
    payload = response.json()
    data = payload.get("data", [])
    if not data:
        return None
    return data[0].get("thumb_256_url")


def _update_place_photo(
    db: Session,
    place_id: Any,
    photo_url: str,
    photo_source: str,
    *,
    dry_run: bool,
) -> None:
    if dry_run:
        logger.info(
            "[dry-run] would update place %s photo_source=%s url=%s",
            place_id,
            photo_source,
            photo_url,
        )
        return
    db.execute(
        text(
            """
            UPDATE places
            SET photo_url = :photo_url, photo_source = :photo_source
            WHERE id = :place_id
            """
        ),
        {
            "place_id": place_id,
            "photo_url": photo_url,
            "photo_source": photo_source,
        },
    )


def run_tier1_wikimedia(
    db: Session,
    *,
    category: str | None = None,
    limit: int | None = None,
    dry_run: bool = False,
    client: httpx.Client | None = None,
) -> int:
    """Tier 1: Wikimedia Commons photos via Wikidata P18 claims."""
    category_sql, category_params = _category_filter(category)
    limit_sql = _limit_clause(limit)
    rows = db.execute(
        text(
            f"""
            SELECT id, osm_id, tags
            FROM places
            WHERE photo_url IS NULL
              AND tags->>'wikidata' IS NOT NULL
              {category_sql}
            {limit_sql}
            """
        ),
        {"limit": limit, **category_params},
    ).mappings().all()

    owns_client = client is None
    if owns_client:
        client = httpx.Client(
            headers={"User-Agent": "Rovvy/1.0 (contact@rovvy.app)"}
        )

    updated = 0
    try:
        for row in rows:
            tags = _parse_tags(row["tags"])
            wikidata_id = tags.get("wikidata")
            if not wikidata_id:
                continue
            try:
                filename = fetch_wikidata_image_filename(wikidata_id, client)
                if not filename:
                    continue
                photo_url = build_wikimedia_commons_url(filename)
                _update_place_photo(
                    db,
                    row["id"],
                    photo_url,
                    "wikimedia",
                    dry_run=dry_run,
                )
                updated += 1
                if not dry_run:
                    db.commit()
            except Exception as exc:
                logger.warning(
                    "Tier 1 skipped place %s (wikidata=%s): %s",
                    row["id"],
                    wikidata_id,
                    exc,
                )
            time.sleep(WIKIMEDIA_SLEEP_SECONDS)
    finally:
        if owns_client:
            client.close()

    return updated


def run_tier2_mapillary(
    db: Session,
    *,
    category: str | None = None,
    limit: int | None = None,
    dry_run: bool = False,
    client: httpx.Client | None = None,
) -> int:
    """Tier 2: Mapillary GPS-matched street photos."""
    access_token = os.environ.get("MAPILLARY_ACCESS_TOKEN")
    if not access_token:
        logger.warning("Tier 2 skipped: key not found (MAPILLARY_ACCESS_TOKEN)")
        return 0

    category_sql, category_params = _category_filter(category)
    limit_sql = _limit_clause(limit)
    rows = db.execute(
        text(
            f"""
            SELECT id, lat, lng
            FROM places
            WHERE photo_url IS NULL
              AND lat IS NOT NULL
              AND lng IS NOT NULL
              {category_sql}
            {limit_sql}
            """
        ),
        {"limit": limit, **category_params},
    ).mappings().all()

    owns_client = client is None
    if owns_client:
        client = httpx.Client()

    updated = 0
    try:
        for row in rows:
            try:
                thumb_url = fetch_mapillary_thumb_url(
                    float(row["lat"]),
                    float(row["lng"]),
                    access_token,
                    client,
                )
                if not thumb_url:
                    continue
                _update_place_photo(
                    db,
                    row["id"],
                    thumb_url,
                    "mapillary",
                    dry_run=dry_run,
                )
                updated += 1
                if not dry_run:
                    db.commit()
            except Exception as exc:
                logger.warning("Tier 2 skipped place %s: %s", row["id"], exc)
            time.sleep(MAPILLARY_SLEEP_SECONDS)
    finally:
        if owns_client:
            client.close()

    return updated


def run_tier3_pexels(
    db: Session,
    *,
    category: str | None = None,
    limit: int | None = None,
    dry_run: bool = False,
    client: httpx.Client | None = None,
) -> int:
    """Tier 3: Pexels category stock photos."""
    api_key = os.environ.get("PEXELS_API_KEY")
    if not api_key:
        logger.warning("Tier 3 skipped: key not found (PEXELS_API_KEY)")
        return 0

    category_sql, category_params = _category_filter(category)
    limit_sql = _limit_clause(limit)
    rows = db.execute(
        text(
            f"""
            SELECT id, osm_id, category
            FROM places
            WHERE photo_source = 'unsplash'
              AND category IS NOT NULL
              {category_sql}
            {limit_sql}
            """
        ),
        {"limit": limit, **category_params},
    ).mappings().all()

    owns_client = client is None
    if owns_client:
        client = httpx.Client()

    query_cache: dict[str, list[dict[str, Any]]] = {}
    updated = 0
    try:
        for row in rows:
            place_category = row["category"]
            query = PEXELS_CATEGORY_QUERIES.get(place_category)
            if not query:
                continue
            try:
                if query not in query_cache:
                    query_cache[query] = fetch_pexels_photos(query, api_key, client)
                    time.sleep(PEXELS_SLEEP_SECONDS)
                photos = query_cache[query]
                if not photos:
                    continue
                index = pexels_photo_index(int(row["osm_id"] or 0))
                if index >= len(photos):
                    index = index % len(photos)
                photo_url = photos[index]["src"]["medium"]
                _update_place_photo(
                    db,
                    row["id"],
                    photo_url,
                    "pexels",
                    dry_run=dry_run,
                )
                updated += 1
                if not dry_run:
                    db.commit()
            except Exception as exc:
                logger.warning("Tier 3 skipped place %s: %s", row["id"], exc)
    finally:
        if owns_client:
            client.close()

    return updated


def run_tier4_unsplash(
    db: Session,
    *,
    category: str | None = None,
    limit: int | None = None,
    dry_run: bool = False,
) -> int:
    """Tier 4: Unsplash static fallback URLs."""
    if dry_run:
        category_sql, category_params = _category_filter(category)
        limit_sql = _limit_clause(limit)
        rows = db.execute(
            text(
                f"""
                SELECT id, category
                FROM places
                WHERE photo_url IS NULL
                {category_sql}
                {limit_sql}
                """
            ),
            {"limit": limit, **category_params},
        ).mappings().all()
        for row in rows:
            logger.info(
                "[dry-run] would apply unsplash fallback to place %s (category=%s)",
                row["id"],
                row["category"],
            )
        return len(rows)

    sql = UNSPLASH_FALLBACK_SQL.strip()
    if category:
        sql = sql.replace(
            "WHERE photo_url IS NULL",
            "WHERE photo_url IS NULL AND category = :category",
        )
    if limit is not None:
        sql = f"""
        WITH targets AS (
            SELECT id
            FROM places
            WHERE photo_url IS NULL
            {"AND category = :category" if category else ""}
            LIMIT :limit
        )
        UPDATE places
        SET
            photo_url = CASE category
                WHEN 'restaurant' THEN 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'
                WHEN 'nightlife' THEN 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=400'
                WHEN 'park' THEN 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=400'
                WHEN 'landmark' THEN 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400'
                WHEN 'trekking' THEN 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400'
                WHEN 'nature' THEN 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400'
                WHEN 'shopping' THEN 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=400'
                WHEN 'entertainment' THEN 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400'
                WHEN 'gaming' THEN 'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=400'
                WHEN 'amusement' THEN 'https://images.unsplash.com/photo-1513031300226-c8fb12de9ade?w=400'
                WHEN 'sports' THEN 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400'
                WHEN 'photo_spot' THEN 'https://images.unsplash.com/photo-1452421822248-d4c2b47f0c81?w=400'
                WHEN 'activities' THEN 'https://images.unsplash.com/photo-1526772662000-3f88f10405ff?w=400'
                ELSE 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400'
            END,
            photo_source = 'unsplash'
        WHERE id IN (SELECT id FROM targets)
        """

    params: dict[str, Any] = {}
    if category:
        params["category"] = category
    if limit is not None:
        params["limit"] = limit

    _set_statement_timeout(db)
    result = db.execute(text(sql), params)
    if not dry_run:
        db.commit()
    return _rowcount(result)


def run_enrichment(
    db: Session,
    *,
    tier: str = "all",
    category: str | None = None,
    limit: int | None = None,
    dry_run: bool = False,
) -> dict[str, int]:
    """Run one or more enrichment tiers and return per-tier update counts."""
    tiers = ["1", "2", "3", "4"] if tier == "all" else [tier]
    counts: dict[str, int] = {}

    for tier_name in tiers:
        if tier_name == "1":
            counts["tier1_wikimedia"] = run_tier1_wikimedia(
                db, category=category, limit=limit, dry_run=dry_run
            )
        elif tier_name == "2":
            counts["tier2_mapillary"] = run_tier2_mapillary(
                db, category=category, limit=limit, dry_run=dry_run
            )
        elif tier_name == "3":
            counts["tier3_pexels"] = run_tier3_pexels(
                db, category=category, limit=limit, dry_run=dry_run
            )
        elif tier_name == "4":
            counts["tier4_unsplash"] = run_tier4_unsplash(
                db, category=category, limit=limit, dry_run=dry_run
            )
        else:
            raise ValueError(f"Unknown tier: {tier_name}")

    return counts


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    parser = argparse.ArgumentParser(
        description="Enrich places with photos from Wikimedia, Mapillary, Pexels, or Unsplash"
    )
    parser.add_argument("--limit", type=int, default=None, help="Process N rows only")
    parser.add_argument("--category", type=str, default=None, help="Specific category only")
    parser.add_argument(
        "--tier",
        choices=["1", "2", "3", "4", "all"],
        default="all",
        help="Run specific tier (default: all)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print updates without writing to the database",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        logger.info(
            "Starting photo enrichment tier=%s category=%s limit=%s dry_run=%s",
            args.tier,
            args.category,
            args.limit,
            args.dry_run,
        )
        counts = run_enrichment(
            db,
            tier=args.tier,
            category=args.category,
            limit=args.limit,
            dry_run=args.dry_run,
        )
        logger.info("Photo enrichment complete: %s", counts)
    finally:
        db.close()


if __name__ == "__main__":
    main()
