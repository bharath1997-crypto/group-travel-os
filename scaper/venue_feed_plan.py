"""Dry-run planner: turn matched venues into `feed` source configs and preview each one.

Reads data/venue_overture_matches.csv (output of venue_overture_match) and writes NOTHING to the
database. For every venue it builds the exact config that `python -m scaper add-source` would
store (coordinates are the Overture place's own point), validates it with the feed connector's
own config model, and with --preview fetches the feed read-only and counts what the connector
would accept or reject.

    python -m scaper.venue_feed_plan --matches data/venue_overture_matches.csv --out data/venue_feed_plan.jsonl [--preview]
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
from collections import Counter

from scaper.connectors.feed import FeedConnector, FeedSourceConfig
from scaper.models import Rejected

MIN_SIMILARITY = 0.8

# Owner decision 2026-11-12: these matched rows are not added (wrong Overture place or a calendar
# that covers a whole university, city or state rather than the venue).
EXCLUDED_VENUES = frozenset(
    {
        "George Washington University (Lisner Auditorium)",
        "LaSells Stewart Center (OSU)",
        "F. Scott Fitzgerald Theatre",
        "Blackwater Falls State Park",
        "San Diego Civic Theatre",
    }
)

# Only states with a single time zone get one; split states stay None so naive feed times are
# rejected with a stored reason instead of guessed.
STATE_TZ = {
    "CA": "America/Los_Angeles", "WA": "America/Los_Angeles", "HI": "Pacific/Honolulu",
    "IL": "America/Chicago", "WI": "America/Chicago", "MN": "America/Chicago", "IA": "America/Chicago",
    "MO": "America/Chicago", "AL": "America/Chicago", "MS": "America/Chicago", "LA": "America/Chicago",
    "AR": "America/Chicago", "OK": "America/Chicago",
    "DE": "America/New_York", "MD": "America/New_York", "DC": "America/New_York", "VA": "America/New_York",
    "WV": "America/New_York", "OH": "America/New_York", "ME": "America/New_York", "NH": "America/New_York",
    "VT": "America/New_York", "MA": "America/New_York", "RI": "America/New_York", "CT": "America/New_York",
    "NY": "America/New_York", "NJ": "America/New_York", "PA": "America/New_York", "NC": "America/New_York",
    "SC": "America/New_York", "GA": "America/New_York",
    "CO": "America/Denver", "UT": "America/Denver", "WY": "America/Denver", "NM": "America/Denver",
    "AZ": "America/Phoenix",
}


def slugify(text_: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text_.lower()).strip("-")


def eligible(row: dict) -> bool:
    return (
        row.get("match_status") == "matched"
        and not row.get("chain")
        and float(row.get("similarity") or 0) >= MIN_SIMILARITY
        and row.get("venue_name") not in EXCLUDED_VENUES
    )


def build_source(row: dict) -> dict:
    """The exact add-source arguments for one matched row."""
    config = {
        "url": row["calendar_url"],
        "format": "auto",
        "venue": {
            "name": row["place_name"],
            "lat": float(row["lat"]),
            "lng": float(row["lng"]),
            "freeform": row.get("street_address") or None,
            "locality": row.get("city") or None,
            "region": row["state_code"],
            "postcode": row.get("postcode") or None,
            "country": "US",
        },
        "timezone": STATE_TZ.get(row["state_code"]),
        "respect_robots": True,
    }
    FeedSourceConfig.model_validate(config)  # same validation add-source runs
    return {
        "connector": "feed",
        "name": f"feed:{row['state_code'].lower()}:{slugify(row['place_name'])}",
        "config": config,
        "interval_minutes": 360,
        "gers_id": row.get("gers_id", ""),
    }


def build_plan(rows: list[dict]) -> list[dict]:
    plan, names = [], Counter()
    for row in rows:
        if not eligible(row):
            continue
        source = build_source(row)
        names[source["name"]] += 1
        if names[source["name"]] > 1:  # keep source names unique
            source["name"] += f"-{slugify(row['city'])}"
        plan.append(source)
    return plan


def preview(source: dict, connector: FeedConnector | None = None) -> dict:
    """Fetch one feed read-only and count what the connector would accept or reject."""
    connector = connector or FeedConnector()
    reasons: Counter[str] = Counter()
    try:
        for item in connector.fetch(source["config"]):
            result = connector.extract(item.payload)
            reasons["rejected: " + result.reason if isinstance(result, Rejected) else "accepted"] += 1
    except Exception as exc:  # noqa: BLE001 - report any fetch problem per source
        reasons[f"error: {exc.__class__.__name__}"] += 1
    return dict(reasons)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Dry-run plan for feed sources (no database writes).")
    ap.add_argument("--matches", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--preview", action="store_true", help="fetch each feed read-only and count accepted/rejected")
    args = ap.parse_args(argv)
    with open(args.matches, encoding="utf-8", newline="") as fh:
        plan = build_plan(list(csv.DictReader(fh)))
    connector = FeedConnector()
    totals: Counter[str] = Counter()
    with open(args.out, "w", encoding="utf-8") as out:
        for source in plan:
            if args.preview:
                source["preview"] = preview(source, connector)
                totals.update(source["preview"])
                time.sleep(1.0)
            out.write(json.dumps(source) + "\n")
    print(f"{len(plan)} sources planned")
    if args.preview:
        print(dict(totals.most_common()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
