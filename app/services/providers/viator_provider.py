"""Viator Partner API — activities and experiences."""
from __future__ import annotations

import logging

import httpx

from app.services.scraper_framework import ScraperFramework
from app.utils.database import SessionLocal
from config import settings

logger = logging.getLogger(__name__)

VIATOR_BASE_URL = "https://viatorapi.viator.com/service"
VIATOR_PRODUCTS_SEARCH_URL = f"{VIATOR_BASE_URL}/search/products"

# Viator destination IDs (New York = 684)
CITY_DEST_IDS: dict[str, int] = {
    "new york": 684,
}


def _dest_id_for(location: str) -> int:
    return CITY_DEST_IDS.get((location or "").lower().strip(), 684)


def _viator_headers() -> dict[str, str]:
    return {
        "exp-api-key": settings.viator_api_key,
        "Accept-Language": "en-US",
        "Content-Type": "application/json",
    }


def _parse_product(item: dict, lat: float, lng: float, location: str) -> dict | None:
    try:
        product_code = item.get("productCode")
        title = item.get("title")
        if not product_code or not title:
            return None

        pricing = item.get("pricing") or {}
        summary = pricing.get("summary") or {}
        price_from = summary.get("fromPrice")
        if price_from is None:
            return None

        reviews = item.get("reviews") or {}
        image_url = None
        images = item.get("images") or []
        if images and isinstance(images[0], dict):
            variants = images[0].get("variants") or []
            if variants and isinstance(variants[0], dict):
                image_url = variants[0].get("url")

        partner_id = settings.viator_partner_id
        booking_url = (
            f"https://www.viator.com/tours/{product_code}"
            f"?pid={partner_id}&mcid=42383&medium=api"
        )

        return {
            "product_code": product_code,
            "title": title,
            "description": item.get("description"),
            "duration": item.get("duration"),
            "price_from": float(price_from),
            "currency": pricing.get("currency") or "USD",
            "rating": reviews.get("combinedAverageRating"),
            "review_count": reviews.get("totalReviews"),
            "image_url": image_url,
            "booking_url": booking_url,
            "category": "activity",
            "lat": lat,
            "lng": lng,
            "city": location,
        }
    except (TypeError, ValueError, KeyError):
        return None


async def search_viator_experiences(
    location: str,
    lat: float,
    lng: float,
    limit: int = 20,
) -> list[dict]:
    if not (settings.viator_api_key or "").strip():
        return []

    dest_id = _dest_id_for(location)
    body = {
        "destId": dest_id,
        "currencyCode": "USD",
        "topX": f"1-{limit}",
        "sortOrder": "TOP_RATED",
    }

    db = SessionLocal()
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                VIATOR_PRODUCTS_SEARCH_URL,
                headers=_viator_headers(),
                json=body,
            )
            if resp.status_code != 200:
                logger.warning(
                    "Viator search failed for %s: HTTP %s",
                    location,
                    resp.status_code,
                )
                ScraperFramework.record_failure(
                    db,
                    "viator",
                    f"HTTP {resp.status_code}",
                )
                db.commit()
                return []

            payload = resp.json()
            products = payload.get("products") if isinstance(payload, dict) else None
            if not isinstance(products, list):
                ScraperFramework.record_success(db, "viator", 0)
                db.commit()
                return []

            results: list[dict] = []
            for item in products:
                if not isinstance(item, dict):
                    continue
                parsed = _parse_product(item, lat, lng, location)
                if parsed:
                    results.append(parsed)

            ScraperFramework.record_success(db, "viator", len(results))
            db.commit()
            return results
    except Exception as exc:
        logger.error("Viator search error for %s: %s", location, exc)
        try:
            ScraperFramework.record_failure(db, "viator", str(exc))
            db.commit()
        except Exception:
            db.rollback()
        return []
    finally:
        db.close()


async def test_viator_connection():
    import httpx
    from config import settings

    key = settings.viator_api_key
    print(f"Key length: {len(key)}")
    print(f"Key first 8: {key[:8]}")

    # Test 1: Product search (New York destId 684)
    async with httpx.AsyncClient() as client:
        r = await client.post(
            VIATOR_PRODUCTS_SEARCH_URL,
            headers={
                "exp-api-key": key,
                "Accept-Language": "en-US",
                "Content-Type": "application/json",
            },
            json={
                "destId": 684,
                "currencyCode": "USD",
                "topX": "1-5",
                "sortOrder": "TOP_RATED",
            },
            timeout=10.0,
        )
        print(f"Status: {r.status_code}")
        print(f"Response: {r.text[:300]}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_viator_connection())
