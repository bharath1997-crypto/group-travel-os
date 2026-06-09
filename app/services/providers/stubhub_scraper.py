"""StubHub price scraper — HTML search, no API key."""
from __future__ import annotations

import random
import re
from datetime import date, datetime, timedelta
from urllib.parse import quote_plus

import httpx
from bs4 import BeautifulSoup
from rapidfuzz import fuzz

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
