"""SeatGeek price scraper — public events API."""
from __future__ import annotations

from datetime import date, datetime

import httpx
from rapidfuzz import fuzz

_SEATGEEK_URL = "https://api.seatgeek.com/2/events"


def _dates_within_one_day(a: date, b: date) -> bool:
    return abs((a - b).days) <= 1


async def scrape_seatgeek_prices(
    title: str,
    city: str,
    event_date: date,
) -> dict | None:
    try:
        params = {
            "q": title,
            "venue.city": city,
            "per_page": 3,
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(_SEATGEEK_URL, params=params)
            if resp.status_code != 200:
                return None
            payload = resp.json()

        events = payload.get("events") if isinstance(payload, dict) else None
        if not isinstance(events, list):
            return None

        norm_title = title.lower().strip()
        for ev in events:
            if not isinstance(ev, dict):
                continue
            ev_title = str(ev.get("title") or "")
            if fuzz.ratio(norm_title, ev_title.lower()) < 80:
                continue

            dt_raw = ev.get("datetime_local") or ev.get("datetime_utc")
            if dt_raw:
                try:
                    ev_date = datetime.fromisoformat(
                        str(dt_raw).replace("Z", "+00:00")
                    ).date()
                except ValueError:
                    ev_date = None
            else:
                ev_date = None

            if ev_date and not _dates_within_one_day(ev_date, event_date):
                continue

            stats = ev.get("stats") if isinstance(ev.get("stats"), dict) else {}
            lowest = stats.get("lowest_price") or stats.get("lowest_sg_base_price")
            if lowest is None:
                continue

            try:
                min_price = float(lowest)
            except (TypeError, ValueError):
                continue

            provider_url = str(ev.get("url") or ev.get("short_title") or "")
            if not provider_url.startswith("http"):
                provider_url = f"https://seatgeek.com{provider_url}" if provider_url.startswith("/") else ""

            if not provider_url:
                continue

            return {
                "provider": "seatgeek",
                "min_price": min_price,
                "provider_url": provider_url,
                "availability": "available",
            }

        return None
    except Exception:
        return None
