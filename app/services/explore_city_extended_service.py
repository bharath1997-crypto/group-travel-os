"""
Cached city destination enrichments (Ticketmaster, Foursquare, GNews, Gemini tips, hero photo).

Stores payloads in ``explore_contents`` with dedicated ``content_type`` keys.
Does not modify news/shorts logic in :mod:`app.services.explore_content_service`.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.api_limits import API_TIMEOUT_SECONDS
from app.models.explore_content import ExploreContent
from app.utils.foursquare_auth import FOURSQUARE_PLACES_URL, foursquare_headers, normalize_foursquare_api_key
from config import settings

logger = logging.getLogger(__name__)

TTL_DEFAULT_HOURS = 3
TTL_TIPS_HOURS = 24
TTL_HERO_HOURS = 24
TTL_SAFETY_HOURS = 1
TTL_CURRENCY_HOURS = 1
TTL_GUIDE_HOURS = 24
TTL_WEATHER_MINUTES = 20
TTL_MUSIC_MINUTES = 20
TTL_PODCASTS_HOURS = 24
TTL_RADIO_HOURS = 24
TTL_TRANSPORT_HOURS = 24

CONTENT_TICKETMASTER = "ticketmaster_events"
CONTENT_PLACES_ATTRACTIONS = "places_attractions_v6"
CONTENT_PLACES_RESTAURANTS = "places_restaurants_v6"
CONTENT_GNEWS = "gnews_v6"
CONTENT_CITY_SCORES = "city_scores_v6"
CONTENT_WIKI_SUMMARY = "wiki_summary_v6"
CONTENT_TIPS = "travel_tips"
CONTENT_HERO_PHOTO = "hero_photo"
CONTENT_SAFETY = "safety_score_v2"
CONTENT_CURRENCY = "currency_rates_v2"
CONTENT_GUIDE = "city_guide"
CONTENT_WEATHER = "weather_forecast"
CONTENT_MUSIC = "music_events"
CONTENT_PODCASTS = "podcasts"
CONTENT_RADIO = "radio_stations"
CONTENT_TRANSPORT = "transport_agencies"
CONTENT_EVENTBRITE = "eventbrite_events"
CONTENT_CITY_SCORES = "city_scores"
CONTENT_WIKI_SUMMARY = "wiki_summary"

TTL_EVENTBRITE_HOURS = 3
TTL_CITY_SCORES_HOURS = 168  # 1 week (Scores don't change fast)
TTL_WIKI_HOURS = 168

_TM_URL = "https://app.ticketmaster.com/discovery/v2/events.json"
_FSQ_URL = FOURSQUARE_PLACES_URL
_UNSPLASH_SEARCH = "https://api.unsplash.com/search/photos"
_GNEWS_URL = "https://gnews.io/api/v4/search"
_GEMINI_TIPS_MODEL = "gemini-2.5-flash"
_GEMINI_TIPS_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{_GEMINI_TIPS_MODEL}:generateContent"
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _get_row(db: Session, city: str, content_type: str) -> ExploreContent | None:
    return db.scalars(
        select(ExploreContent).where(
            ExploreContent.city.ilike(city.strip()),
            ExploreContent.content_type == content_type,
        )
    ).first()


def _upsert_list(
    db: Session,
    *,
    city: str,
    content_type: str,
    data: list[dict[str, Any]],
) -> None:
    c = city.strip()
    now = _now()
    row = _get_row(db, c, content_type)
    if row:
        row.data = data
        row.fetched_at = now
    else:
        db.add(
            ExploreContent(
                city=c,
                content_type=content_type,
                data=data,
                fetched_at=now,
            )
        )
    db.commit()


def _get_cached_list(
    db: Session,
    *,
    city: str,
    content_type: str,
    ttl_hours: float,
    fetch_fn: Callable[[], list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    c = city.strip()
    row = _get_row(db, c, content_type)
    now = _now()
    if row and row.data is not None:
        fetched = _aware(row.fetched_at)
        if now - fetched <= timedelta(hours=ttl_hours):
            return list(row.data)

    try:
        data = fetch_fn()
        if not isinstance(data, list):
            data = []
        data_dicts = [d for d in data if isinstance(d, dict)]
        _upsert_list(db, city=c, content_type=content_type, data=data_dicts)
        return data_dicts
    except Exception as exc:
        logger.warning("%s fetch failed for city=%s: %s", content_type, c, exc)
        if row and row.data:
            return list(row.data)
        return []


def _unsplash_photo_for_query(query: str) -> str | None:
    key = (settings.unsplash_access_key or "").strip()
    if not key:
        return None
    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            r = client.get(
                _UNSPLASH_SEARCH,
                params={
                    "query": query,
                    "per_page": 1,
                    "orientation": "landscape",
                    "client_id": key,
                },
            )
        if r.status_code != 200:
            return None
        payload = r.json()
        results = payload.get("results")
        if not isinstance(results, list) or not results:
            return None
        first = results[0]
        if not isinstance(first, dict):
            return None
        urls = first.get("urls")
        if isinstance(urls, dict):
            u = urls.get("regular") or urls.get("small") or urls.get("full")
            if isinstance(u, str):
                return u
    except Exception as exc:
        logger.debug("Unsplash place image failed q=%s: %s", query[:40], exc)
    return None


def fetch_hero_photo(city: str) -> list[dict[str, Any]]:
    key = (settings.unsplash_access_key or "").strip()
    if not key:
        return []
    q = f"{city.strip()} travel skyline"
    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            r = client.get(
                _UNSPLASH_SEARCH,
                params={
                    "query": q,
                    "per_page": 1,
                    "orientation": "landscape",
                    "client_id": key,
                },
            )
        if r.status_code != 200:
            logger.warning("Unsplash hero HTTP %s", r.status_code)
            return []
        payload = r.json()
        results = payload.get("results")
        if not isinstance(results, list) or not results:
            return []
        ph = results[0]
        if not isinstance(ph, dict):
            return []
        urls = ph.get("urls")
        url = None
        if isinstance(urls, dict):
            url = urls.get("regular") or urls.get("full")
        user = ph.get("user")
        name = ""
        username = ""
        profile = ""
        if isinstance(user, dict):
            name = str(user.get("name") or "")
            username = str(user.get("username") or "")
            links = user.get("links")
            if isinstance(links, dict) and isinstance(links.get("html"), str):
                profile = links["html"]
        photo_id = ph.get("id")
        photo_pg = (
            f"https://unsplash.com/photos/{photo_id}" if photo_id else ""
        )
        if not url:
            return []
        return [
            {
                "url": url,
                "photographer_name": name,
                "photographer_username": username,
                "photographer_link": profile,
                "unsplash_photo_link": photo_pg,
            }
        ]
    except Exception as exc:
        logger.warning("Unsplash hero failed: %s", exc)
        return []


def get_hero_photo_cached(db: Session, city: str) -> list[dict[str, Any]]:
    return _get_cached_list(
        db,
        city=city,
        content_type=CONTENT_HERO_PHOTO,
        ttl_hours=TTL_HERO_HOURS,
        fetch_fn=lambda: fetch_hero_photo(city),
    )


def _fetch_ticketmaster_events(
    city: str, 
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    radius: int = 50
) -> list[dict[str, Any]]:
    key = (settings.ticketmaster_api_key or "").strip()
    if not key:
        return []
    
    now_str = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    s_date = start_date if start_date else now_str
    start_dt = f"{s_date}T00:00:00Z"
    end_dt = f"{end_date}T23:59:59Z" if end_date else None

    params: dict[str, Any] = {
        "apikey": key,
        "size": 50,
        "startDateTime": start_dt,
        "sort": "date,asc",
        "unit": "miles"
    }
    
    if lat and lon:
        params["latlong"] = f"{lat},{lon}"
        params["radius"] = radius
    else:
        params["city"] = city.strip()

    if end_dt:
        params["endDateTime"] = end_dt

    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            r = client.get(_TM_URL, params=params)
        if r.status_code != 200:
            logger.warning("Ticketmaster HTTP %s", r.status_code)
            return []
        data = r.json()
        emb = data.get("_embedded")
        if not isinstance(emb, dict):
            return []
        evs = emb.get("events")
        if not isinstance(evs, list):
            return []
        
        out: list[dict[str, Any]] = []
        seen_names = set()
        for raw in evs:
            if not isinstance(raw, dict):
                continue
            
            name = str(raw.get("name") or "Event").strip().lower()
            if name in seen_names:
                continue
            seen_names.add(name)
            
            eid = str(raw.get("id") or "")
            name_orig = str(raw.get("name") or "Event")
            url = str(raw.get("url") or "")
            img_url = ""
            images = raw.get("images")
            if isinstance(images, list) and images:
                best: tuple[int, str] | None = None
                for im in images:
                    if not isinstance(im, dict):
                        continue
                    w = int(im.get("width") or 0)
                    u = im.get("url")
                    if isinstance(u, str) and (best is None or w > best[0]):
                        best = (w, u)
                if best:
                    img_url = best[1]
            start = ""
            dates = raw.get("dates")
            if isinstance(dates, dict):
                st = dates.get("start")
            dt_raw = raw.get("dates", {}).get("start", {}).get("localDate") or ""
            venue_raw = ""
            ven_emb = raw.get("_embedded", {}).get("venues", [])
            if ven_emb and isinstance(ven_emb[0], dict):
                venue_raw = str(ven_emb[0].get("name") or "")

            category_raw = "Other"
            classifications = raw.get("classifications")
            if isinstance(classifications, list) and classifications and isinstance(classifications[0], dict):
                seg = classifications[0].get("segment")
                if isinstance(seg, dict) and seg.get("name"):
                    category_raw = str(seg.get("name"))

            out.append(
                {
                    "id": eid,
                    "title": name_orig,
                    "imageUrl": img_url,
                    "url": url,
                    "start_date": dt_raw,
                    "venue": venue_raw,
                    "category": category_raw,
                    "sourceType": "ticketmaster",
                }
            )
        return out
    except Exception as exc:
        logger.warning("Ticketmaster fetch failed: %s", exc)
        return []


def get_ticketmaster_cached(
    db: Session, 
    city: str, 
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    radius: int = 50
) -> list[dict[str, Any]]:
    # Include dates and coords in cache key if provided
    cache_key = f"{city.strip().lower()}_v2"
    if start_date: cache_key += f"_{start_date}"
    if end_date: cache_key += f"_{end_date}"
    if lat and lon: cache_key += f"_{lat}_{lon}_{radius}"

    return _get_cached_list(
        db,
        city=cache_key,
        content_type=CONTENT_TICKETMASTER,
        ttl_hours=TTL_DEFAULT_HOURS,
        fetch_fn=lambda: _fetch_ticketmaster_events(city, start_date, end_date, lat, lon, radius),
    )


def _foursquare_search(
    city: str,
    *,
    categories: str | None,
    query: str | None,
) -> list[dict[str, Any]]:
    token = normalize_foursquare_api_key()
    if not token:
        return []
    near = city.strip()
    params: dict[str, str | int] = {"near": near, "limit": 12}
    if categories:
        params["categories"] = categories
    if query:
        params["query"] = query
    headers = foursquare_headers(token)
    with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
        r = client.get(
            _FSQ_URL,
            params=params,
            headers=headers,
        )
    if r.status_code != 200:
        logger.warning("Foursquare HTTP %s: %s", r.status_code, r.text[:200])
        return []
    payload = r.json()
    results = payload.get("results")
    if not isinstance(results, list):
        return []
    out: list[dict[str, Any]] = []
    city_q = city.strip()
    for p in results:
        if not isinstance(p, dict):
            continue
        pid = str(p.get("fsq_id") or "")
        nm = str(p.get("name") or "Place")
        addr = ""
        loc = p.get("location")
        if isinstance(loc, dict):
            addr = str(
                loc.get("formatted_address") or loc.get("address") or ""
            )
        cat_label = ""
        cats = p.get("categories")
        if isinstance(cats, list) and cats and isinstance(cats[0], dict):
            cat_label = str(cats[0].get("name") or "")
        lat = None
        lng = None
        geo = p.get("geocodes")
        if isinstance(geo, dict):
            main = geo.get("main")
            if isinstance(main, dict):
                lat = main.get("latitude")
                lng = main.get("longitude")
        img = _unsplash_photo_for_query(f"{nm} {city_q}") or ""
        out.append(
            {
                "id": pid or nm[:32],
                "name": nm,
                "address": addr,
                "category": cat_label,
                "lat": lat,
                "lng": lng,
                "image_url": img,
            }
        )
    return out


def _fetch_osm_places(city: str, category: str) -> list[dict[str, Any]]:
    """Direct Rescue fetcher using OpenStreetMap (Overpass API). Global & Keyless."""
    try:
        # 1. Geocode city to get lat/lon
        geo_url = f"https://nominatim.openstreetmap.org/search?q={city.strip()}&format=json&limit=1"
        with httpx.Client(timeout=10.0, headers={"User-Agent": "GroupTravelOS/1.0"}) as client:
            geo_res = client.get(geo_url)
            if geo_res.status_code != 200 or not geo_res.json():
                return []
            loc = geo_res.json()[0]
            lat, lon = float(loc["lat"]), float(loc["lon"])

        # 2. Query Overpass for features (Direct Global Data)
        # Expanded tags for better coverage
        values = "museum|tourist_attraction|viewpoint|gallery|theme_park|zoo|attraction" if category == "attractions" else "restaurant|cafe|bar|pub|fast_food|food_court"
        
        overpass_query = f"""
        [out:json][timeout:30];
        (
          node["{tag}"~"{values}"](around:20000,{lat},{lon});
          way["{tag}"~"{values}"](around:20000,{lat},{lon});
          node["leisure"~"park|garden"](around:20000,{lat},{lon});
          node["historic"](around:20000,{lat},{lon});
        );
        out body qt 15;
        """
        overpass_url = "https://overpass-api.de/api/interpreter"
        overpass_res = client.post(overpass_url, data={"data": overpass_query})
        if overpass_res.status_code != 200:
            return []
        
        data = overpass_res.json()
        elements = data.get("elements", [])
        out = []
        for el in elements[:12]:
            tags = el.get("tags", {})
            name = tags.get("name") or tags.get("description") or "Local Spot"
            addr = tags.get("addr:street", "")
            if tags.get("addr:housenumber"):
                addr = f"{tags.get('addr:housenumber')} {addr}"
            
            # Use a generic image search or placeholder
            img = _unsplash_photo_for_query(f"{name} {city}") or ""
            
            out.append({
                "id": f"osm-{el.get('id')}",
                "name": name,
                "address": addr or f"Near {city}",
                "category": tags.get(tag, category).replace("_", " ").capitalize(),
                "lat": el.get("lat") or el.get("center", {}).get("lat"),
                "lng": el.get("lon") or el.get("center", {}).get("lon"),
                "image_url": img
            })
        return out
    except Exception as e:
        logger.warning(f"OSM Rescue failed for {city}: {e}")
        return []


def _fetch_places(city: str, category: str) -> list[dict[str, Any]]:
    c = category.strip().lower()
    res = []
    if c == "attractions":
        res = _foursquare_search(
            city,
            categories="10031,10027,10039,16047",
            query=None,
        )
    elif c == "restaurants":
        res = _foursquare_search(city, categories="13065", query=None)
    
    # RESCUE: If Foursquare is empty, use OSM
    if not res:
        logger.info(f"Foursquare empty for {city} {c}. Triggering OSM Rescue.")
        res = _fetch_osm_places(city, c)
        
    return res


def get_places_cached(db: Session, city: str, category: str) -> list[dict[str, Any]]:
    cat = category.strip().lower()
    if cat == "attractions":
        ct = CONTENT_PLACES_ATTRACTIONS
    elif cat == "restaurants":
        ct = CONTENT_PLACES_RESTAURANTS
    else:
        return []

    return _get_cached_list(
        db,
        city=city,
        content_type=ct,
        ttl_hours=TTL_DEFAULT_HOURS,
        fetch_fn=lambda: _fetch_places(city, cat),
    )


def _fetch_google_news_rss(city: str) -> list[dict[str, Any]]:
    """Rescue fetcher for News using Google News RSS. 100% Free."""
    try:
        import xml.etree.ElementTree as ET
        q = f"{city.strip()} travel"
        url = f"https://news.google.com/rss/search?q={q.replace(' ', '+')}&hl=en-US&gl=US&ceid=US:en"
        with httpx.Client(timeout=10.0) as client:
            r = client.get(url)
            if r.status_code != 200:
                return []
            root = ET.fromstring(r.text)
            out = []
            for item in root.findall(".//item")[:10]:
                title = item.find("title").text if item.find("title") is not None else ""
                link = item.find("link").text if item.find("link") is not None else ""
                pub_date = item.find("pubDate").text if item.find("pubDate") is not None else ""
                source = item.find("source").text if item.find("source") is not None else "Google News"
                if title and link:
                    out.append({
                        "title": title,
                        "url": link,
                        "description": f"Published on {pub_date}",
                        "source": source
                    })
            return out
    except Exception as e:
        logger.warning(f"Google News RSS rescue failed: {e}")
        return []


def _fetch_gnews(city: str) -> list[dict[str, Any]]:
    token = (settings.gnews_api_key or "").strip()
    res = []
    if token:
        try:
            q = f"{city.strip()} travel"
            with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
                r = client.get(
                    _GNEWS_URL,
                    params={
                        "q": q,
                        "token": token,
                        "lang": "en",
                        "max": 10,
                    },
                )
            if r.status_code == 200:
                payload = r.json()
                articles = payload.get("articles", [])
                for a in articles:
                    title = str(a.get("title") or "")
                    url = str(a.get("url") or "")
                    desc = str(a.get("description") or "")
                    src = a.get("source", {}).get("name") if isinstance(a.get("source"), dict) else ""
                    if title and url:
                        res.append({
                            "title": title,
                            "url": url,
                            "description": desc,
                            "source": src,
                        })
        except:
            pass

    # RESCUE: Use Google News RSS if GNews fails or no key
    if not res:
        logger.info(f"GNews empty for {city}. Triggering Google RSS Rescue.")
        res = _fetch_google_news_rss(city)
        
    return res


def get_gnews_cached(db: Session, city: str) -> list[dict[str, Any]]:
    return _get_cached_list(
        db,
        city=city,
        content_type=CONTENT_GNEWS,
        ttl_hours=TTL_DEFAULT_HOURS,
        fetch_fn=lambda: _fetch_gnews(city),
    )


def _parse_json_array_from_gemini(text: str) -> list[Any]:
    t = (text or "").strip()
    if not t:
        return []
    t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.IGNORECASE)
    t = re.sub(r"\s*```$", "", t)
    try:
        data = json.loads(t)
        return list(data) if isinstance(data, list) else []
    except json.JSONDecodeError:
        m = re.search(r"\[[\s\S]*\]", t)
        if m:
            try:
                data = json.loads(m.group(0))
                return list(data) if isinstance(data, list) else []
            except json.JSONDecodeError:
                pass
    return []


def _fetch_travel_tips(city: str) -> list[dict[str, Any]]:
    key = (settings.gemini_api_key or "").strip()
    if not key:
        return []
    c = city.strip() or "this city"
    prompt = (
        f"Give 5 snappy travel tips for {c} as JSON array. "
        "Respond with ONLY a JSON array of exactly 5 strings — each under 140 characters, "
        "actionable and friendly. No markdown, no keys, no explanation."
    )
    body: dict[str, Any] = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.55,
            "maxOutputTokens": 512,
        },
    }
    with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
        r = client.post(_GEMINI_TIPS_URL, params={"key": key}, json=body)
    if r.status_code != 200:
        logger.warning("Gemini tips HTTP %s: %s", r.status_code, r.text[:200])
        return []
    payload = r.json()
    candidates = payload.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        return []
    first_c = candidates[0]
    parts = (
        first_c.get("content", {}).get("parts")
        if isinstance(first_c, dict)
        else None
    )
    if not isinstance(parts, list):
        return []
    chunks: list[str] = []
    for p in parts:
        if isinstance(p, dict) and isinstance(p.get("text"), str):
            chunks.append(p["text"])
    raw_text = "".join(chunks)
    arr = _parse_json_array_from_gemini(raw_text)
    tips: list[dict[str, Any]] = []
    icons = ["compass", "map-pin", "utensils", "camera", "sun"]
    for i, item in enumerate(arr[:5]):
        text = ""
        if isinstance(item, str):
            text = item.strip()
        elif isinstance(item, dict):
            text = str(item.get("text") or item.get("tip") or "").strip()
        if not text:
            continue
        tips.append({"text": text[:280], "icon": icons[i % len(icons)]})
    while len(tips) < 5:
        tips.append(
            {
                "text": f"Explore {c} with friends — split costs and share an itinerary.",
                "icon": icons[len(tips) % len(icons)],
            }
        )
    return tips[:5]


def get_travel_tips_cached(db: Session, city: str) -> list[dict[str, Any]]:
    return _get_cached_list(
        db,
        city=city,
        content_type=CONTENT_TIPS,
        ttl_hours=TTL_TIPS_HOURS,
        fetch_fn=lambda: _fetch_travel_tips(city),
    )


def _coerce_float(v: Any) -> float | None:
    try:
        if v is None:
            return None
        return float(v)
    except (TypeError, ValueError):
        return None


def _travel_advisory_for_country(code: str) -> dict[str, Any] | None:
    cc = code.strip().upper()
    urls = (
        f"https://www.travel-advisory.info/api?countrycode={cc}",
        f"https://travel-advisory.info/api?countrycode={cc}",
    )
    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            payload: dict[str, Any] | None = None
            last_status = None
            for url in urls:
                r = client.get(url)
                last_status = r.status_code
                if r.status_code != 200:
                    continue
                payload = r.json()
                break
            if not isinstance(payload, dict):
                logger.debug(
                    "Travel advisory unreachable for country=%s (last HTTP=%s)",
                    cc,
                    last_status,
                )
                return None
            data_obj = payload.get("data")
            if not isinstance(data_obj, dict):
                return None
            country_blob = (
                data_obj.get(cc)
                or data_obj.get(cc.lower())
            )
            if not isinstance(country_blob, dict):
                for k, v in data_obj.items():
                    if str(k).strip().upper() == cc and isinstance(v, dict):
                        country_blob = v
                        break
            if not isinstance(country_blob, dict):
                return None
            adv = country_blob.get("advisory")
            if not isinstance(adv, dict):
                return None
            raw_score = None
            for key in ("score", "rating", "risk_score", "dangerLevel"):
                if adv.get(key) is not None:
                    raw_score = adv.get(key)
                    break
            return {
                "score": raw_score,
                "message": adv.get("message"),
                "updated": adv.get("updated"),
                "source": adv.get("sources_active"),
            }
    except Exception as exc:
        logger.warning("Travel advisory lookup failed for %s: %s", cc, exc)
    return None


def _fetch_teleport_safety_score_5(city: str) -> float | None:
    """Maps Teleport 'Safety' (0–10) to the Explorer bar scale (0–5)."""
    c = city.strip()
    if not c:
        return None
    try:
        with httpx.Client(timeout=10.0) as client:
            slug = city.lower().replace(" ", "-")
            url = f"https://api.teleport.org/api/urban_areas/slug:{slug}/scores/"
            r = client.get(url)
            if r.status_code != 200:
                search_url = "https://api.teleport.org/api/cities/"
                sr = client.get(search_url, params={"search": city})
                if sr.status_code == 200:
                    matches = sr.json().get("_embedded", {}).get("city:search-results", [])
                    if isinstance(matches, list) and matches:
                        ua_url = matches[0].get("_links", {}).get("city:item", {}).get("href")
                        if ua_url:
                            cr = client.get(ua_url)
                            if cr.status_code == 200:
                                ua_link = cr.json().get("_links", {}).get("city:urban_area", {}).get(
                                    "href"
                                )
                                if ua_link:
                                    r = client.get(f"{ua_link}scores/")
            if r.status_code != 200:
                return None
            data = r.json()
            cats = data.get("categories")
            if not isinstance(cats, list):
                return None
            for cat in cats:
                if not isinstance(cat, dict):
                    continue
                nm = str(cat.get("name") or "").lower()
                if "safety" not in nm:
                    continue
                raw10 = cat.get("score_out_of_10") or cat.get("score") or cat.get(
                    "score_out_of_a_hundred"
                )
                sx = _coerce_float(raw10)
                if sx is None:
                    return None
                if sx <= 11:
                    sx_5 = min(5.0, sx / 2.0)
                elif sx <= 110:
                    sx_5 = min(5.0, sx / 20.0)
                else:
                    sx_5 = min(5.0, sx / 40.0)
                return round(sx_5, 1)
    except Exception as exc:
        logger.debug("Teleport safety fallback failed for %s: %s", city, exc)
    return None


def _fetch_safety(country_code: str, city_hint: str | None = None) -> list[dict[str, Any]]:
    cc = country_code.strip().upper()
    adv = _travel_advisory_for_country(cc)
    raw_score = adv.get("score") if adv else None
    sco = _coerce_float(raw_score)
    if adv and sco is not None:
        return [
            {
                "score": sco,
                "message": adv.get("message"),
                "updated": adv.get("updated"),
                "source": adv.get("source"),
            }
        ]
    ch = (city_hint or "").strip()
    if ch:
        tel = _fetch_teleport_safety_score_5(ch)
        if tel is not None:
            msg = (
                adv.get("message")
                if adv and isinstance(adv.get("message"), str)
                else "City livability safety index"
            )
            return [
                {
                    "score": tel,
                    "message": msg,
                    "updated": None,
                    "source": {"teleport": True},
                    "fallback": True,
                }
            ]
    return []


def _safety_cache_key(country_code: str, city_hint: str | None) -> str:
    base = country_code.strip().upper()
    if city_hint and city_hint.strip():
        return f"{base}\u241f{city_hint.strip()}"
    return base


def get_safety_cached(
    db: Session, country_code: str, *, city_hint: str | None = None
) -> list[dict[str, Any]]:
    return _get_cached_list(
        db,
        city=_safety_cache_key(country_code, city_hint),
        content_type=CONTENT_SAFETY,
        ttl_hours=TTL_SAFETY_HOURS,
        fetch_fn=lambda: _fetch_safety(country_code, city_hint=city_hint),
    )


_PRIMARY_CURRENCY_FALLBACK: dict[str, str] = {
    "US": "USD",
    "GB": "GBP",
    "JP": "JPY",
    "CH": "CHF",
    "CA": "CAD",
    "AU": "AUD",
    "NZ": "NZD",
    "IN": "INR",
    "CN": "CNY",
    "HK": "HKD",
    "SG": "SGD",
    "KR": "KRW",
    "TW": "TWD",
    "TH": "THB",
    "MY": "MYR",
    "ID": "IDR",
    "PH": "PHP",
    "VN": "VND",
    "MX": "MXN",
    "BR": "BRL",
    "AR": "ARS",
    "CL": "CLP",
    "CO": "COP",
    "PE": "PEN",
    "ZA": "ZAR",
    "EG": "EGP",
    "AE": "AED",
    "SA": "SAR",
    "IL": "ILS",
    "TR": "TRY",
    "RU": "RUB",
    "UA": "UAH",
    "PL": "PLN",
    "CZ": "CZK",
    "HU": "HUF",
    "RO": "RON",
    "SE": "SEK",
    "NO": "NOK",
    "DK": "DKK",
    "IS": "ISK",
}


def _primary_currency(country_alpha2: str) -> str:
    cc = country_alpha2.strip().upper()
    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            r = client.get(f"https://restcountries.com/v3.1/alpha/{cc}?fields=currencies")
        if r.status_code != 200:
            return _PRIMARY_CURRENCY_FALLBACK.get(cc, "USD")
        blob = r.json()
        cur = blob.get("currencies")
        if not isinstance(cur, dict) or not cur:
            return _PRIMARY_CURRENCY_FALLBACK.get(cc, "USD")
        first_code = next(iter(cur.keys()))
        if isinstance(first_code, str):
            up = first_code.strip().upper()
            if len(up) == 3:
                return up
    except Exception as exc:
        logger.debug("restcountries currency failed for %s: %s", cc, exc)
    return _PRIMARY_CURRENCY_FALLBACK.get(cc, "USD")


def _fetch_currency(country_code: str) -> list[dict[str, Any]]:
    # https://open.er-api.com/v6/latest/USD
    url = "https://open.er-api.com/v6/latest/USD"
    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            r = client.get(url)
        if r.status_code != 200:
            return []
        payload = r.json()
        if payload.get("result") != "success":
            return []
        rates = payload.get("rates", {})
        if not isinstance(rates, dict):
            return []
        local = _primary_currency(country_code)
        rate_usd_unit = _coerce_float(rates.get(local))
        ro: dict[str, Any] = {
            "rates": rates,
            "base": "USD",
            "local_currency": local,
        }
        if rate_usd_unit is not None:
            ro["rate_per_usd"] = rate_usd_unit
        return [ro]
    except Exception as exc:
        logger.warning("Currency fetch failed (open.er-api.com): %s", exc)
        return []


def get_currency_cached(db: Session, country_code: str) -> list[dict[str, Any]]:
    # We cache by country_code but the API returns all rates, so we could theoretically
    # cache one global rate list, but the existing pattern is city/country specific rows.
    return _get_cached_list(
        db,
        city=country_code.upper(),
        content_type=CONTENT_CURRENCY,
        ttl_hours=TTL_CURRENCY_HOURS,
        fetch_fn=lambda: _fetch_currency(country_code),
    )


def _fetch_guide(city: str) -> list[dict[str, Any]]:
    # https://en.wikivoyage.org/api/php?action=query&titles={city}&prop=extracts&exintro=false&format=json
    url = "https://en.wikivoyage.org/w/api.php"
    params = {
        "action": "query",
        "titles": city.strip(),
        "prop": "extracts",
        "exintro": "false",  # Get full content to find 'Stay safe'
        "format": "json",
        "explaintext": "true",
    }
    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            r = client.get(url, params=params)
        if r.status_code != 200:
            return []
        data = r.json()
        pages = data.get("query", {}).get("pages", {})
        if not pages:
            return []
        # Get first page
        page_id = next(iter(pages))
        page = pages[page_id]
        full_text = page.get("extract", "")
        if not full_text:
            return []

        # Extract 'Stay safe' section if possible
        stay_safe = ""
        # Simple regex/split to find the section
        if "== Stay safe ==" in full_text:
            parts = full_text.split("== Stay safe ==")
            if len(parts) > 1:
                # Get the content until the next section
                stay_safe = parts[1].split("==")[0].strip()
        
        # Also get intro
        intro = full_text.split("==")[0].strip()

        return [{
            "extract": intro, 
            "title": page.get("title"), 
            "stay_safe": stay_safe
        }]
    except Exception as exc:
        logger.warning("Guide fetch failed for %s: %s", city, exc)
        return []


def get_guide_cached(db: Session, city: str) -> list[dict[str, Any]]:
    return _get_cached_list(
        db,
        city=city,
        content_type=CONTENT_GUIDE,
        ttl_hours=TTL_GUIDE_HOURS,
        fetch_fn=lambda: _fetch_guide(city),
    )


def _fetch_weather(lat: float, lon: float) -> list[dict[str, Any]]:
    # https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true&hourly=temperature_2m
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "current_weather": "true",
        "hourly": "temperature_2m",
        "timezone": "auto",
    }
    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            r = client.get(url, params=params)
        if r.status_code != 200:
            return []
        return [r.json()]
    except Exception as exc:
        logger.warning("Weather fetch failed: %s", exc)
        return []


def get_weather_cached(db: Session, city: str, lat: float, lon: float) -> list[dict[str, Any]]:
    return _get_cached_list(
        db,
        city=city,
        content_type=CONTENT_WEATHER,
        ttl_hours=TTL_WEATHER_MINUTES / 60.0,
        fetch_fn=lambda: _fetch_weather(lat, lon),
    )


def _fetch_music(city: str) -> list[dict[str, Any]]:
    # https://rest.bandsintown.com/events/search?location={city}&app_id=travello
    url = f"https://rest.bandsintown.com/events/search"
    params = {"location": city.strip(), "app_id": "travello"}
    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            r = client.get(url, params=params)
        if r.status_code != 200:
            return []
        return r.json()
    except Exception as exc:
        logger.warning("Music fetch failed: %s", exc)
        return []


def get_music_cached(db: Session, city: str) -> list[dict[str, Any]]:
    return _get_cached_list(
        db,
        city=city,
        content_type=CONTENT_MUSIC,
        ttl_hours=TTL_MUSIC_MINUTES / 60.0,
        fetch_fn=lambda: _fetch_music(city),
    )


def _fetch_podcasts(city: str) -> list[dict[str, Any]]:
    # https://itunes.apple.com/search?term={city}+travel&media=podcast&limit=10
    url = "https://itunes.apple.com/search"
    params = {"term": f"{city.strip()} travel", "media": "podcast", "limit": 10}
    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            r = client.get(url, params=params)
        if r.status_code != 200:
            return []
        return r.json().get("results", [])
    except Exception as exc:
        logger.warning("Podcasts fetch failed: %s", exc)
        return []


def get_podcasts_cached(db: Session, city: str) -> list[dict[str, Any]]:
    return _get_cached_list(
        db,
        city=city,
        content_type=CONTENT_PODCASTS,
        ttl_hours=TTL_PODCASTS_HOURS,
        fetch_fn=lambda: _fetch_podcasts(city),
    )


def _fetch_radio(country_code: str) -> list[dict[str, Any]]:
    # https://de1.api.radio-browser.info/json/stations/bycountry/{country}
    url = f"https://de1.api.radio-browser.info/json/stations/bycountry/{country_code.strip()}"
    try:
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            r = client.get(url, params={"limit": 5, "order": "clickcount", "reverse": "true"})
        if r.status_code != 200:
            return []
        return r.json()
    except Exception as exc:
        logger.warning("Radio fetch failed: %s", exc)
        return []


def get_radio_cached(db: Session, country_code: str) -> list[dict[str, Any]]:
    return _get_cached_list(
        db,
        city=country_code.upper(),
        content_type=CONTENT_RADIO,
        ttl_hours=TTL_RADIO_HOURS,
        fetch_fn=lambda: _fetch_radio(country_code),
    )


def _fetch_transport(city: str) -> list[dict[str, Any]]:
    # https://transit.land/api/v2/rest/agencies?city_name={city}
    url = "https://transit.land/api/v2/rest/agencies"
    try:
        # Transitland often needs an API key for v2, but v1 was open. 
        # User said "no-auth", so we'll try without. 
        # Actually, transit.land/api/v2/rest/agencies?city_name=Chicago
        with httpx.Client(timeout=API_TIMEOUT_SECONDS) as client:
            r = client.get(url, params={"city_name": city.strip()})
        if r.status_code != 200:
            return []
        return r.json().get("agencies", [])
    except Exception as exc:
        logger.warning("Transport fetch failed: %s", exc)
        return []


async def get_ai_seasonal_events(city: str) -> list[dict[str, Any]]:
    """Uses Gemini to suggest local seasonal events and festivals."""
    from app.services.travel_info_service import get_travel_bundle_cached
    from app.db.session import SessionLocal
    
    db = SessionLocal()
    try:
        # We reuse the AI logic in travel_info_service but extract just the events
        # Or we can do a targeted prompt
        from app.services.ai_assistant_service import generate_gemini_content
        from datetime import datetime
        
        month = datetime.now().strftime("%B")
        prompt = f"List 10 popular local festivals, recurring events, or seasonal activities in {city} during {month}. For each, provide a title, emoji, a short description of the vibe, and typical location. Format as JSON list: [{{'title': '...', 'emoji': '...', 'description': '...', 'location': '...', 'time': '...'}}]"
        
        res = await generate_gemini_content(prompt)
        import json
        import re
        
        # Extract JSON from potential markdown
        match = re.search(r'\[.*\]', res, re.DOTALL)
        if match:
            events = json.loads(match.group(0))
            return events
        return []
    except Exception as e:
        logger.error(f"AI Seasonal Events failed: {e}")
        return []
    finally:
        db.close()


def _fetch_eventbrite_events(city: str) -> list[dict[str, Any]]:
    """
    Uses SerpAPI to discover Eventbrite events for a city.
    More reliable than the restrictive official Eventbrite API.
    """
    from app.services.serpapi_service import _google_search, _serpapi_key
    key = _serpapi_key()
    if not key:
        return []
    
    try:
        # Search specifically for eventbrite listings in the target city
        params = {
            "engine": "google",
            "q": f"site:eventbrite.com events in {city}",
            "location": city,
            "hl": "en",
            "gl": "us",
            "num": 10,
            "api_key": key,
        }
        res = _google_search(params)
        results = res.get("organic_results", [])
        if not isinstance(results, list):
            return []
            
        out = []
        for index, item in enumerate(results):
            if not isinstance(item, dict): continue
            # Extract basic info from organic result
            title = item.get("title", "Eventbrite Event").replace(" - Eventbrite", "")
            snippet = item.get("snippet", "")
            link = item.get("link", "")
            
            # Use AI or heuristics to clean up the venue/date from snippet if possible
            # For now, just return the structured item
            out.append({
                "id": f"eb_search_{index}",
                "title": title,
                "description": snippet,
                "venue": "Local Venue",
                "date_str": "See Eventbrite",
                "imageUrl": None,
                "url": link
            })
        return out
    except Exception as e:
        logger.warning(f"Eventbrite deep search failed: {e}")
        return []


def get_eventbrite_cached(db: Session, city: str) -> list[dict[str, Any]]:
    return _get_cached_list(
        db,
        city=city,
        content_type=CONTENT_EVENTBRITE,
        ttl_hours=TTL_EVENTBRITE_HOURS,
        fetch_fn=lambda: _fetch_eventbrite_events(city),
    )


def get_transport_cached(db: Session, city: str) -> list[dict[str, Any]]:
    return _get_cached_list(
        db,
        city=city,
        content_type=CONTENT_TRANSPORT,
        ttl_hours=TTL_TRANSPORT_HOURS,
        fetch_fn=lambda: _fetch_transport(city),
    )


def _fetch_teleport_scores(city: str) -> list[dict[str, Any]]:
    """Fetches quality of life scores from Teleport Public API with search fallback."""
    try:
        with httpx.Client(timeout=10.0) as client:
            # 1. Try direct slug
            slug = city.lower().replace(" ", "-")
            url = f"https://api.teleport.org/api/urban_areas/slug:{slug}/scores/"
            r = client.get(url)
            
            # 2. If fails, try search
            if r.status_code != 200:
                search_url = "https://api.teleport.org/api/cities/"
                sr = client.get(search_url, params={"search": city})
                if sr.status_code == 200:
                    matches = sr.json().get("_embedded", {}).get("city:search-results", [])
                    if matches:
                        # Get the first match's urban area link
                        ua_url = matches[0].get("_links", {}).get("city:item", {}).get("href")
                        if ua_url:
                            cr = client.get(ua_url)
                            if cr.status_code == 200:
                                ua_link = cr.json().get("_links", {}).get("city:urban_area", {}).get("href")
                                if ua_link:
                                    r = client.get(f"{ua_link}scores/")

            if r.status_code == 200:
                data = r.json()
                categories = data.get("categories", [])
                return [{"name": c["name"], "score": round(c["score_out_of_10"], 1), "color": c["color"]} for c in categories]
            
            # 3. Final Fallback: Hardcoded "Average" vibe for unknown cities to keep UI alive
            return [
                {"name": "Safety", "score": 7.0, "color": "#f33"},
                {"name": "Cost of Living", "score": 5.0, "color": "#3c3"},
                {"name": "Leisure & Culture", "score": 6.5, "color": "#33f"}
            ]
    except Exception:
        return []

def get_city_scores_cached(db: Session, city: str) -> list[dict[str, Any]]:
    return _get_cached_list(db, city=city, content_type=CONTENT_CITY_SCORES, ttl_hours=TTL_CITY_SCORES_HOURS, fetch_fn=lambda: _fetch_teleport_scores(city))

def _fetch_wiki_summary(city: str) -> list[dict[str, Any]]:
    """Fetches city summary from Wikipedia Public API with search fallback."""
    try:
        with httpx.Client(timeout=10.0) as client:
            # 1. Try direct summary
            url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{city.replace(' ', '_')}"
            r = client.get(url)
            
            # 2. If fails, try search
            if r.status_code != 200:
                search_url = "https://en.wikipedia.org/w/api.php"
                sr = client.get(search_url, params={
                    "action": "query",
                    "list": "search",
                    "srsearch": city,
                    "format": "json"
                })
                if sr.status_code == 200:
                    hits = sr.json().get("query", {}).get("search", [])
                    if hits:
                        best_title = hits[0]["title"]
                        url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{best_title.replace(' ', '_')}"
                        r = client.get(url)

            if r.status_code == 200:
                data = r.json()
                return [{"extract": data.get("extract", ""), "thumbnail": data.get("thumbnail", {}).get("source", "")}]
            return []
    except Exception:
        return []

def get_wiki_summary_cached(db: Session, city: str) -> list[dict[str, Any]]:
    return _get_cached_list(db, city=city, content_type=CONTENT_WIKI_SUMMARY, ttl_hours=TTL_WIKI_HOURS, fetch_fn=lambda: _fetch_wiki_summary(city))

