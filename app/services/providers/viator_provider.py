"""Viator Partner API — activities and experiences."""
from __future__ import annotations

import logging
from datetime import date, timedelta

import httpx

from app.services.scraper_framework import ScraperFramework
from app.utils.database import SessionLocal
from config import settings

logger = logging.getLogger(__name__)

VIATOR_BASE_URL = "https://api.viator.com/partner"
VIATOR_SANDBOX_URL = "https://api.sandbox.viator.com/partner"


def _api_base_url() -> str:
    if settings.ENVIRONMENT == "development":
        return VIATOR_SANDBOX_URL
    return VIATOR_BASE_URL


def _viator_headers() -> dict[str, str]:
    return {
        "exp-api-key": settings.viator_api_key,
        "Accept-Language": "en-US",
        "Accept": "application/json;version=2.0",
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

    today = date.today()
    end = today + timedelta(days=180)
    body = {
        "filtering": {
            "destination": location,
            "lowestPrice": 0,
            "highestPrice": 999999,
            "startDate": today.isoformat(),
            "endDate": end.isoformat(),
        },
        "sorting": {
            "sort": "REVIEW_AVG_RATING",
            "order": "DESC",
        },
        "pagination": {
            "start": 1,
            "count": limit,
        },
        "currency": "USD",
    }

    db = SessionLocal()
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{_api_base_url()}/products/search",
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
