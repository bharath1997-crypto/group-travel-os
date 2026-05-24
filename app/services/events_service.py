"""
Multi-source Event Discovery Aggregator (Ticketmaster, Yelp, Eventbrite, Bandsintown).

Combines results in parallel, deduplicates, sorts chronologically, and returns standard schema.
"""
from __future__ import annotations

import logging
import time
from typing import Any
import concurrent.futures

import httpx

from app.core.api_limits import API_TIMEOUT_SECONDS
from config import settings

logger = logging.getLogger(__name__)

TICKETMASTER_URL = "https://app.ticketmaster.com/discovery/v2/events.json"
TTL_SECONDS = 21_600  # 6 hours

_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}


def _cache_key(city: str) -> str:
    return city.strip().lower()


def get_events(city: str) -> list[dict[str, Any]]:
    """Return up to 5 upcoming events for a city (name, date, venue, url)."""
    city = (city or "").strip()
    if not city:
        return []

    key = _cache_key(city)
    now = time.time()
    cached = _cache.get(key)
    if cached and now < cached[0]:
        return list(cached[1])

    api_key = (settings.ticketmaster_api_key or "").strip()
    if not api_key:
        return []

    params = {
        "city": city,
        "apikey": api_key,
        "size": 5,
        "sort": "date,asc",
    }

    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            resp = client.get(TICKETMASTER_URL, params=params)
        if resp.status_code != 200:
            logger.warning("Ticketmaster HTTP %s for city=%s", resp.status_code, city)
            return []

        data = resp.json()
        emb = data.get("_embedded")
        if not isinstance(emb, dict):
            return []
        raw_events = emb.get("events")
        if not isinstance(raw_events, list):
            return []

        out: list[dict[str, Any]] = []
        for raw in raw_events[:5]:
            if not isinstance(raw, dict):
                continue
            name = str(raw.get("name") or "Event")
            url = str(raw.get("url") or "")
            date_str = ""
            dates = raw.get("dates")
            if isinstance(dates, dict):
                start = dates.get("start")
                if isinstance(start, dict):
                    date_str = str(
                        start.get("localDate")
                        or start.get("dateTime")
                        or start.get("localDateTime")
                        or ""
                    )
            venue = ""
            ven_emb = raw.get("_embedded")
            if isinstance(ven_emb, dict):
                venues = ven_emb.get("venues")
                if isinstance(venues, list) and venues and isinstance(venues[0], dict):
                    venue = str(venues[0].get("name") or "")

            out.append(
                {
                    "name": name,
                    "date": date_str,
                    "venue": venue,
                    "url": url,
                }
            )

        _cache[key] = (now + TTL_SECONDS, out)
        return out
    except Exception as exc:
        logger.warning("Ticketmaster fetch failed for city=%s: %s", city, exc)
        return []


def _fetch_ticketmaster_events(
    city: str,
    category: str = "all",
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 20
) -> list[dict[str, Any]]:
    api_key = (settings.ticketmaster_api_key or "").strip()
    if not api_key:
        return []

    classification_name = None
    keyword = None
    if category and category.lower() != "all":
        cat_lower = category.lower()
        if cat_lower == "music":
            classification_name = "music"
        elif cat_lower == "sports":
            classification_name = "sports"
        elif cat_lower == "arts":
            classification_name = "Arts & Theatre"
        elif cat_lower == "family":
            classification_name = "family"
        elif cat_lower == "food":
            classification_name = "food"
        elif cat_lower == "festival":
            keyword = "festival"

    params: dict[str, Any] = {
        "city": city,
        "apikey": api_key,
        "size": limit,
        "sort": "date,asc",
    }

    if classification_name:
        params["classificationName"] = classification_name
    if keyword:
        params["keyword"] = keyword

    if date_from:
        params["startDateTime"] = f"{date_from}T00:00:00Z"
    if date_to:
        params["endDateTime"] = f"{date_to}T23:59:59Z"

    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            resp = client.get(TICKETMASTER_URL, params=params)
        if resp.status_code != 200:
            return []

        data = resp.json()
        emb = data.get("_embedded")
        if not isinstance(emb, dict):
            return []
        raw_events = emb.get("events")
        if not isinstance(raw_events, list):
            return []

        events = []
        for raw in raw_events:
            if not isinstance(raw, dict):
                continue
            
            eid = str(raw.get("id") or "")
            name = str(raw.get("name") or "Event")
            url = str(raw.get("url") or "")
            
            img_url = None
            images = raw.get("images", [])
            if isinstance(images, list) and images:
                best = None
                for im in images:
                    if not isinstance(im, dict):
                        continue
                    w = int(im.get("width") or 0)
                    u = im.get("url")
                    if isinstance(u, str) and (best is None or w > best[0]):
                        best = (w, u)
                if best:
                    img_url = best[1]

            category_val = "All"
            classifications = raw.get("classifications", [])
            if classifications and isinstance(classifications, list) and isinstance(classifications[0], dict):
                segment = classifications[0].get("segment", {})
                if isinstance(segment, dict) and segment.get("name"):
                    category_val = str(segment.get("name"))

            date_str = ""
            time_str = "19:00"
            dates = raw.get("dates", {})
            if isinstance(dates, dict):
                start = dates.get("start", {})
                if isinstance(start, dict):
                    date_str = str(start.get("localDate") or "")
                    local_time = start.get("localTime")
                    if local_time:
                        time_str = str(local_time)[:5]

            venue_name = "Various Venues"
            country_code = "US"
            city_name = city
            
            ven_emb = raw.get("_embedded", {})
            if isinstance(ven_emb, dict):
                venues = ven_emb.get("venues")
                if isinstance(venues, list) and venues and isinstance(venues[0], dict):
                    v0 = venues[0]
                    venue_name = str(v0.get("name") or "Venue")
                    if v0.get("country") and isinstance(v0.get("country"), dict):
                        country_code = str(v0.get("country").get("countryCode") or "US")
                    if v0.get("city") and isinstance(v0.get("city"), dict):
                        city_name = str(v0.get("city").get("name") or city)

            price_min = None
            price_max = None
            price_ranges = raw.get("priceRanges", [])
            if price_ranges and isinstance(price_ranges, list) and isinstance(price_ranges[0], dict):
                p0 = price_ranges[0]
                try:
                    price_min = float(p0.get("min")) if p0.get("min") is not None else None
                    price_max = float(p0.get("max")) if p0.get("max") is not None else None
                except (TypeError, ValueError):
                    pass

            events.append({
                "id": eid,
                "name": name,
                "category": category_val,
                "date": date_str,
                "time": time_str,
                "venue": venue_name,
                "city": city_name,
                "country": country_code,
                "image_url": img_url,
                "ticket_url": url,
                "price_min": price_min,
                "price_max": price_max,
                "source": "ticketmaster"
            })
        return events
    except Exception as exc:
        logger.warning("Ticketmaster _fetch_ticketmaster_events failed: %s", exc)
        return []


def _fetch_yelp_events(city: str, category: str = "all", limit: int = 20) -> list[dict[str, Any]]:
    api_key = (settings.yelp_api_key or "").strip()
    if not api_key:
        return []

    url = "https://api.yelp.com/v3/events"
    headers = {"Authorization": f"Bearer {api_key}"}
    params = {"location": city, "limit": limit}

    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            resp = client.get(url, headers=headers, params=params)
        if resp.status_code != 200:
            return []

        data = resp.json()
        raw_events = data.get("events")
        if not isinstance(raw_events, list):
            return []

        events = []
        for raw in raw_events:
            if not isinstance(raw, dict):
                continue
            
            yelp_cat = str(raw.get("category") or "other")
            normalized_cat = "All"
            if "music" in yelp_cat:
                normalized_cat = "Music"
            elif "sport" in yelp_cat:
                normalized_cat = "Sports"
            elif "art" in yelp_cat or "theat" in yelp_cat or "fashion" in yelp_cat:
                normalized_cat = "Arts"
            elif "family" in yelp_cat or "kid" in yelp_cat:
                normalized_cat = "Family"
            elif "food" in yelp_cat or "drink" in yelp_cat:
                normalized_cat = "Food"
            elif "festiv" in yelp_cat or "fair" in yelp_cat:
                normalized_cat = "Festival"

            if category and category.lower() != "all":
                if normalized_cat.lower() != category.lower():
                    continue

            start_time_raw = raw.get("time_start") or ""
            date_str = ""
            time_str = "19:00"
            if start_time_raw:
                try:
                    parts = start_time_raw.split("T")
                    date_str = parts[0]
                    if len(parts) > 1:
                        time_str = parts[1][:5]
                except Exception:
                    pass

            location_dict = raw.get("location") or {}
            venue_str = raw.get("description") or "Local Attraction"
            if isinstance(location_dict, dict):
                address1 = location_dict.get("address1")
                if address1:
                    venue_str = address1
            
            cost = raw.get("cost")
            price_min = float(cost) if cost is not None else None

            events.append({
                "id": str(raw.get("id") or ""),
                "name": str(raw.get("name") or "Yelp Event"),
                "category": normalized_cat,
                "date": date_str,
                "time": time_str,
                "venue": venue_str,
                "city": city,
                "country": "US",
                "image_url": raw.get("image_url"),
                "ticket_url": raw.get("tickets_url") or raw.get("event_site_url") or "",
                "price_min": price_min,
                "price_max": price_min,
                "source": "yelp"
            })
        return events
    except Exception as exc:
        logger.warning("Yelp _fetch_yelp_events failed: %s", exc)
        return []


def _fetch_eventbrite_events(city: str, category: str = "all", limit: int = 20) -> list[dict[str, Any]]:
    token = (settings.eventbrite_token or "").strip()
    if not token:
        return []

    url = "https://www.eventbriteapi.com/v3/events/search/"
    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "q": city,
        "expand": "venue",
        "sort_by": "date",
    }

    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            resp = client.get(url, headers=headers, params=params)
        if resp.status_code != 200:
            return []

        data = resp.json()
        raw_events = data.get("events")
        if not isinstance(raw_events, list):
            return []

        events = []
        for raw in raw_events[:limit]:
            if not isinstance(raw, dict):
                continue
            
            normalized_cat = "All"
            
            start_dict = raw.get("start") or {}
            date_str = ""
            time_str = "19:00"
            if isinstance(start_dict, dict):
                local_time = start_dict.get("local") or ""
                if local_time:
                    try:
                        parts = local_time.split("T")
                        date_str = parts[0]
                        if len(parts) > 1:
                            time_str = parts[1][:5]
                    except Exception:
                        pass

            venue_dict = raw.get("venue") or {}
            venue_name = "Various Venues"
            country_code = "US"
            if isinstance(venue_dict, dict):
                venue_name = venue_dict.get("name") or venue_dict.get("address", {}).get("address_1") or "Venue"
                country_code = venue_dict.get("address", {}).get("country") or "US"

            img_dict = raw.get("logo") or {}
            img_url = None
            if isinstance(img_dict, dict):
                original = img_dict.get("original") or {}
                if isinstance(original, dict):
                    img_url = original.get("url")

            events.append({
                "id": str(raw.get("id") or ""),
                "name": str(raw.get("name", {}).get("text") or "Eventbrite Event"),
                "category": normalized_cat,
                "date": date_str,
                "time": time_str,
                "venue": venue_name,
                "city": city,
                "country": country_code,
                "image_url": img_url,
                "ticket_url": raw.get("url") or "",
                "price_min": None,
                "price_max": None,
                "source": "eventbrite"
            })
        return events
    except Exception as exc:
        logger.warning("Eventbrite _fetch_eventbrite_events failed: %s", exc)
        return []


def _fetch_bandsintown_events(city: str, category: str = "all", limit: int = 20) -> list[dict[str, Any]]:
    # Bandsintown is strictly music. If a different specific category was requested, skip.
    if category and category.lower() != "all" and category.lower() != "music":
        return []

    url = "https://rest.bandsintown.com/v4/events"
    app_id = (getattr(settings, "bandsintown_app_id", None) or "rovvy_app").strip()
    params = {
        "app_id": app_id,
        "location": city,
        "per_page": limit,
    }

    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            resp = client.get(url, params=params)
        if resp.status_code != 200:
            return []

        raw_events = resp.json()
        if not isinstance(raw_events, list):
            return []

        events = []
        for raw in raw_events:
            if not isinstance(raw, dict):
                continue
            
            datetime_raw = raw.get("datetime") or ""
            date_str = ""
            time_str = "19:00"
            if datetime_raw:
                try:
                    parts = datetime_raw.split("T")
                    date_str = parts[0]
                    if len(parts) > 1:
                        time_str = parts[1][:5]
                except Exception:
                    pass

            venue_dict = raw.get("venue") or {}
            venue_name = "Various Venues"
            country_code = "US"
            if isinstance(venue_dict, dict):
                venue_name = venue_dict.get("name") or "Venue"
                country_code = venue_dict.get("country") or "US"

            lineup = raw.get("lineup") or []
            artist_name = lineup[0] if lineup else "Concert"
            
            offers = raw.get("offers") or []
            ticket_url = raw.get("url") or ""
            if offers and isinstance(offers, list) and isinstance(offers[0], dict):
                ticket_url = offers[0].get("url") or ticket_url

            events.append({
                "id": str(raw.get("id") or ""),
                "name": str(raw.get("title") or f"{artist_name} Live"),
                "category": "Music",
                "date": date_str,
                "time": time_str,
                "venue": venue_name,
                "city": city,
                "country": country_code,
                "image_url": None,
                "ticket_url": ticket_url,
                "price_min": None,
                "price_max": None,
                "source": "bandsintown"
            })
        return events
    except Exception as exc:
        logger.warning("Bandsintown _fetch_bandsintown_events failed: %s", exc)
        return []


def search_events_extended(
    city: str,
    category: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> dict[str, Any]:
    """
    Enhanced multi-source search query targeting Ticketmaster, Yelp, Eventbrite, and Bandsintown in parallel.
    """
    city = (city or "Chicago").strip()
    cat = category or "all"
    
    # We fetch enough items to cover the paginated page size
    target_limit = per_page * page

    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = {
            executor.submit(_fetch_ticketmaster_events, city, cat, date_from, date_to, target_limit): "ticketmaster",
            executor.submit(_fetch_yelp_events, city, cat, target_limit): "yelp",
            executor.submit(_fetch_eventbrite_events, city, cat, target_limit): "eventbrite",
            executor.submit(_fetch_bandsintown_events, city, cat, target_limit): "bandsintown",
        }
        
        all_events = []
        for future in concurrent.futures.as_completed(futures):
            source_name = futures[future]
            try:
                res = future.result()
                if isinstance(res, list):
                    all_events.extend(res)
            except Exception as e:
                logger.warning("Parallel fetch for source %s failed: %s", source_name, e)

    # Deduplicate by lower case name and date
    seen = set()
    deduped_events = []
    for ev in all_events:
        key = (ev["name"].strip().lower(), ev["date"])
        if key not in seen:
            seen.add(key)
            deduped_events.append(ev)

    # Sort chronologically by date and then time
    def sort_key(x):
        d = x.get("date") or ""
        t = x.get("time") or ""
        return (d if d else "9999-12-31", t if t else "23:59")

    deduped_events.sort(key=sort_key)

    # Apply pagination
    total = len(deduped_events)
    start_idx = max(0, (page - 1) * per_page)
    end_idx = start_idx + per_page
    paginated_events = deduped_events[start_idx:end_idx]

    return {
        "city": city,
        "total": total,
        "page": page,
        "per_page": per_page,
        "events": paginated_events
    }
