"""
Aggregate Explorer searches: optional internal catalog + enabled external APIs.

- ``SOURCES_ENABLED`` + credential checks gate each upstream (see ``api_limits.py``).
- After merge, Wayra (Gemini) may fill ``wayra_suggestion`` only when Yelp or
  Ticketmaster contributed rows — bounded by ``API_TIMEOUT_SECONDS``, failures
  leave suggestion unset.

Primary provider merge order among outbound APIs: Ticketmaster → Yelp → other
sources in ``BUCKET_MERGE_ORDER``.

Result cache keyed by normalized ``(location, query)`` reduces duplicate upstream
traffic within ``CACHE_TTL_SECONDS``.
"""
from __future__ import annotations

import logging
import threading
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FuturesTimeoutError
from typing import TYPE_CHECKING, Literal

from sqlalchemy import and_, or_, select

from app.core.api_limits import (
    API_TIMEOUT_SECONDS,
    CACHE_TTL_SECONDS,
    SOURCES_ENABLED,
)
from app.schemas.explorer import ExplorerResultItem, ExplorerSearchResponse
from app.services.explorer_normalize import make_item
from app.services.providers import (
    search_apify,
    search_eventbrite,
    search_google_places_native,
    search_serpapi_events,
    search_serpapi_places,
    search_ticketmaster,
    search_yelp,
    search_youtube,
)
from app.services.wayra_service import WayraService
from config import settings

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Merge order reflects product priority among enabled outbound providers (Gemini is not pooled).
BUCKET_MERGE_ORDER = (
    "ticketmaster",
    "yelp",
    "eventbrite",
    "google_places",
    "youtube",
    "serpapi_events",
    "serpapi_places",
    "apify",
)

PRIMARY_SOURCE_RANK = (
    "internal_db",
    "ticketmaster",
    "yelp",
    "gemini",
    "eventbrite",
    "google_places",
    "youtube",
    "serpapi",
    "apify",
)

_result_cache_lock = threading.Lock()
_result_cache: dict[tuple[str, str], tuple[float, ExplorerSearchResponse]] = {}


def _sources_flag_for_bucket(bucket: str) -> str:
    if bucket in ("serpapi_events", "serpapi_places"):
        return "serpapi"
    return bucket


def _has_credentials_for_bucket(bucket: str) -> bool:
    flag = _sources_flag_for_bucket(bucket)
    env = {
        "ticketmaster": settings.ticketmaster_api_key,
        "yelp": settings.yelp_api_key,
        "gemini": settings.gemini_api_key,
        "youtube": settings.youtube_api_key,
        "google_places": settings.google_places_api_key,
        "eventbrite": settings.eventbrite_token,
        "serpapi": settings.serpapi_key,
        "apify": settings.apify_token,
    }
    return bool((env.get(flag) or "").strip())


def _safe_call_provider(name: str, fn: object) -> list[ExplorerResultItem]:
    try:
        out = fn()  # type: ignore[misc]
        if not out:
            return []
        return list(out)
    except Exception as exc:
        logger.debug("Explorer provider %s error (swallowed): %s", name, exc)
        return []


def _peek_cached_aggregate(location: str, query: str) -> ExplorerSearchResponse | None:
    key = (location.strip().lower(), query.strip().lower())
    now = time.time()
    with _result_cache_lock:
        hit = _result_cache.get(key)
        if not hit:
            return None
        ts, resp = hit
        if now - ts > CACHE_TTL_SECONDS:
            del _result_cache[key]
            return None
        return ExplorerSearchResponse.model_validate(resp.model_dump())


def _store_cached_aggregate(location: str, query: str, resp: ExplorerSearchResponse) -> None:
    key = (location.strip().lower(), query.strip().lower())
    with _result_cache_lock:
        _result_cache[key] = (time.time(), resp)


def _internal_db(session: Session, q: str, location: str) -> list[ExplorerResultItem]:
    try:
        from app.models.explorer_item import ExplorerItem
    except Exception:
        return []

    try:
        db_rows = (
            session.execute(
                select(ExplorerItem)
                .where(
                    and_(
                        or_(
                            ExplorerItem.title.ilike(f"%{q}%"),
                            ExplorerItem.description.ilike(f"%{q}%"),
                        ),
                        ExplorerItem.city.ilike(f"%{location}%"),
                    ),
                )
                .limit(20),
            )
            .scalars()
            .all()
        )
    except Exception:
        return []

    out: list[ExplorerResultItem] = []
    for item in db_rows:
        src_type = item.source_type or "internal_db"
        low = src_type.lower()
        row_type: Literal["event", "place", "video"] = (
            "event" if ("event" in low or "ticket" in low) else "place"
        )
        price_val = float(item.price_from) if item.price_from is not None else None
        row = make_item(
            source="internal_db",
            type_=row_type,
            title=item.title,
            description=item.description,
            image_url=item.image_url or None,
            external_url=item.source_url or None,
            latitude=None,
            longitude=None,
            price=price_val,
            item_id=str(item.id),
            venue=item.venue or location,
            city=location,
            date_str="",
            is_free=bool(item.is_free),
        )
        row = row.model_copy(update={"source_type": src_type})
        out.append(row)
    return out


def _build_primary_provider_jobs(location: str, query: str) -> list[tuple[str, object]]:
    """
    Only enabled + credentialed sources. Gemini excluded (non-blocking enrichment path).

    Listed in execution/priority preference: Ticketmaster → Yelp → rest.
    """
    loc, q = location, query
    candidates: list[tuple[str, object]] = [
        ("ticketmaster", lambda: search_ticketmaster(loc, q)),
        ("yelp", lambda: search_yelp(loc, q)),
        ("eventbrite", lambda: search_eventbrite(loc, q)),
        ("google_places", lambda: search_google_places_native(loc, q)),
        ("youtube", lambda: search_youtube(loc, q)),
        ("serpapi_events", lambda: search_serpapi_events(loc, q)),
        ("serpapi_places", lambda: search_serpapi_places(loc, q)),
        ("apify", lambda: search_apify(loc, q)),
    ]
    jobs: list[tuple[str, object]] = []
    for bucket, thunk in candidates:
        if bucket == "gemini":
            continue
        flag = _sources_flag_for_bucket(bucket)
        if not SOURCES_ENABLED.get(flag, False):
            continue
        if not _has_credentials_for_bucket(bucket):
            continue
        jobs.append((bucket, thunk))
    return jobs


def _merged_has_ticketmaster_or_yelp(rows: list[ExplorerResultItem]) -> bool:
    for r in rows:
        src = (r.source or "").lower()
        if src in ("ticketmaster", "yelp"):
            return True
    return False


def run_explorer_aggregate_search(
    session: Session | None,
    location: str,
    query: str,
    *,
    max_results: int = 48,
) -> ExplorerSearchResponse:
    """Sync aggregate search with bounded parallel providers and safe fallbacks."""
    location = location.strip() or "Chicago"
    query = query.strip()

    cached = _peek_cached_aggregate(location, query)
    if cached is not None:
        return cached

    aggregated: list[ExplorerResultItem] = []
    if session is not None:
        try:
            aggregated.extend(_internal_db(session, query, location))
        except Exception as exc:
            logger.debug("Internal Explorer DB search failed: %s", exc)

    jobs = _build_primary_provider_jobs(location, query)
    buckets: dict[str, list[ExplorerResultItem]] = defaultdict(list)

    merged_from_providers: list[ExplorerResultItem] = []

    if jobs:
        max_workers = min(8, len(jobs))
        try:
            with ThreadPoolExecutor(max_workers=max_workers) as pool:
                future_by_label: dict[object, str] = {}
                for label, thunk in jobs:
                    fut = pool.submit(_safe_call_provider, label, thunk)
                    future_by_label[fut] = label

                for fut, label in future_by_label.items():
                    try:
                        rows = fut.result(timeout=API_TIMEOUT_SECONDS)
                        buckets[label] = list(rows or [])
                    except FuturesTimeoutError:
                        logger.warning(
                            "Explorer provider %s timed out after %ss",
                            label,
                            API_TIMEOUT_SECONDS,
                        )
                        buckets[label] = []
                    except Exception as exc:
                        logger.debug("Explorer provider %s wait failed: %s", label, exc)
                        buckets[label] = []
        except Exception as exc:
            logger.warning("Explorer parallel search setup failed: %s", exc)

        for key in BUCKET_MERGE_ORDER:
            merged_from_providers.extend(buckets.get(key, []))

        aggregated.extend(merged_from_providers)

    if not aggregated:
        return ExplorerSearchResponse(
            location=location,
            query=query,
            city=location,
            results=[],
            total=0,
            source="none",
            wayra_suggestion=(
                f"I couldn't find '{query}' — "
                f"try events, restaurants, or activities near {location}, "
                f"and add Explorer API keys in `.env`."
            ),
        )

    seen: set[tuple[str, str]] = set()
    unique: list[ExplorerResultItem] = []
    for row in aggregated:
        k = ((row.source or "").lower(), (row.title or "").strip().lower()[:96])
        if k in seen:
            continue
        seen.add(k)
        unique.append(row)
        if len(unique) >= max_results:
            break

    counts: dict[str, int] = defaultdict(int)
    for r in unique:
        counts[r.source] += 1

    primary = unique[0].source if unique else "none"
    for cand in PRIMARY_SOURCE_RANK:
        if counts.get(cand, 0) > 0:
            primary = cand
            break

    wayra: str | None = None
    if (
        query
        and unique
        and _merged_has_ticketmaster_or_yelp(merged_from_providers)
        and SOURCES_ENABLED.get("gemini", False)
        and _has_credentials_for_bucket("gemini")
    ):
        try:
            wayra = WayraService().generate_explorer_suggestion(
                query=query,
                location=location,
                results=unique,
            )
        except Exception as exc:
            logger.debug("Wayra explorer suggestion skipped: %s", exc)

    resp = ExplorerSearchResponse(
        location=location,
        query=query,
        city=location,
        results=unique,
        total=len(unique),
        source=primary,
        wayra_suggestion=wayra if wayra else None,
    )
    if unique:
        _store_cached_aggregate(location, query, resp)
    return resp


def explorer_response_to_wire(resp: ExplorerSearchResponse) -> dict:
    """Adds legacy frontend keys beside the unified Explorer payload."""
    d = resp.model_dump(mode="json")
    for row in d.get("results") or []:
        if isinstance(row, dict):
            row.setdefault("source_url", row.get("external_url"))
            row.setdefault("booking_type", "external_link")
            row.setdefault("thumbnail", row.get("image_url"))
    return d

