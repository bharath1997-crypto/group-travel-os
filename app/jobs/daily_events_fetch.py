"""
app/jobs/daily_events_fetch.py — Fetch all US Ticketmaster events in bulk and cache in explore_contents.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, date, timezone
import httpx
from sqlalchemy import select, delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.explore_content import ExploreContent
from app.utils.database import SessionLocal
from config import settings

logger = logging.getLogger(__name__)

TICKETMASTER_URL = "https://app.ticketmaster.com/discovery/v2/events.json"

def _normalize_category(segment_name: str, name: str) -> str:
    import re
    name_l = (name or "").lower()
    if re.search(r"\btour\b", name_l) and re.search(r"\b(stadium|arena)\b", name_l):
        return "Experience"
    if re.search(r"\bvs\.?\b", name_l):
        return "Sports"
    if "comedy" in name_l:
        return "Comedy"
    if any(kw in name_l for kw in ("ballet", "orchestra", "symphony", "theatre", "theater")):
        return "Arts"

    key = (segment_name or "").strip().lower()
    weak = {"", "undefined", "miscellaneous", "misc", "all", "other", "general"}
    segment_map = {
        "music": "Music",
        "sports": "Sports",
        "arts & theatre": "Arts",
        "arts": "Arts",
        "theatre": "Arts",
        "film": "Festival",
        "family": "Family",
        "food & drink": "Food",
        "food": "Food",
    }
    if key not in weak:
        return segment_map.get(key, segment_name.strip().title())

    if any(x in name_l for x in (" vs ", " vs. ", "game", "sox", "cubs", "bulls", "bears", "twins", "mlb", "nba", "nfl")):
        return "Sports"
    if any(x in name_l for x in ("concert", " tour", "live ", "dj ", "festival")):
        return "Music"
    if any(x in name_l for x in ("theatre", "theater", "broadway", "play")):
        return "Arts"
    if any(x in name_l for x in ("food", "wine", "dinner", "brunch", "tasting")):
        return "Food"
    if any(x in name_l for x in ("cruise", "museum", "architecture", "walking")):
        return "Experience"
    if any(x in name_l for x in ("club", "night", "18+", "21+")):
        return "Nightlife"
    return "Experience"

def run_daily_events_fetch() -> dict[str, int]:
    """
    Fetch US events from Ticketmaster in pages 0-49, size=200.
    Upsert into explore_contents. Delete past events.
    Returns counts of fetched, inserted, updated, and deleted events.
    """
    logger.info("Starting daily bulk Ticketmaster fetch job...")
    api_key = (settings.ticketmaster_api_key or "").strip()
    if not api_key:
        logger.error("Ticketmaster API key is not configured.")
        return {"fetched": 0, "inserted": 0, "updated": 0, "deleted": 0}

    fetched_count = 0
    inserted_count = 0
    updated_count = 0
    deleted_count = 0

    today = date.today()
    fetched_events = []

    # 1. Fetch from Ticketmaster
    with httpx.Client(timeout=30.0) as client:
        for page in range(50):
            params = {
                "apikey": api_key,
                "countryCode": "US",
                "size": 200,
                "page": page,
                "sort": "date,asc",
            }
            try:
                # Add rate-limiting delay to respect Ticketmaster's rate limits
                time.sleep(0.25)
                logger.info("Fetching US events page %d...", page)
                response = client.get(TICKETMASTER_URL, params=params)
                if response.status_code != 200:
                    logger.warning("Ticketmaster bulk fetch page %d returned HTTP %s: %s", page, response.status_code, response.text[:200])
                    break

                data = response.json()
                embedded = data.get("_embedded")
                if not isinstance(embedded, dict):
                    logger.info("No more events found at page %d.", page)
                    break

                events_list = embedded.get("events")
                if not isinstance(events_list, list) or not events_list:
                    logger.info("No more events found at page %d.", page)
                    break

                for raw in events_list:
                    if not isinstance(raw, dict):
                        continue

                    event_id = str(raw.get("id") or "").strip()
                    if not event_id:
                        continue

                    title = str(raw.get("name") or "Event").strip()
                    ticket_url = str(raw.get("url") or "").strip()

                    # Find best image url
                    image_url = ""
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
                            image_url = best[1]

                    # Parse classifications / category
                    raw_segment = ""
                    classifications = raw.get("classifications", [])
                    if classifications and isinstance(classifications, list) and isinstance(classifications[0], dict):
                        segment = classifications[0].get("segment", {})
                        if isinstance(segment, dict) and segment.get("name"):
                            raw_segment = str(segment.get("name"))
                    category = _normalize_category(raw_segment, title)

                    # Parse dates
                    start_date_val = None
                    start_time_val = "19:00"
                    dates = raw.get("dates", {})
                    if isinstance(dates, dict):
                        start = dates.get("start", {})
                        if isinstance(start, dict):
                            dt_str = str(start.get("localDate") or "")
                            if dt_str:
                                try:
                                    start_date_val = datetime.strptime(dt_str, "%Y-%m-%d").date()
                                except (TypeError, ValueError):
                                    pass
                            local_time = start.get("localTime")
                            if local_time:
                                start_time_val = str(local_time)[:5]

                    # Skip events that have already passed
                    if start_date_val and start_date_val < today:
                        continue

                    # Parse venue and location
                    venue_name = "Various Venues"
                    city_name = "US"
                    state_name = "US"
                    venue_lat = None
                    venue_lon = None

                    ven_emb = raw.get("_embedded", {})
                    if isinstance(ven_emb, dict):
                        venues = ven_emb.get("venues")
                        if isinstance(venues, list) and venues and isinstance(venues[0], dict):
                            v0 = venues[0]
                            venue_name = str(v0.get("name") or "Venue").strip()
                            if v0.get("city") and isinstance(v0.get("city"), dict):
                                city_name = str(v0.get("city").get("name") or "US").strip()
                            if v0.get("state") and isinstance(v0.get("state"), dict):
                                state_name = str(v0.get("state").get("name") or v0.get("state").get("stateCode") or "US").strip()
                            loc = v0.get("location")
                            if isinstance(loc, dict):
                                try:
                                    if loc.get("latitude") is not None:
                                        venue_lat = float(loc["latitude"])
                                    if loc.get("longitude") is not None:
                                        venue_lon = float(loc["longitude"])
                                except (TypeError, ValueError):
                                    pass

                    # Parse pricing
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

                    fetched_events.append({
                        "event_id": event_id,
                        "title": title,
                        "category": category,
                        "venue_name": venue_name,
                        "venue_lat": venue_lat,
                        "venue_lon": venue_lon,
                        "city": city_name,
                        "state": state_name,
                        "start_date": start_date_val,
                        "start_time": start_time_val,
                        "price_min": price_min,
                        "price_max": price_max,
                        "image_url": image_url,
                        "ticket_url": ticket_url,
                        "source": "ticketmaster"
                    })
                    fetched_count += 1

            except Exception as exc:
                logger.error("Error fetching page %d: %s", page, exc)
                break

    # Deduplicate fetched events by event_id before database operations
    seen_ids = set()
    unique_fetched_events = []
    for ev in fetched_events:
        eid = ev["event_id"]
        if eid not in seen_ids:
            seen_ids.add(eid)
            unique_fetched_events.append(ev)
    fetched_events = unique_fetched_events

    # 2. Database Upsert using SQLAlchemy 2.0 select & save/update
    logger.info("Successfully fetched %d unique events. Starting DB upserts...", len(fetched_events))
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        
        # Batch query existing events to determine which are insert vs update
        event_ids = [e["event_id"] for e in fetched_events]
        existing_rows = {}
        
        # Query in chunks of 500 to avoid giant SQL queries
        for i in range(0, len(event_ids), 500):
            chunk = event_ids[i:i+500]
            stmt = select(ExploreContent).where(ExploreContent.event_id.in_(chunk))
            for row in db.scalars(stmt).all():
                existing_rows[row.event_id] = row

        for ev in fetched_events:
            try:
                row = existing_rows.get(ev["event_id"])
                if row:
                    # Update
                    row.city = ev["city"]
                    row.title = ev["title"]
                    row.category = ev["category"]
                    row.venue_name = ev["venue_name"]
                    row.venue_lat = ev["venue_lat"]
                    row.venue_lon = ev["venue_lon"]
                    row.state = ev["state"]
                    row.start_date = ev["start_date"]
                    row.start_time = ev["start_time"]
                    row.price_min = ev["price_min"]
                    row.price_max = ev["price_max"]
                    row.image_url = ev["image_url"]
                    row.ticket_url = ev["ticket_url"]
                    row.fetched_at = now
                    updated_count += 1
                else:
                    # Insert
                    new_row = ExploreContent(
                        city=ev["city"],
                        content_type="ticketmaster_event",
                        data=[],
                        fetched_at=now,
                        event_id=ev["event_id"],
                        title=ev["title"],
                        category=ev["category"],
                        venue_name=ev["venue_name"],
                        venue_lat=ev["venue_lat"],
                        venue_lon=ev["venue_lon"],
                        state=ev["state"],
                        start_date=ev["start_date"],
                        start_time=ev["start_time"],
                        price_min=ev["price_min"],
                        price_max=ev["price_max"],
                        image_url=ev["image_url"],
                        ticket_url=ev["ticket_url"],
                        source=ev["source"]
                    )
                    db.add(new_row)
                    inserted_count += 1
            except Exception as e:
                logger.error("Failed to process event %s: %s", ev["event_id"], e)

        db.commit()

        # 3. Delete past events
        logger.info("Deleting past events from database...")
        del_stmt = delete(ExploreContent).where(
            ExploreContent.content_type == "ticketmaster_event",
            ExploreContent.start_date < today
        )
        result = db.execute(del_stmt)
        deleted_count = result.rowcount
        db.commit()

        logger.info(
            "Bulk fetch job complete! Unique Fetched: %d | Inserted: %d | Updated: %d | Deleted: %d",
            len(fetched_events), inserted_count, updated_count, deleted_count
        )

    except Exception as exc:
        logger.exception("Database bulk events operation failed: %s", exc)
        db.rollback()
    finally:
        db.close()

    return {
        "fetched": len(fetched_events),
        "inserted": inserted_count,
        "updated": updated_count,
        "deleted": deleted_count
    }
