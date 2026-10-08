"""Standalone generic, config-driven event scraper.
This module supports source configuration entries that define URL templates and
optional selector overrides. It prioritizes JSON-LD schema.org Event parsing,
then falls back to generic HTML card/link scraping when JSON-LD is unavailable.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import random
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx
from bs4 import BeautifulSoup

from app.services.scraper_framework import ScraperFramework
from app.utils.database import SessionLocal

logger = logging.getLogger(__name__)

_DEFAULT_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
]
_DEFAULT_LINK_PATTERN = re.compile(r"(event|events|ticket|tickets|show|concert|festival)", re.IGNORECASE)
_DEFAULT_TIMEOUT_SECONDS = 20.0
_DEFAULT_RETRY_ATTEMPTS = 3
_DEFAULT_RETRY_BACKOFF_SECONDS = 0.75
_ROBOTS_CACHE_TTL_SECONDS = 3600


def load_sources_config(path: str | Path) -> list[dict[str, Any]]:
    """Load source configurations from a JSON file."""
    file_path = Path(path)
    payload = json.loads(file_path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        sources = payload.get("sources", [])
        if isinstance(sources, list):
            return [item for item in sources if isinstance(item, dict)]
    return []


class GenericEventScraper:
    """Config-driven event scraper with robots gating, retries, and dedup."""

    def __init__(
        self,
        *,
        timeout_seconds: float = _DEFAULT_TIMEOUT_SECONDS,
        retry_attempts: int = _DEFAULT_RETRY_ATTEMPTS,
        retry_backoff_seconds: float = _DEFAULT_RETRY_BACKOFF_SECONDS,
        user_agents: list[str] | None = None,
    ) -> None:
        self.timeout_seconds = timeout_seconds
        self.retry_attempts = retry_attempts
        self.retry_backoff_seconds = retry_backoff_seconds
        self.user_agents = user_agents or _DEFAULT_USER_AGENTS
        self._robots_cache: dict[tuple[str, str], tuple[float, RobotFileParser]] = {}
        self._last_request_time_by_source: dict[str, float] = {}

    async def scrape_source(
        self,
        source: dict[str, Any],
        *,
        city: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """Fetch and parse one source using its URL template and selectors."""
        provider = str(source.get("name") or "generic_source").strip() or "generic_source"
        default_city = str(source.get("default_city") or "").strip()
        chosen_city = str(city or default_city).strip()
        city_slug = self._slugify(chosen_city or default_city)
        url_template = str(source.get("url") or "").strip()

        if not url_template:
            return []

        target_url = url_template.replace("{city_slug}", city_slug).replace("{city}", chosen_city)
        selected_user_agent = random.choice(self.user_agents)
        try:
            if not await self._is_allowed_by_robots(target_url, selected_user_agent):
                logger.info("Robots disallowed scraping for provider=%s url=%s", provider, target_url)
                return []

            html = await self._fetch_page(provider, target_url, source, selected_user_agent)
            parsed = self.parse_events(
                html=html,
                source=source,
                default_city=chosen_city or default_city,
                base_url=target_url,
            )
            return parsed[:limit]
        except Exception as exc:
            logger.error("Generic scrape failed provider=%s city=%s error=%s", provider, chosen_city, exc)
            self._record_failure(provider, str(exc))
            return []

    def parse_events(
        self,
        *,
        html: str,
        source: dict[str, Any],
        default_city: str,
        base_url: str,
    ) -> list[dict[str, Any]]:
        """Parse events from HTML with JSON-LD-first fallback pipeline."""
        soup = BeautifulSoup(html, "html.parser")
        events = self._parse_json_ld_events(soup, default_city=default_city)
        if not events:
            events = self._parse_fallback_cards(
                soup=soup,
                source=source,
                default_city=default_city,
                base_url=base_url,
            )
        return self._dedupe_events(events)

    async def _fetch_page(
        self,
        provider: str,
        url: str,
        source: dict[str, Any],
        user_agent: str,
    ) -> str:
        for attempt in range(1, self.retry_attempts + 1):
            await self._respect_rate_limit(source)
            headers = {
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-US,en;q=0.9",
                "User-Agent": user_agent,
            }
            try:
                async with httpx.AsyncClient(timeout=self.timeout_seconds, follow_redirects=True) as client:
                    resp = await client.get(url, headers=headers)
                if resp.status_code >= 500 and attempt < self.retry_attempts:
                    await asyncio.sleep(self.retry_backoff_seconds * attempt)
                    continue
                resp.raise_for_status()
                return resp.text
            except (httpx.TimeoutException, httpx.RequestError, httpx.HTTPStatusError) as exc:
                if attempt >= self.retry_attempts:
                    raise RuntimeError(f"request failed after retries: {exc}") from exc
                await asyncio.sleep(self.retry_backoff_seconds * attempt)
        raise RuntimeError("unreachable fetch retry state")

    async def _is_allowed_by_robots(self, target_url: str, user_agent: str) -> bool:
        parsed = urlparse(target_url)
        if not parsed.scheme or not parsed.netloc:
            return False
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        parser = await self._get_robots_parser(robots_url, user_agent)
        return parser.can_fetch(user_agent, target_url)

    async def _get_robots_parser(self, robots_url: str, user_agent: str) -> RobotFileParser:
        now = time.time()
        cache_key = (robots_url, user_agent)
        cached = self._robots_cache.get(cache_key)
        if cached and now - cached[0] < _ROBOTS_CACHE_TTL_SECONDS:
            return cached[1]

        parser = RobotFileParser()
        headers = {"User-Agent": user_agent}
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(robots_url, headers=headers)
            if resp.status_code == 200:
                parser.parse(resp.text.splitlines())
            else:
                parser.parse(["User-agent: *", "Disallow: /"])
        except Exception:
            parser.parse(["User-agent: *", "Disallow: /"])

        self._robots_cache[cache_key] = (now, parser)
        return parser

    async def _respect_rate_limit(self, source: dict[str, Any]) -> None:
        source_name = str(source.get("name") or "generic_source")
        delay = float(source.get("request_delay_seconds", 1.0))
        jitter = float(source.get("request_jitter_seconds", 0.2))
        last_ts = self._last_request_time_by_source.get(source_name)
        now = time.monotonic()
        if last_ts is not None:
            remaining = delay - (now - last_ts)
            if remaining > 0:
                await asyncio.sleep(remaining)
        if jitter > 0:
            await asyncio.sleep(random.uniform(0.0, jitter))
        self._last_request_time_by_source[source_name] = time.monotonic()

    def _parse_json_ld_events(self, soup: BeautifulSoup, *, default_city: str) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        for obj in self._collect_json_ld_objects(soup):
            parsed = self._parse_event_object(obj, default_city=default_city)
            if parsed:
                results.append(parsed)
        return results

    def _parse_fallback_cards(
        self,
        *,
        soup: BeautifulSoup,
        source: dict[str, Any],
        default_city: str,
        base_url: str,
    ) -> list[dict[str, Any]]:
        selectors = source.get("selectors")
        selector_map = selectors if isinstance(selectors, dict) else {}

        card_selectors = self._source_value(source, selector_map, "card_selectors")
        if not isinstance(card_selectors, list):
            card_selectors = ["article", "li", "div"]

        link_selector = str(self._source_value(source, selector_map, "link_selector") or "a[href]")
        link_pattern_raw = self._source_value(source, selector_map, "link_pattern")
        link_pattern = re.compile(str(link_pattern_raw), re.IGNORECASE) if link_pattern_raw else _DEFAULT_LINK_PATTERN

        title_selector = self._source_value(source, selector_map, "title_selector")
        date_selector = self._source_value(source, selector_map, "date_selector")
        venue_selector = self._source_value(source, selector_map, "venue_selector")
        image_selector = self._source_value(source, selector_map, "image_selector")

        events: list[dict[str, Any]] = []
        for card_selector in card_selectors:
            for card in soup.select(str(card_selector)):
                links = card.select(link_selector)
                for link in links:
                    href = str(link.get("href") or "").strip()
                    if not href or not link_pattern.search(href):
                        continue
                    event_url = urljoin(base_url, href)
                    title = self._extract_title(card, link, title_selector)
                    if not title:
                        continue
                    date_text = self._extract_selector_text(card, date_selector) if date_selector else ""
                    if not date_text:
                        time_node = card.find("time")
                        if time_node:
                            date_text = str(time_node.get("datetime") or time_node.get_text(" ", strip=True))
                    venue_name = self._extract_selector_text(card, venue_selector) if venue_selector else None
                    image_url = self._extract_image_url(card, image_selector, base_url)
                    events.append(
                        {
                            "provider_event_id": self._provider_event_id(event_url),
                            "title": title,
                            "url": event_url,
                            "start_datetime": self._parse_start_datetime(date_text),
                            "venue_name": venue_name or None,
                            "venue_city": default_city,
                            "image_url": image_url,
                            "price_min": None,
                            "price_max": None,
                            "currency": str(source.get("currency") or "USD"),
                            "category": str(source.get("category") or "event"),
                        }
                    )
            if events:
                break
        return events

    @staticmethod
    def _source_value(source: dict[str, Any], selector_map: dict[str, Any], key: str) -> Any:
        if key in source:
            return source[key]
        return selector_map.get(key)

    @staticmethod
    def _collect_json_ld_objects(soup: BeautifulSoup) -> list[dict[str, Any]]:
        objects: list[dict[str, Any]] = []
        for script in soup.find_all("script", type="application/ld+json"):
            raw = script.string or script.get_text() or ""
            if not raw.strip():
                continue
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                continue
            for obj in GenericEventScraper._flatten_ld_payload(payload):
                if isinstance(obj, dict):
                    objects.append(obj)
        return objects

    @staticmethod
    def _flatten_ld_payload(payload: Any) -> list[Any]:
        if isinstance(payload, list):
            flattened: list[Any] = []
            for item in payload:
                flattened.extend(GenericEventScraper._flatten_ld_payload(item))
            return flattened
        if isinstance(payload, dict):
            graph = payload.get("@graph")
            if isinstance(graph, list):
                return [item for item in graph if isinstance(item, dict)]
            return [payload]
        return []

    def _parse_event_object(self, obj: dict[str, Any], *, default_city: str) -> dict[str, Any] | None:
        if not self._is_event_type(obj):
            return None
        title = str(obj.get("name") or "").strip()
        url = str(obj.get("url") or "").strip()
        if not title or not url:
            return None

        venue_name, venue_city = self._parse_location(obj.get("location"), default_city)
        price_min, price_max, currency = self._parse_offers(obj.get("offers"))
        category = "event"
        for key in ("eventAttendanceMode", "eventStatus", "category"):
            value = obj.get(key)
            if isinstance(value, str) and value.strip():
                category = value.strip().lower().replace("_", " ")
                break

        return {
            "provider_event_id": self._provider_event_id(url),
            "title": title,
            "url": url,
            "start_datetime": self._parse_start_datetime(obj.get("startDate")),
            "venue_name": venue_name or None,
            "venue_city": venue_city or default_city,
            "image_url": self._parse_image(obj.get("image")),
            "price_min": price_min,
            "price_max": price_max,
            "currency": currency,
            "category": category,
        }

    @staticmethod
    def _is_event_type(obj: dict[str, Any]) -> bool:
        event_type = obj.get("@type")
        if isinstance(event_type, list):
            return any("Event" in str(item) for item in event_type)
        return "Event" in str(event_type or "")

    @staticmethod
    def _provider_event_id(url: str | None) -> str:
        return hashlib.sha256((url or "").strip().encode()).hexdigest()[:16]

    @staticmethod
    def _normalize_url(value: str | None) -> str:
        if not value:
            return ""
        return value.strip().rstrip("/")

    def _dedupe_events(self, events: list[dict[str, Any]]) -> list[dict[str, Any]]:
        seen_keys: set[str] = set()
        deduped: list[dict[str, Any]] = []
        for event in events:
            normalized_url = self._normalize_url(str(event.get("url") or ""))
            provider_event_id = str(event.get("provider_event_id") or "")
            if normalized_url:
                dedupe_key = normalized_url
            elif provider_event_id:
                dedupe_key = f"provider:{provider_event_id}"
            else:
                seed_parts = [
                    str(event.get("url") or ""),
                    str(event.get("title") or ""),
                    str(event.get("start_datetime") or ""),
                    str(event.get("venue_name") or ""),
                    str(event.get("venue_city") or ""),
                    str(event.get("category") or ""),
                ]
                dedupe_key = hashlib.sha256("|".join(seed_parts).encode()).hexdigest()[:16]
            if not dedupe_key:
                dedupe_key = hashlib.sha256(
                    str(event.get("title") or event.get("start_datetime") or "").encode()
                ).hexdigest()[:16]
                event["provider_event_id"] = dedupe_key
            if dedupe_key in seen_keys:
                continue
            seen_keys.add(dedupe_key)
            if not event.get("provider_event_id"):
                seed = normalized_url or dedupe_key or str(event.get("title") or "")
                event["provider_event_id"] = hashlib.sha256(seed.encode()).hexdigest()[:16]
            deduped.append(event)
        return deduped

    @staticmethod
    def _parse_offers(offers: Any) -> tuple[float | None, float | None, str]:
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

    @staticmethod
    def _parse_location(location: Any, default_city: str) -> tuple[str, str]:
        if not isinstance(location, dict):
            return "", default_city
        venue_name = str(location.get("name") or "")
        venue_city = default_city
        address = location.get("address")
        if isinstance(address, dict):
            venue_city = str(address.get("addressLocality") or address.get("locality") or default_city)
        return venue_name, venue_city

    @staticmethod
    def _parse_image(image: Any) -> str | None:
        if isinstance(image, str) and image.strip():
            return image.strip()
        if isinstance(image, dict):
            image_url = image.get("url")
            if isinstance(image_url, str) and image_url.strip():
                return image_url.strip()
        if isinstance(image, list):
            for item in image:
                parsed = GenericEventScraper._parse_image(item)
                if parsed:
                    return parsed
        return None

    @staticmethod
    def _parse_start_datetime(value: Any) -> datetime | None:
        if not value:
            return None
        text = str(value).strip()
        if not text:
            return None

        candidates = [text]
        if text.endswith("Z"):
            candidates.append(text.replace("Z", "+00:00"))

        for candidate in candidates:
            try:
                return datetime.fromisoformat(candidate)
            except ValueError:
                continue

        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%b %d, %Y", "%B %d, %Y"):
            try:
                return datetime.strptime(text, fmt)
            except ValueError:
                continue
        return None

    @staticmethod
    def _extract_selector_text(card: Any, selector: Any) -> str:
        if not selector:
            return ""
        node = card.select_one(str(selector))
        if not node:
            return ""
        return node.get_text(" ", strip=True)

    def _extract_title(self, card: Any, link: Any, selector: Any) -> str:
        if selector:
            explicit = self._extract_selector_text(card, selector)
            if explicit:
                return explicit
        text = link.get_text(" ", strip=True)
        if text:
            return text
        for tag in ("h1", "h2", "h3", "h4"):
            node = card.find(tag)
            if node:
                maybe = node.get_text(" ", strip=True)
                if maybe:
                    return maybe
        return ""

    @staticmethod
    def _extract_image_url(card: Any, selector: Any, base_url: str) -> str | None:
        node = card.select_one(str(selector)) if selector else card.find("img")
        if not node:
            return None
        src = str(node.get("src") or node.get("data-src") or "").strip()
        if not src:
            return None
        return urljoin(base_url, src)

    @staticmethod
    def _slugify(value: str) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", (value or "").strip().lower())
        slug = re.sub(r"-{2,}", "-", slug).strip("-")
        return slug

    @staticmethod
    def _record_failure(provider: str, error: str) -> None:
        db = SessionLocal()
        try:
            ScraperFramework.record_failure(db, provider, error)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()
 
