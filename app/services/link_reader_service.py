"""
app/services/link_reader_service.py — find named places in a pasted link (Collection).

Sources (owner decisions 2026-11-14, AGENTS.md section 4):
- YouTube: official Data API v3 `videos.list` only (title + description), capped at
  1,000 units/day. No yt-dlp, no transcripts, nothing stored from the API.
- Public articles: bounded, SSRF-checked fetch; text is read, not stored.
- Instagram / TikTok: NOT read (no crawling). The link is returned as link-only so the
  user can keep it in Unsorted.

Places are found with plain rules (app/services/place_extractor.py): no AI model, no extra
cost (owner decision 2026-11-15: Gemini is kept for Wayra only). City/country are normalised
against our own `places_directory`. No venue coordinates are produced or stored.
"""
from __future__ import annotations

import hashlib
import logging
import re
import threading
import time
import unicodedata
from datetime import datetime, timezone
from typing import Any
from urllib.parse import parse_qs, urlparse

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.place_extractor import extract_from_article, extract_from_description
from app.services.link_safety import UnsafeLinkError, assert_public_url, safe_fetch_text

logger = logging.getLogger(__name__)

MAX_CANDIDATES = 10
MAX_TEXT_CHARS = 12_000
YOUTUBE_DAILY_UNIT_CAP = 1_000
USER_LIMIT = 10  # link reads per user per window
USER_WINDOW_SECONDS = 3600

_rate_lock = threading.Lock()
_user_hits: dict[str, list[float]] = {}
_youtube_units: dict[str, int] = {}


# ── rate limiting ──────────────────────────────────────────────────────────────
def check_rate_limit(user_key: str, *, now: float | None = None) -> int | None:
    """Record a read. Returns seconds to wait if over the limit, else None."""
    t = time.time() if now is None else now
    with _rate_lock:
        hits = [h for h in _user_hits.get(user_key, []) if t - h < USER_WINDOW_SECONDS]
        if len(hits) >= USER_LIMIT:
            _user_hits[user_key] = hits
            return int(USER_WINDOW_SECONDS - (t - hits[0])) + 1
        hits.append(t)
        _user_hits[user_key] = hits
        return None


def reset_state_for_tests() -> None:
    with _rate_lock:
        _user_hits.clear()
        _youtube_units.clear()


# ── link classification ────────────────────────────────────────────────────────
def detect_platform(url: str) -> str:
    host = (urlparse(url).hostname or "").lower().removeprefix("www.")
    if host in {"youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"}:
        return "youtube"
    # Exact domain or a real subdomain: "notinstagram.com" is not Instagram.
    if host == "instagram.com" or host.endswith(".instagram.com") or host == "instagr.am":
        return "instagram"
    if host == "tiktok.com" or host.endswith(".tiktok.com"):
        return "tiktok"
    return "article"


def youtube_video_id(url: str) -> str | None:
    p = urlparse(url)
    host = (p.hostname or "").lower().removeprefix("www.")
    if host == "youtu.be":
        vid = p.path.strip("/").split("/")[0]
    elif p.path.startswith(("/shorts/", "/embed/", "/live/")):
        vid = p.path.split("/")[2] if len(p.path.split("/")) > 2 else ""
    else:
        vid = (parse_qs(p.query).get("v") or [""])[0]
    return vid if re.fullmatch(r"[A-Za-z0-9_-]{11}", vid or "") else None


def place_slug(name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")[:60]
    return slug or "p" + hashlib.sha1(name.encode("utf-8")).hexdigest()[:8]


def candidate_saved_from(url: str, name: str) -> str:
    """One stable key per place in a link, so several places from one link all save."""
    suffix = f"#place={place_slug(name)}"
    base = url.split("#", 1)[0][: 500 - len(suffix)]  # cut the link, never the place part
    return f"{base}{suffix}"


# ── fetching ───────────────────────────────────────────────────────────────────
def fetch_youtube(video_id: str, api_key: str | None) -> tuple[str, str] | None:
    """Official Data API: one videos.list call (1 unit). Returns (title, description)."""
    snip = fetch_youtube_snippet(video_id, api_key)
    return (snip["title"], snip["description"]) if snip else None


def fetch_youtube_snippet(video_id: str, api_key: str | None) -> dict[str, str] | None:
    """One videos.list call (1 unit): title, description, channel, thumbnail URL.

    Nothing here is stored. The thumbnail URL is hot-linked by the browser, unaltered.
    """
    if not api_key:
        return None
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with _rate_lock:
        if _youtube_units.get(day, 0) >= YOUTUBE_DAILY_UNIT_CAP:
            logger.warning("YouTube link-reader daily cap reached")
            return None
        _youtube_units[day] = _youtube_units.get(day, 0) + 1
    try:
        resp = httpx.get(
            "https://www.googleapis.com/youtube/v3/videos",
            params={"part": "snippet", "id": video_id, "key": api_key},
            timeout=8.0,
        )
        resp.raise_for_status()
        items = resp.json().get("items") or []
    except Exception as exc:
        logger.warning("YouTube videos.list failed: %s", type(exc).__name__)
        return None
    if not items:
        return None
    snippet = items[0].get("snippet") or {}
    thumbs = snippet.get("thumbnails") or {}
    best = thumbs.get("medium") or thumbs.get("high") or thumbs.get("default") or {}
    thumb = str(best.get("url") or "")
    return {
        "title": str(snippet.get("title") or "")[:300],
        "description": str(snippet.get("description") or "")[:MAX_TEXT_CHARS],
        "channel": str(snippet.get("channelTitle") or "")[:120],
        "thumbnail_url": thumb if thumb.startswith("https://") else "",
    }


def parse_article(html: str) -> tuple[str, str]:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "noscript", "svg"]):
        tag.decompose()
    og = soup.find("meta", property="og:title")
    title = (og.get("content") if og and og.get("content") else (soup.title.string if soup.title else "")) or ""
    parts: list[str] = []
    for el in soup.find_all(["h1", "h2", "h3", "li", "p"]):
        t = " ".join(el.get_text(" ", strip=True).split())
        if t:
            parts.append(t)
    text_body = "\n".join(parts)[:MAX_TEXT_CHARS]
    return " ".join(str(title).split())[:300], text_body


# ── extraction ─────────────────────────────────────────────────────────────────
def _clean(v: Any, limit: int) -> str | None:
    if not isinstance(v, str):
        return None
    t = " ".join(v.split()).strip()
    return t[:limit] if t else None


def normalise_candidates(raw: list[dict[str, Any]], url: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for d in raw:
        name = _clean(d.get("name"), 200)
        if not name:
            continue
        city = _clean(d.get("city"), 120)
        key = (name.lower(), (city or "").lower())
        if key in seen:
            continue
        seen.add(key)
        out.append(
            {
                "name": name,
                "city": city,
                "country": _clean(d.get("country"), 120),
                "category": _clean(d.get("category"), 80),
                "subcategory": None,
                "match_status": "unknown",
                "saved_from": candidate_saved_from(url, name),
            }
        )
        if len(out) >= MAX_CANDIDATES:
            break
    return out


def resolve_city(db: Session | None, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Normalise city/country against our own places_directory; set match_status.

    sure   = city found in our directory
    unsure = a city was named but we cannot confirm it
    unknown = no city given
    No venue coordinates are looked up or stored.
    """
    cache: dict[str, tuple[str, str] | None] = {}
    for c in candidates:
        city = c.get("city")
        if not city:
            c["match_status"] = "unknown"
            continue
        key = city.lower()
        if key not in cache:
            cache[key] = _directory_city(db, city)
        hit = cache[key]
        if hit:
            c["city"], c["country"] = hit[0], c.get("country") or hit[1]
            c["match_status"] = "sure"
        else:
            c["match_status"] = "unsure"
    return candidates


def _directory_city(db: Session | None, city: str) -> tuple[str, str] | None:
    if db is None:
        return None
    try:
        if db.bind is None or db.bind.dialect.name != "postgresql":
            return None
        # A savepoint: a failed lookup must not leave the whole request's transaction aborted.
        with db.begin_nested():
            row = db.execute(
                text(
                    "SELECT d.name, COALESCE(c.name, d.country_code) AS country "
                    "FROM places_directory d "
                    "LEFT JOIN places_directory c ON c.kind = 'country' AND c.slug = lower(d.country_code) "
                    "WHERE d.kind = 'city' AND lower(d.name) = lower(:city) "
                    "ORDER BY d.population DESC NULLS LAST LIMIT 1"
                ),
                {"city": city},
            ).first()
    except Exception as exc:
        logger.warning("places_directory city lookup failed: %s", type(exc).__name__)
        return None
    return (str(row[0]), str(row[1])) if row else None


# ── entry point ────────────────────────────────────────────────────────────────
def read_link(url: str, *, db: Session | None = None, youtube_key: str | None = None) -> dict[str, Any]:
    """Read a link. Never raises for unreadable pages: returns link_only with a reason."""
    platform = detect_platform(url)
    label = {"youtube": "YouTube", "instagram": "Instagram", "tiktok": "TikTok"}.get(platform)
    host = (urlparse(url).hostname or "link").removeprefix("www.")
    result: dict[str, Any] = {
        "source_title": host,
        "source_label": label or host,
        "source_url": url,
        "candidates": [],
        "link_only": True,
        "message": None,
        "preview": {"platform": label or host} if (label or host) else None,
    }

    if platform in {"instagram", "tiktok"}:
        result["message"] = (
            f"Rovvy does not read {label} posts. You can keep the link in Unsorted "
            "and add the place by name."
        )
        return result

    candidates_raw: list[dict[str, Any]]
    if platform == "youtube":
        vid = youtube_video_id(url)
        got = fetch_youtube_snippet(vid, youtube_key) if vid else None
        if not got:
            result["message"] = "We could not read that video. You can keep the link in Unsorted."
            return result
        title, body = got["title"], got["description"]
        result["preview"] = {
            "platform": "YouTube",
            "author": got["channel"] or None,
            "thumbnail_url": got["thumbnail_url"] or None,
            "video_id": vid,
        }
        candidates_raw = extract_from_description(title, body)
    else:
        try:
            final_url, html = safe_fetch_text(url)
        except UnsafeLinkError as exc:
            result["message"] = f"{exc} You can keep the link in Unsorted."
            return result
        title, body = parse_article(html)
        result["source_url"] = url
        candidates_raw = extract_from_article(html, title)

    result["source_title"] = title or host
    if not (title or body).strip():
        result["message"] = "That page had no readable text. You can keep the link in Unsorted."
        return result

    candidates = resolve_city(db, normalise_candidates(candidates_raw, url))
    if not candidates:
        result["message"] = (
            "We could not find a named place in that link. You can keep the link in Unsorted."
        )
        return result

    result["candidates"] = candidates
    result["link_only"] = False
    result["message"] = "Rovvy picked these names out of the page. Check each place before saving."
    return result


__all__ = [
    "assert_public_url",
    "check_rate_limit",
    "read_link",
]
