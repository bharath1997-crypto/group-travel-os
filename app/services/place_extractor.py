"""
app/services/place_extractor.py — find named places in page/video text with plain rules.

No AI model and no network call (owner decision 2026-11-15: Gemini is kept for Wayra only,
cost). Everything here is deterministic and free:

- Articles: schema.org JSON-LD (ItemList, Restaurant, TouristAttraction, ...) first, then
  numbered or list-style headings ("1. Time Out Market").
- YouTube: chapter lines in the description ("3:45 Pasteis de Belem") and pin lines
  ("📍 Cervejaria Ramiro").
- City: from schema.org addressLocality, else from the title ("... in Lisbon").

Rules are less smart than a model: they miss places written as plain prose, and chapters can
be activities instead of venues. So every result is shown for the user to check and edit
before anything is saved.
"""
from __future__ import annotations

import html as html_lib
import json
import re
from typing import Any

from bs4 import BeautifulSoup

PLACE_TYPES = {
    "restaurant", "barorpub", "cafeorcoffeeshop", "foodestablishment", "bakery", "brewery",
    "winery", "nightclub", "touristattraction", "landmarksorhistoricalbuildings", "museum",
    "artgallery", "park", "zoo", "aquarium", "amusementpark", "beach", "church", "castle",
    "placeofworship", "stadiumorarena", "musicvenue", "place", "localbusiness", "store",
    "shoppingcenter", "touristdestination", "bookstore", "icecreamshop",
}
# Containers that are not themselves a venue to save.
SKIP_TYPES = {"city", "country", "state", "administrativearea", "organization", "person", "hotel", "lodgingbusiness", "resort"}

GENERIC = {
    "intro", "introduction", "outro", "conclusion", "final thoughts", "summary", "recap", "faq",
    "faqs", "tips", "getting around", "getting there", "where to stay", "how to get there",
    "related posts", "related articles", "comments", "leave a reply", "share this", "about",
    "about us", "about the author", "contact", "newsletter", "subscribe", "table of contents",
    "our picks", "overview", "map", "sponsor", "sponsors", "thanks", "thank you", "the end",
    "best time to visit", "budget", "packing list", "what to pack", "before you go",
    "more", "bonus", "welcome", "hello", "start", "end", "ending", "beginning", "opening",
    "bloopers", "behind the scenes", "next", "previous", "contents", "disclaimer",
}
_GENERIC_START = re.compile(
    r"^(?:intro|outro|introduction|conclusion|final thoughts|where to|how to|"
    r"getting (?:there|around|started)|tips(?:\s*(?:for|&|and).*)?$|faqs?$|about (?:us|the author|me)$|"
    r"related (?:posts?|articles?)|share this|subscribe|"
    r"day \d+\s*(?:[:\-–—]|$)|part \d+\s*(?:[:\-–—]|$)|chapter \d+\s*(?:[:\-–—]|$)|"
    r"(?:thanks|recap|summary|sponsors?)$|thank you|packing (?:list|tips)|best time|"
    r"budget(?:\s*(?:tips|breakdown|overview))?$|why (?:you|visit|go)|what (?:to|you)|when to|"
    r"our (?:picks?|favou?rites?|top)|my (?:top|favou?rite|picks?)|the best (?:time|way)|the top \d|top \d+|"
    r"\d+ (?:best|top|things|places|reasons))",
    re.IGNORECASE,
)
# "Comments (4)", "Leave a reply": page furniture, never a venue.
_FURNITURE = re.compile(r"^(?:comments?|replies|reply|leave a (?:comment|reply)|post a comment)\b", re.IGNORECASE)
_AM_PM = re.compile(r"^(?:am|pm)\b", re.IGNORECASE)
_ADDRESS = re.compile(r"\d.*,|,.*\d")  # "Via Roma 12, 00100 Rome": an address line, not a name

_NUMBERED = re.compile(
    r"^\s*(?:(?:#|no\.?\s*)(\d{1,2})(?:\s*[.):\-–—]\s*|\s+)|(\d{1,2})\s*[.):\-–—]\s*)(.+)$",
    re.IGNORECASE,
)
_CHAPTER = re.compile(r"^\s*(?:[-•*▶►→]\s*)?(?:\d{1,2}:)?\d{1,2}:\d{2}\s*[-–—:.)|]*\s*(.+?)\s*$")
_PIN = re.compile(r"^\s*(?:📍|📌|🏠|🍽️?|☕|🍷|🍺)\s*(?:location|place|address|where)?\s*[:\-–—]?\s*(.+?)\s*$", re.IGNORECASE)
_LABELLED = re.compile(r"^\s*(?:location|place|venue|restaurant|cafe|café|bar)\s*:\s*(.+?)\s*$", re.IGNORECASE)
_TITLE_CITY = re.compile(
    r"\b(?:in|at|around|across|through|visiting|exploring|to)\s+(?:the\s+)?([A-Z][\w'’.\-]*(?:\s+(?:de|la|del|da|do|of|the|[A-Z][\w'’.\-]*))*)"
)
_LISTICLE_TITLE = re.compile(r"\b(best|top|\d+|favou?rite|must|where to|things to|cafes?|bars?|restaurants?)\b", re.IGNORECASE)
_SPLIT = re.compile(r"\s+[–—|]\s+|\s+-\s+|:\s+")


def _tidy(name: str, *, authoritative: bool = False) -> str | None:
    """Clean a candidate name. `authoritative` = the page itself declared it a place (JSON-LD),
    so only exact page-furniture words are refused, not heading-style prefixes."""
    n = " ".join(name.replace("​", "").split()).strip(" -–—:|•*#.,;\"'“”‘’[]")
    if n.count("(") != n.count(")"):  # "Comments (4)" lost its bracket; keep balanced ones
        n = n.replace("(", "").replace(")", "").strip()
    if not (2 <= len(n) <= 80):
        return None
    low = n.lower()
    if low in GENERIC or _FURNITURE.match(low):
        return None
    if not authoritative and (_GENERIC_START.match(low) or _AM_PM.match(low) or _ADDRESS.search(n)):
        return None
    if re.fullmatch(r"[\d\W_]+", n):
        return None
    if len(n.split()) > 9:  # a sentence, not a name
        return None
    return n


def _head(text: str) -> str:
    """Name part of 'Cervejaria Ramiro – best seafood in town'."""
    return _SPLIT.split(text, maxsplit=1)[0]


def city_from_title(title: str) -> str | None:
    """'Best cafes in Lisbon (2026)' -> 'Lisbon'. None when no segment says 'in <Place>'."""
    cleaned = re.sub(r"\(.*?\)|\[.*?\]|20\d\d", " ", title or "")
    for segment in re.split(r"\||\s[-–—]\s|:\s", cleaned):
        matches = _TITLE_CITY.findall(segment)
        if not matches:
            continue
        city = matches[-1].strip(" .,'’-")
        city = re.sub(r"\s+(?:Guide|Travel|Vlog|Tour|Food|Eats)$", "", city, flags=re.IGNORECASE)
        if 2 <= len(city) <= 60:
            return city
    return None


# ── articles ───────────────────────────────────────────────────────────────────
def _types_of(node: dict[str, Any]) -> set[str]:
    t = node.get("@type")
    items = t if isinstance(t, list) else [t]
    return {str(x).rsplit("/", 1)[-1].lower() for x in items if x}


def _walk(node: Any, out: list[dict[str, Any]]) -> None:
    if isinstance(node, list):
        for n in node:
            _walk(n, out)
    elif isinstance(node, dict):
        out.append(node)
        for v in node.values():
            if isinstance(v, (dict, list)):
                _walk(v, out)


def _address_city(node: dict[str, Any]) -> tuple[str | None, str | None]:
    addr = node.get("address")
    if isinstance(addr, list) and addr:
        addr = addr[0]
    if isinstance(addr, dict):
        country = addr.get("addressCountry")
        if isinstance(country, dict):
            country = country.get("name")
        return (
            addr.get("addressLocality") if isinstance(addr.get("addressLocality"), str) else None,
            country if isinstance(country, str) else None,
        )
    return None, None


def extract_from_json_ld(html: str) -> list[dict[str, Any]]:
    """Places declared by the page itself. Highest-precision source."""
    soup = BeautifulSoup(html, "html.parser")
    nodes: list[dict[str, Any]] = []
    for tag in soup.find_all("script", type=lambda v: v and "ld+json" in v.lower()):
        raw = tag.string or tag.get_text() or ""
        try:
            _walk(json.loads(raw), nodes)
        except (json.JSONDecodeError, RecursionError):
            continue
    found: list[dict[str, Any]] = []
    for node in nodes:
        types = _types_of(node)
        name = node.get("name") if isinstance(node.get("name"), str) else None
        if types & {"listitem"} and isinstance(node.get("item"), dict):
            inner = node["item"]
            if not (_types_of(inner) & SKIP_TYPES):
                name = inner.get("name") if isinstance(inner.get("name"), str) else name
                node = {**inner, **{k: v for k, v in node.items() if k != "item"}}
                types = types | _types_of(inner)
        if not name or (types & SKIP_TYPES and not types & PLACE_TYPES):
            continue
        if not (types & PLACE_TYPES) and "listitem" not in types:
            continue
        # A bare ListItem only counts when it carries a venue type or an address.
        city, country = _address_city(node)
        if "listitem" in types and not (types & PLACE_TYPES) and not city:
            continue
        tidy = _tidy(html_lib.unescape(name), authoritative=True)
        if tidy:
            found.append({"name": tidy, "city": city, "country": country, "category": None})
    unique: dict[str, dict[str, Any]] = {}
    for f in found:
        unique.setdefault(f["name"].lower(), f)
    return list(unique.values())


def extract_from_headings(html: str, title: str) -> list[dict[str, Any]]:
    """Numbered headings ('1. Name'), or plain h2/h3 headings when the title reads like a list."""
    soup = BeautifulSoup(html, "html.parser")
    # Headings in menus, footers, sidebars and comment threads are page furniture, not places.
    for junk in soup(["nav", "footer", "aside", "form", "noscript"]):
        junk.decompose()
    for junk in soup.select("#comments, #respond, .comments, .comment-list, .comments-area, #sidebar, .sidebar, .widget, .related-posts"):
        junk.decompose()
    heads = [" ".join(h.get_text(" ", strip=True).split()) for h in soup.find_all(["h2", "h3", "h4"])]
    heads = [h for h in heads if h]
    numbered: list[str] = []
    for h in heads:
        m = _NUMBERED.match(h)
        if m:
            name = _tidy(_head(m.group(3)))
            if name:
                numbered.append(name)
    if len(numbered) >= 2:
        return [{"name": n, "city": None, "country": None, "category": None} for n in numbered]
    if _LISTICLE_TITLE.search(title or "") and len(heads) >= 4:
        plain = [n for n in (_tidy(_head(h)) for h in heads) if n]
        if len(plain) >= 3:
            return [{"name": n, "city": None, "country": None, "category": None} for n in plain]
    return []


def extract_from_article(html: str, title: str) -> list[dict[str, Any]]:
    """Places in a public article, with a city from the page's own address data or its title."""
    places = extract_from_json_ld(html) or extract_from_headings(html, title)
    default_city = city_from_title(title)
    for p in places:
        p["city"] = p.get("city") or default_city
    return places


# ── YouTube ────────────────────────────────────────────────────────────────────
def extract_from_description(title: str, description: str) -> list[dict[str, Any]]:
    """Chapter lines ('3:45 Pasteis de Belem') and pin lines ('📍 Cervejaria Ramiro')."""
    names: list[str] = []
    for line in (description or "").splitlines():
        for rx in (_CHAPTER, _PIN, _LABELLED):
            m = rx.match(line)
            if m:
                name = _tidy(_head(m.group(1)))
                if name:
                    names.append(name)
                break
    city = city_from_title(title)
    return [{"name": n, "city": city, "country": None, "category": None} for n in names]
