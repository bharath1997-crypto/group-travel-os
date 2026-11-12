"""
Dry-run checker for curated venue calendar lists (CSV from Gemini or the owner).

Reads a CSV, opens each row's calendar URL the way the feed connector would (identifying
User-Agent, robots.txt respected, one request at a time per host) and reports what it found.
It never writes to the database. A row is only "ok" when the feed connector could ingest it:
an iCalendar feed, or a page with schema.org JSON-LD events that are still in the future.

    python -m scaper.venue_feed_check --csv data/venue_feeds_x.csv --out data/venue_feeds_x.report.csv
"""
from __future__ import annotations

import argparse
import csv
import re
import sys
import threading
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx

from scaper.connectors.feed import USER_AGENT, parse_ics, parse_jsonld

REQUIRED_COLUMNS = (
    "state_code",
    "city",
    "venue_name",
    "street_address",
    "website_url",
    "calendar_url",
)
HOST_GAP_SECONDS = 1.0
MAX_BYTES = 2_000_000
_ICS_LINK = re.compile(r"""(?:href|data-href)=["']([^"']+?\.ics[^"']*|webcal:[^"']+)["']""", re.IGNORECASE)


@dataclass
class RowResult:
    row: int
    state_code: str
    city: str
    venue_name: str
    calendar_url: str
    status: str = "rejected"  # ok | check | rejected
    reason: str = ""
    kind: str = ""  # ics | jsonld | page | ""
    future_events: int = 0
    ics_link: str = ""
    final_url: str = ""
    extra: dict = field(default_factory=dict)


def _host(url: str) -> str:
    return (urlparse(url).hostname or "").lower().removeprefix("www.")


def _site(host: str) -> str:
    parts = host.split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else host


class _HostGate:
    """At most one request per host every HOST_GAP_SECONDS, across threads."""

    def __init__(self, gap: float = HOST_GAP_SECONDS) -> None:
        self._gap = gap
        self._lock = threading.Lock()
        self._next: dict[str, float] = {}

    def wait(self, host: str) -> None:
        with self._lock:
            now = time.monotonic()
            at = max(now, self._next.get(host, 0.0))
            self._next[host] = at + self._gap
        delay = at - time.monotonic()
        if delay > 0:
            time.sleep(delay)


class Checker:
    def __init__(self, client: httpx.Client | None = None, gate: _HostGate | None = None) -> None:
        self._client = client or httpx.Client(
            timeout=20.0, headers={"User-Agent": USER_AGENT}, follow_redirects=True
        )
        self._gate = gate or _HostGate(0.0 if client is not None else HOST_GAP_SECONDS)
        self._robots: dict[str, RobotFileParser | None] = {}
        self._robots_lock = threading.Lock()

    def _allowed(self, url: str) -> bool:
        parts = urlparse(url)
        origin = f"{parts.scheme}://{parts.netloc}"
        with self._robots_lock:
            cached = self._robots.get(origin, False)
        if cached is False:
            parser: RobotFileParser | None = None
            try:
                self._gate.wait(parts.netloc.lower())
                response = self._client.get(f"{origin}/robots.txt")
                if response.status_code == 200:
                    parser = RobotFileParser()
                    parser.parse(response.text.splitlines())
            except httpx.HTTPError:
                parser = None
            with self._robots_lock:
                self._robots[origin] = parser
            cached = parser
        return True if cached is None else cached.can_fetch(USER_AGENT, url)

    def check(self, index: int, row: dict[str, str]) -> RowResult:
        result = RowResult(
            row=index,
            state_code=row.get("state_code", "").strip(),
            city=row.get("city", "").strip(),
            venue_name=row.get("venue_name", "").strip(),
            calendar_url=row.get("calendar_url", "").strip(),
        )
        problem = _validate(row)
        if problem:
            result.reason = problem
            return result
        url = result.calendar_url
        if not self._allowed(url):
            result.reason = "robots.txt disallows"
            return result
        try:
            self._gate.wait(urlparse(url).netloc.lower())
            response = self._client.get(url)
        except httpx.HTTPError as exc:
            result.reason = f"fetch failed: {exc.__class__.__name__}"
            return result
        result.final_url = str(response.url)
        if response.status_code != 200:
            result.reason = f"HTTP {response.status_code}"
            return result
        text = response.text[:MAX_BYTES]

        now = datetime.now(timezone.utc)
        if text.lstrip().upper().startswith("BEGIN:VCALENDAR"):
            entries = parse_ics(text)
            result.kind = "ics"
        else:
            entries = parse_jsonld(text, str(response.url))
            result.kind = "jsonld" if entries else "page"
            match = _ICS_LINK.search(text)
            if match:
                result.ics_link = urljoin(str(response.url), match.group(1).replace("webcal:", "https:", 1))
        result.future_events = sum(1 for e in entries if _is_future(e.get("start"), now))

        site_cal, site_web = _site(_host(result.final_url or url)), _site(_host(row.get("website_url", "")))
        if result.future_events > 0:
            result.status = "ok"
            if site_cal != site_web:
                result.status, result.reason = "check", "calendar is on a different site than the venue website"
        elif result.ics_link:
            result.status, result.reason = "check", "page has an .ics link but no machine-readable events; test that link"
        elif result.kind == "ics":
            result.status, result.reason = "check", "feed has no future events"
        elif result.kind == "jsonld":
            result.status, result.reason = "check", "events found but none in the future"
        else:
            result.status, result.reason = "check", "page loads but has no machine-readable events"
        return result


def _is_future(start: object, now: datetime) -> bool:
    if not start:
        return False
    try:
        return datetime.fromisoformat(str(start)) > now
    except ValueError:
        return False


def _validate(row: dict[str, str]) -> str:
    if not re.fullmatch(r"[A-Z]{2}", row.get("state_code", "").strip()):
        return "bad state_code"
    for column in ("venue_name", "city"):
        if not row.get(column, "").strip():
            return f"missing {column}"
    url = row.get("calendar_url", "").strip()
    if not re.match(r"^https?://[^\s]+$", url):
        return "calendar_url is not a usable http(s) URL"
    site = row.get("website_url", "").strip()
    if site and not re.match(r"^https?://[^\s]+$", site):
        return "website_url is not a usable http(s) URL"
    blocked = ("meetup.com", "facebook.com", "instagram.com", "tiktok.com", "eventbrite.com", "ticketmaster.com")
    if any(_host(url).endswith(b) for b in blocked):
        return "source is not allowed (AGENTS.md section 4)"
    return ""


def read_rows(path: str) -> list[dict[str, str]]:
    with open(path, newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        missing = [c for c in REQUIRED_COLUMNS if c not in (reader.fieldnames or [])]
        if missing:
            raise SystemExit(f"CSV is missing columns: {', '.join(missing)}")
        return list(reader)


def run(rows: list[dict[str, str]], workers: int = 8, checker: Checker | None = None) -> list[RowResult]:
    checker = checker or Checker()
    seen: set[str] = set()
    results: list[RowResult | None] = [None] * len(rows)
    jobs: list[tuple[int, dict[str, str]]] = []
    for i, row in enumerate(rows):
        key = row.get("calendar_url", "").strip().lower()
        if key in seen and key:
            results[i] = RowResult(
                row=i + 2,
                state_code=row.get("state_code", ""),
                city=row.get("city", ""),
                venue_name=row.get("venue_name", ""),
                calendar_url=key,
                status="check",
                reason="duplicate calendar_url in this file",
            )
            continue
        seen.add(key)
        jobs.append((i, row))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for (i, _), res in zip(jobs, pool.map(lambda job: checker.check(job[0] + 2, job[1]), jobs)):
            results[i] = res
    return [r for r in results if r is not None]


def write_report(path: str, results: list[RowResult]) -> None:
    columns = ["row", "status", "reason", "kind", "future_events", "state_code", "city", "venue_name",
               "calendar_url", "final_url", "ics_link"]
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for r in results:
            writer.writerow(asdict(r))


def summarize(results: list[RowResult]) -> str:
    by_status = Counter(r.status for r in results)
    by_kind = Counter(r.kind or "-" for r in results if r.status == "ok")
    reasons = Counter(r.reason for r in results if r.status != "ok").most_common(6)
    lines = [
        f"{len(results)} rows: {by_status['ok']} ok, {by_status['check']} check, {by_status['rejected']} rejected",
        f"ok by kind: {dict(by_kind)}",
        "top reasons: " + "; ".join(f"{reason} x{n}" for reason, n in reasons),
    ]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Dry-run check of a venue calendar CSV (no database writes).")
    parser.add_argument("--csv", required=True)
    parser.add_argument("--out", required=True, help="report CSV to write")
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--limit", type=int, default=0, help="check only the first N rows")
    args = parser.parse_args(argv)
    rows = read_rows(args.csv)
    if args.limit:
        rows = rows[: args.limit]
    results = run(rows, workers=args.workers)
    write_report(args.out, results)
    print(summarize(results))
    return 0


if __name__ == "__main__":
    sys.exit(main())
