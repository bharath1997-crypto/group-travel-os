"""Wikipedia / Wikidata description fetch for place_facts (F50 §3)."""
from __future__ import annotations

import re
import time
from typing import Any
from urllib.parse import quote

import httpx

WIKIDATA_ENTITIES = "https://www.wikidata.org/w/api.php"
WIKI_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary"
USER_AGENT = "Rovvy/1.0 (https://rovvy.app; rovvy230@gmail.com)"
REQUEST_INTERVAL_S = 0.21  # max ~5 req/s, serial
LICENSE = "CC BY-SA 4.0"
ATTRIBUTION = "Wikipedia"

_last_request_at = 0.0


def _throttle() -> None:
    global _last_request_at
    now = time.monotonic()
    wait = REQUEST_INTERVAL_S - (now - _last_request_at)
    if wait > 0:
        time.sleep(wait)
    _last_request_at = time.monotonic()


def first_paragraph(text: str) -> str:
    raw = (text or "").strip()
    if not raw:
        return ""
    parts = re.split(r"\n\s*\n", raw, maxsplit=1)
    para = parts[0].strip()
    return para


def fetch_wikidata_entity(qid: str, *, client: httpx.Client | None = None) -> dict[str, Any] | None:
    q = (qid or "").strip().upper()
    if not re.match(r"^Q\d+$", q):
        return None
    _throttle()
    own = client is None
    if own:
        client = httpx.Client(timeout=30.0, headers={"User-Agent": USER_AGENT})
    try:
        resp = client.get(
            WIKIDATA_ENTITIES,
            params={
                "action": "wbgetentities",
                "ids": q,
                "props": "labels|descriptions|sitelinks",
                "languages": "en",
                "format": "json",
            },
        )
        resp.raise_for_status()
        entities = resp.json().get("entities") or {}
        return entities.get(q)
    finally:
        if own:
            client.close()


def english_wikipedia_title_from_entity(entity: dict[str, Any]) -> str | None:
    sitelinks = entity.get("sitelinks") or {}
    enwiki = sitelinks.get("enwiki")
    if isinstance(enwiki, dict):
        title = enwiki.get("title")
        if isinstance(title, str) and title.strip():
            return title.strip()
    return None


def fetch_wikipedia_summary(
    title: str,
    *,
    client: httpx.Client | None = None,
) -> dict[str, Any] | None:
    t = (title or "").strip()
    if not t:
        return None
    _throttle()
    own = client is None
    if own:
        client = httpx.Client(timeout=30.0, headers={"User-Agent": USER_AGENT})
    try:
        url = f"{WIKI_SUMMARY}/{quote(t.replace(' ', '_'), safe='')}"
        resp = client.get(url)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        data = resp.json()
        if data.get("type") == "disambiguation":
            return None
        extract = data.get("extract")
        if not isinstance(extract, str) or not extract.strip():
            return None
        page_url = (data.get("content_urls") or {}).get("desktop", {}).get("page")
        return {
            "title": data.get("title") or t,
            "extract": extract.strip(),
            "source_url": page_url or f"https://en.wikipedia.org/wiki/{quote(t.replace(' ', '_'))}",
        }
    finally:
        if own:
            client.close()


def wikipedia_fact_from_qid(qid: str, *, client: httpx.Client | None = None) -> dict[str, str] | None:
    entity = fetch_wikidata_entity(qid, client=client)
    if not entity or entity.get("missing") == "":
        return None
    title = english_wikipedia_title_from_entity(entity)
    if not title:
        return None
    summary = fetch_wikipedia_summary(title, client=client)
    if not summary:
        return None
    full_extract = summary["extract"]
    return {
        "key": "extract",
        "value": full_extract,
        "source": "wikipedia",
        "source_url": summary["source_url"],
        "license": LICENSE,
        "attribution": ATTRIBUTION,
    }
