"""
app/services/explore_event_normalizer.py — Maps raw vendor data into ExploreEvent model.
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime
from typing import Any

from dateutil import parser


def _safe_parse_date(date_str: str | None) -> datetime | None:
    if not date_str:
        return None
    try:
        # Simplistic parsing; production requires robust timezone handling.
        return parser.parse(date_str)
    except Exception:
        return None


def _determine_category(title: str, description: str) -> str:
    combined = f"{title} {description}".lower()
    
    if any(k in combined for k in ["music", "concert", "dj", "jazz", "band"]):
        return "Music"
    if any(k in combined for k in ["food", "dinner", "tasting", "restaurant", "beer", "wine"]):
        return "Food"
    if any(k in combined for k in ["sport", "game", "match", "baseball", "basketball"]):
        return "Sports"
    if any(k in combined for k in ["art", "gallery", "museum", "exhibit"]):
        return "Art"
    if any(k in combined for k in ["nature", "park", "outdoor", "garden", "hike"]):
        return "Nature"
    if any(k in combined for k in ["hotel", "resort", "inn", "stay"]):
        return "Hotels"
        
    return "Events"


def _determine_free(ticket_info: list[dict[str, Any]] | None, title: str, description: str) -> bool:
    if ticket_info:
        for t in ticket_info:
            if "free" in str(t.get("ticket_type", "")).lower():
                return True
    
    combined = f"{title} {description}".lower()
    if "free entry" in combined or "free admission" in combined:
        return True
        
    return False


def normalize_dataforseo_event(raw_item: dict[str, Any], city: str) -> dict[str, Any]:
    """
    Takes a raw DataForSEO Google Events dictionary and returns a normalized dictionary
    matching the ExploreEvent model schema.
    """
    title = raw_item.get("title", "")
    description = raw_item.get("snippet", raw_item.get("description", ""))
    
    url = raw_item.get("url", raw_item.get("link", ""))
    
    location_data = raw_item.get("location_info", raw_item.get("location", {}))
    venue_name = None
    if isinstance(location_data, dict):
        venue_name = location_data.get("name", location_data.get("address"))
    
    date_info = raw_item.get("event_dates", raw_item.get("date", {}))
    if not isinstance(date_info, dict):
        date_info = {}
    
    start_time_str = date_info.get("start_datetime") or date_info.get("start_date") or date_info.get("when")
    
    # Generate a deterministic external_id since the raw API doesn't always provide a stable UUID
    id_string = f"{title}_{city}_{venue_name}_{start_time_str}_{url}"
    external_id = f"g_evt_{hashlib.md5(id_string.encode('utf-8')).hexdigest()}"
    
    ticket_info = raw_item.get("information_and_tickets", raw_item.get("ticket_info", []))
    if not isinstance(ticket_info, list):
        ticket_info = []

    # Store all ticket links as a JSON string so frontend can show all of them
    ticket_links = []
    for t in ticket_info:
        t_title = t.get("title", "")
        t_url = t.get("url", t.get("link", ""))
        if t_title and t_url:
            ticket_links.append({"title": t_title, "url": t_url})
            
    if ticket_links:
        booking_url = json.dumps(ticket_links)
    else:
        booking_url = url

    return {
        "external_id": external_id,
        "source_name": "dataforseo",
        "title": title,
        "description": description,
        "city": city,
        "venue_name": venue_name,
        "start_time": _safe_parse_date(start_time_str),
        "end_time": None,
        "category": _determine_category(title, description),
        "is_free": _determine_free(ticket_info, title, description),
        "price_from": None,
        "image_url": raw_item.get("image_url", raw_item.get("thumbnail", "")),
        "booking_url": booking_url,
    }
