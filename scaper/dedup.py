"""
Pure dedup rules (no DB). Spec: Scram Book/Explorer Tab/Scaper_Dedup_Spec.md.

Principle: when unsure, keep both. A duplicate card is an annoyance; hiding a
different real event is a bug.
"""
from __future__ import annotations

import math
import re
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

START_WINDOW = timedelta(minutes=30)
NEARBY_M = 150.0
# Canonical tie-break after completeness: official primary sellers first.
PROVIDER_RANK = {"ticketmaster": 0, "eventbrite": 1}

_PUNCT = re.compile(r"[^\w\s]+", re.UNICODE)
_AT_TAIL = re.compile(r"\s@\s.*$")
TITLE_FILLER = frozenset(
    {"presents", "live", "in", "at", "the", "tour", "tickets", "featuring", "feat", "ft",
     "with", "and", "a", "an", "of", "show", "concert"}
)


def _tokens(text: str) -> list[str]:
    return _PUNCT.sub(" ", text.lower()).split()


def city_tokens(city_slug: str | None) -> set[str]:
    return set(city_slug.split("-")) if city_slug else set()


def norm_venue(name: str, city_slug: str | None) -> tuple[str, ...]:
    """'The Abbey-Orlando' -> ('abbey',). Leading 'the' and city tokens removed."""
    tokens = _tokens(name)
    if tokens and tokens[0] == "the":
        tokens = tokens[1:]
    city = city_tokens(city_slug)
    return tuple(t for t in tokens if t not in city)


def _contains_words(short: tuple[str, ...], long: tuple[str, ...]) -> bool:
    n = len(short)
    return any(long[i : i + n] == short for i in range(len(long) - n + 1))


def same_venue_name(a: str, b: str, city_slug: str | None) -> bool:
    """Tier A2 name rule: equal after normalization, or whole-word containment of a 2+ word name."""
    na, nb = norm_venue(a, city_slug), norm_venue(b, city_slug)
    if not na or not nb:
        return False
    if na == nb:
        return True
    short, long = sorted((na, nb), key=len)
    return len(short) >= 2 and _contains_words(short, long)


_UNIT = re.compile(r"(#\s*\w+|\b(?:suite|ste|unit|apt|fl|floor|rm|room)\b\.?\s*\w+)", re.IGNORECASE)
STREET_ABBREV = {
    "north": "n", "south": "s", "east": "e", "west": "w",
    "street": "st", "avenue": "ave", "av": "ave", "drive": "dr", "road": "rd", "boulevard": "blvd",
    "lane": "ln", "court": "ct", "place": "pl", "parkway": "pkwy", "highway": "hwy", "terrace": "ter",
    "circle": "cir", "square": "sq", "trail": "trl",
}


def norm_street(address: str | None) -> tuple[str, ...]:
    """'100 South Eola Drive' and '100 S Eola Dr #100' -> ('100', 's', 'eola', 'dr')."""
    if not address:
        return ()
    first_line = address.split(",")[0]
    return tuple(STREET_ABBREV.get(t, t) for t in _tokens(_UNIT.sub(" ", first_line)))


def norm_postcode(postcode: str | None) -> str:
    """US ZIP+4 -> ZIP5; other formats compared without spaces, uppercased."""
    if not postcode:
        return ""
    code = postcode.replace(" ", "").upper()
    return code[:5] if code[:5].isdigit() else code


def same_venue_address(
    name_a: str, street_a: str | None, postcode_a: str | None,
    name_b: str, street_b: str | None, postcode_b: str | None,
    city_slug: str | None,
) -> bool:
    """Tier A3: normalized name, street address and postcode all equal (and none empty)."""
    na, nb = norm_venue(name_a, city_slug), norm_venue(name_b, city_slug)
    sa, sb = norm_street(street_a), norm_street(street_b)
    pa, pb = norm_postcode(postcode_a), norm_postcode(postcode_b)
    return bool(na and sa and pa) and na == nb and sa == sb and pa == pb


def norm_title(title: str, venue_name: str | None, city_slug: str | None) -> tuple[str, ...]:
    """'Joey Cash in Orlando' -> ('joey', 'cash'). Drops '@ venue' tails, venue/city words, filler."""
    drop = set(TITLE_FILLER) | city_tokens(city_slug)
    if venue_name:
        drop |= set(_tokens(venue_name))
    return tuple(t for t in _tokens(_AT_TAIL.sub("", title)) if t not in drop)


def same_show(a: tuple[str, ...], b: tuple[str, ...]) -> bool:
    """Headliner containment: one normalized title's words all appear, in order, in the other."""
    if not a or not b or not any(len(t) >= 3 for t in a + b):
        return False
    short, long = sorted((a, b), key=len)
    return _contains_words(short, long)


@dataclass(frozen=True)
class EventRow:
    id: uuid.UUID
    provider: str
    title: str
    venue_name: str | None
    venue_place_id: uuid.UUID | None
    lat: float | None
    lng: float | None
    start_time: datetime
    end_time: datetime | None
    price_min: float | None
    image_url: str | None
    first_seen_at: datetime
    status: str
    timezone: str | None = None


def local_day(e: EventRow) -> date:
    """Calendar day at the venue; dedup groups never span two local days."""
    try:
        return e.start_time.astimezone(ZoneInfo(e.timezone or "UTC")).date()
    except (ZoneInfoNotFoundError, ValueError):
        return e.start_time.date()


def _distance_m(a: EventRow, b: EventRow) -> float | None:
    if None in (a.lat, a.lng, b.lat, b.lng):
        return None
    lat1, lng1, lat2, lng2 = map(math.radians, (a.lat, a.lng, b.lat, b.lng))  # type: ignore[arg-type]
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 2 * 6_371_000 * math.asin(math.sqrt(h))


def _same_place(a: EventRow, b: EventRow) -> bool:
    if a.venue_place_id and a.venue_place_id == b.venue_place_id:
        return True
    d = _distance_m(a, b)
    return d is not None and d <= NEARBY_M


def completeness(e: EventRow) -> int:
    return (e.price_min is not None) + (e.image_url is not None) + (e.end_time is not None)


def _canonical_key(e: EventRow) -> tuple:
    return (-completeness(e), PROVIDER_RANK.get(e.provider, 99), e.first_seen_at, str(e.id))


def plan_duplicates(events: list[EventRow], city_slug: str | None) -> dict[uuid.UUID, uuid.UUID | None]:
    """
    Desired duplicate_of for every event given. Two rules, both limited to one
    local day at the same place:

    - duplicate listing: starts within ±30 min and one headliner contains the other;
    - timed-entry series: identical normalized title (e.g. a museum's 30-min slots).

    Readers show one row per group, picking the next upcoming slot at read time
    (app/services/scaper_event_visibility.py). Cancelled events never cluster, so
    they always stand on their own (approved: show cancelled and scheduled
    independently).
    """
    plan: dict[uuid.UUID, uuid.UUID | None] = {e.id: None for e in events}
    live = sorted((e for e in events if e.status != "cancelled"), key=lambda e: e.start_time)
    titles = {e.id: norm_title(e.title, e.venue_name, city_slug) for e in live}

    parent = {e.id: e.id for e in live}

    def find(x: uuid.UUID) -> uuid.UUID:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    days = {e.id: local_day(e) for e in live}
    for i, a in enumerate(live):
        for b in live[i + 1 :]:
            if b.start_time - a.start_time > START_WINDOW:
                break
            if days[a.id] == days[b.id] and _same_place(a, b) and same_show(titles[a.id], titles[b.id]):
                parent[find(a.id)] = find(b.id)

    series: dict[tuple[date, tuple[str, ...]], list[EventRow]] = {}
    for e in live:
        if any(len(t) >= 3 for t in titles[e.id]):
            series.setdefault((days[e.id], titles[e.id]), []).append(e)
    for members in series.values():
        for i, a in enumerate(members):
            for b in members[i + 1 :]:
                if _same_place(a, b):
                    parent[find(a.id)] = find(b.id)

    clusters: dict[uuid.UUID, list[EventRow]] = {}
    for e in live:
        clusters.setdefault(find(e.id), []).append(e)
    for members in clusters.values():
        if len(members) < 2:
            continue
        canonical = min(members, key=_canonical_key)
        for e in members:
            if e.id != canonical.id:
                plan[e.id] = canonical.id
    return plan
