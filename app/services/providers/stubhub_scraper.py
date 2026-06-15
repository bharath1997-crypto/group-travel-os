"""StubHub price scraper — HTML search, no API key."""
from __future__ import annotations

import json
import logging
import random
import re
from datetime import date, datetime, timedelta
from urllib.parse import quote_plus, urljoin

import httpx
from bs4 import BeautifulSoup
from rapidfuzz import fuzz

from app.services.scraper_framework import ScraperFramework
from app.utils.database import SessionLocal

logger = logging.getLogger(__name__)

PROVIDER = "stubhub"

_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

_BASE_HEADERS = {
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.stubhub.com",
}

_PRICE_RE = re.compile(r"\$\s*([\d,]+(?:\.\d{2})?)")
_DATE_RE = re.compile(
    r"(\d{1,2}/\d{1,2}/\d{2,4})|"
    r"((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2})",
    re.IGNORECASE,
)


def _parse_result_date(text: str, ref: date) -> date | None:
    if not text:
        return None
    for fmt in ("%m/%d/%Y", "%m/%d/%y", "%b %d", "%B %d"):
        for match in _DATE_RE.finditer(text):
            chunk = match.group(0).strip()
            try:
                if fmt in ("%b %d", "%B %d"):
                    parsed = datetime.strptime(
                        f"{chunk} {ref.year}", f"{fmt} %Y"
                    ).date()
                else:
                    parsed = datetime.strptime(chunk, fmt).date()
                return parsed
            except ValueError:
                continue
    return None


def _dates_within_one_day(a: date, b: date) -> bool:
    return abs((a - b).days) <= 1


def _extract_candidates(soup: BeautifulSoup) -> list[dict]:
    candidates: list[dict] = []
    seen_urls: set[str] = set()

    for link in soup.find_all("a", href=True):
        href = link.get("href") or ""
        if "stubhub.com" not in href.lower():
            continue
        if not any(x in href.lower() for x in ("/event/", "/tickets/", "/find/")):
            continue
        if href in seen_urls:
            continue

        block = link.find_parent(["li", "article", "div"]) or link
        block_text = block.get_text(" ", strip=True)
        title_text = link.get_text(" ", strip=True) or block_text[:120]

        price_match = _PRICE_RE.search(block_text)
        if not price_match:
            continue

        try:
            min_price = float(price_match.group(1).replace(",", ""))
        except ValueError:
            continue

        event_url = href if href.startswith("http") else f"https://www.stubhub.com{href}"
        seen_urls.add(href)
        candidates.append({
            "title": title_text,
            "block_text": block_text,
            "min_price": min_price,
            "provider_url": event_url,
        })

    return candidates


async def scrape_stubhub_prices(
    title: str,
    city: str,
    event_date: date,
    limit: int = 1,
) -> dict | None:
    try:
        headers = {
            **_BASE_HEADERS,
            "User-Agent": random.choice(_USER_AGENTS),
        }
        query = quote_plus(f"{title} {city}")
        search_url = f"https://www.stubhub.com/find/s/?q={query}"

        async with httpx.AsyncClient(
            timeout=10.0,
            follow_redirects=True,
        ) as client:
            resp = await client.get(search_url, headers=headers)
            if resp.status_code != 200:
                return None

        soup = BeautifulSoup(resp.text, "html.parser")
        candidates = _extract_candidates(soup)
        city_l = (city or "").lower().strip()
        norm_title = title.lower().strip()

        matches: list[dict] = []
        for cand in candidates[: max(limit * 5, 10)]:
            if city_l and city_l not in cand["block_text"].lower():
                continue
            score = fuzz.ratio(norm_title, cand["title"].lower())
            if score < 85:
                continue
            parsed_date = _parse_result_date(cand["block_text"], event_date)
            if parsed_date and not _dates_within_one_day(parsed_date, event_date):
                continue
            matches.append(cand)

        if not matches:
            return None

        best = min(matches, key=lambda c: c["min_price"])
        return {
            "provider": "stubhub",
            "min_price": best["min_price"],
            "provider_url": best["provider_url"],
            "availability": "available",
        }
    except Exception:
        return None


def _provider_event_id(url: str) -> str:
    match = re.search(r"(\d{7,15})", url or "")
    if match:
        return match.group(1)
    import hashlib
    return hashlib.sha256((url or "").encode()).hexdigest()[:16]


def _parse_start_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _is_event_type(obj: dict) -> bool:
    event_type = obj.get("@type")
    if isinstance(event_type, list):
        return any("Event" in str(item) for item in event_type)
    return "Event" in str(event_type or "")


def _flatten_ld(obj: dict) -> list[dict]:
    graph = obj.get("@graph")
    if isinstance(graph, list):
        return [item for item in graph if isinstance(item, dict)]
    return [obj]


def _parse_offers(
    offers: object,
) -> tuple[float | None, float | None, str]:
    if isinstance(offers, list):
        offers = offers[0] if offers else {}
    if not isinstance(offers, dict):
        return None, None, "USD"

    currency = str(offers.get("priceCurrency") or "USD")
    low = offers.get("lowPrice", offers.get("price"))
    high = offers.get("highPrice", low)

    try:
        price_min = float(low) if low is not None else None
    except (TypeError, ValueError):
        price_min = None
    try:
        price_max = float(high) if high is not None else price_min
    except (TypeError, ValueError):
        price_max = price_min

    return price_min, price_max, currency


def _parse_location(
    location: object,
    default_city: str,
) -> tuple[str, str]:
    if not isinstance(location, dict):
        return "", default_city

    venue_name = str(location.get("name") or "")
    venue_city = default_city
    address = location.get("address")
    if isinstance(address, dict):
        venue_city = str(
            address.get("addressLocality")
            or address.get("locality")
            or default_city
        )
    return venue_name, venue_city


def _parse_image(image: object) -> str | None:
    if isinstance(image, str) and image.strip():
        return image.strip()
    if isinstance(image, list):
        for item in image:
            if isinstance(item, str) and item.strip():
                return item.strip()
            if isinstance(item, dict) and item.get("url"):
                return str(item["url"])
    if isinstance(image, dict) and image.get("url"):
        return str(image["url"])
    return None


def _parse_event_object(obj: dict, default_city: str) -> dict | None:
    if not _is_event_type(obj):
        return None

    title = str(obj.get("name") or "").strip()
    url = str(obj.get("url") or "").strip()
    if not title or not url:
        return None

    start_datetime = _parse_start_datetime(obj.get("startDate"))
    venue_name, venue_city = _parse_location(
        obj.get("location"),
        default_city,
    )
    image_url = _parse_image(obj.get("image"))
    price_min, price_max, currency = _parse_offers(obj.get("offers"))

    category = "event"
    for key in ("eventAttendanceMode", "eventStatus", "category"):
        value = obj.get(key)
        if isinstance(value, str) and value.strip():
            category = value.strip().lower().replace("_", " ")
            break

    return {
        "provider_event_id": _provider_event_id(url),
        "title": title,
        "url": url,
        "start_datetime": start_datetime,
        "venue_name": venue_name or None,
        "venue_city": venue_city or default_city,
        "image_url": image_url,
        "price_min": price_min,
        "price_max": price_max,
        "currency": currency,
        "category": category,
    }


def _collect_json_ld_objects(soup: BeautifulSoup) -> list[dict]:
    objects: list[dict] = []
    for script in soup.find_all("script", type="application/ld+json"):
        raw = script.string or script.get_text() or ""
        if not raw.strip():
            continue
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue

        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    objects.extend(_flatten_ld(item))
        elif isinstance(data, dict):
            objects.extend(_flatten_ld(data))
    return objects


def parse_stubhub_html(html: str, default_city: str) -> list[dict]:
    """Parse StubHub listing HTML into normalized event dicts."""
    soup = BeautifulSoup(html, "html.parser")
    results: list[dict] = []
    seen_ids: set[str] = set()

    for obj in _collect_json_ld_objects(soup):
        parsed = _parse_event_object(obj, default_city)
        if not parsed:
            continue
        event_id = parsed["provider_event_id"]
        if event_id in seen_ids:
            continue
        seen_ids.add(event_id)
        results.append(parsed)

    if not results:
        for link in soup.find_all("a", href=True):
            href = str(link.get("href") or "")
            if not any(x in href.lower() for x in ("/event/", "/tickets/", "/find/")):
                continue
            url = href if href.startswith("http") else urljoin("https://www.stubhub.com", href)
            title = link.get_text(" ", strip=True)
            if not title or len(title) < 3:
                continue
            event_id = _provider_event_id(url)
            if event_id in seen_ids:
                continue
            seen_ids.add(event_id)
            results.append({
                "provider_event_id": event_id,
                "title": title,
                "url": url,
                "start_datetime": None,
                "venue_name": None,
                "venue_city": default_city,
                "image_url": None,
                "price_min": None,
                "price_max": None,
                "currency": "USD",
                "category": "event",
            })
    return results


async def scrape_stubhub_events(
    city: str,
    limit: int = 50,
) -> list[dict]:
    """Fetch and parse StubHub city listing page."""
    db = SessionLocal()
    today = date.today()
    to_date = today + timedelta(days=60)
    url = f"https://www.stubhub.com/find/s/?q={quote_plus(city)}&dateFrom={today.isoformat()}&dateTo={to_date.isoformat()}"

    try:
        if not ScraperFramework.is_provider_available(db, PROVIDER):
            return []

        headers = {
            **_BASE_HEADERS,
            "User-Agent": random.choice(_USER_AGENTS),
        }

        async with httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
        ) as client:
            resp = await client.get(url, headers=headers)

        if resp.status_code != 200:
            logger.warning(
                "StubHub scrape failed for %s: HTTP %s",
                city,
                resp.status_code,
            )
            ScraperFramework.record_failure(
                db,
                PROVIDER,
                f"HTTP {resp.status_code}",
            )
            db.commit()
            return []

        events = parse_stubhub_html(resp.text, city)[:limit]
        ScraperFramework.record_success(db, PROVIDER, len(events))
        db.commit()
        return events

    except Exception as exc:
        logger.error("StubHub scrape error for %s: %s", city, exc)
        try:
            ScraperFramework.record_failure(db, PROVIDER, str(exc))
            db.commit()
        except Exception:
            db.rollback()
        return []
    finally:
        db.close()
