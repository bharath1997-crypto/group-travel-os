#!/usr/bin/env python3
"""
Add Ticketmaster sources for every US state and every country that has events.

Dry run by default (prints the sources, writes nothing). --apply writes to
ingest.sources through the same store.add_source() the CLI uses, so each config
is validated first. Existing CA, TX, AK sources are left alone. A new state source
disables that state's older city source (store behaviour, by design).

Apply ONLY after migration 015 is applied and the Scaper job image with country
support is deployed, otherwise country runs fail.

Usage:
    python scripts/15_add_ticketmaster_world_sources.py                 # dry run
    python scripts/15_add_ticketmaster_world_sources.py --apply            # 3 days, then ramps itself
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from scaper.__main__ import _store, build_connector  # noqa: E402
from scaper.config import ScaperSettings  # noqa: E402
from scaper.connectors.ticketmaster import US_STATE_CODES  # noqa: E402

ALREADY_LOADED_STATES = {"CA", "TX", "AK"}
# Countries with listings on Ticketmaster Discovery (counted read-only 2026-10-25;
# SG had events but none with usable venue coordinates).
COUNTRIES = (
    "GB IE ES CA TR NL AU MX IT NZ PL DE GR CH NO BE FI CZ DK ZA AE SE AT PE BR".split()
)
INTERVAL_MINUTES = 1440


RAMP = [3, 14, 60]


def planned_sources(days_ahead: int, ramp: list[int] | None = None) -> list[dict]:
    """ramp: the daily scheduler widens days_ahead one step after each clean run (3 -> 14 -> 60)."""
    extra = {"ramp": ramp} if ramp else {}
    out: list[dict] = []
    for code in sorted(US_STATE_CODES - ALREADY_LOADED_STATES):
        out.append(
            {
                "name": f"ticketmaster:state:{code.lower()}",
                "config": {"state_code": code, "days_ahead": days_ahead, **extra},
                "state_code": code,
            }
        )
    for code in COUNTRIES:
        out.append(
            {
                "name": f"ticketmaster:country:{code.lower()}",
                "config": {"country_code": code, "days_ahead": days_ahead, **extra},
                "state_code": None,
            }
        )
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="write to ingest.sources (default: dry run)")
    parser.add_argument("--days-ahead", type=int, default=3, choices=range(1, 61), metavar="1-60")
    parser.add_argument("--no-ramp", action="store_true", help="keep days_ahead fixed instead of widening 3 -> 14 -> 60")
    args = parser.parse_args()

    settings = ScaperSettings()
    connector = build_connector("ticketmaster", settings)
    plan = planned_sources(args.days_ahead, None if args.no_ramp else RAMP)
    for item in plan:
        connector.parse_config(item["config"])  # validate before anything is written
    states = sum(1 for p in plan if p["state_code"])
    print(f"{len(plan)} sources: {states} US states + {len(plan) - states} countries, days_ahead={args.days_ahead}")
    for item in plan:
        print(f"  {item['name']:30} {item['config']}")
    if not args.apply:
        print("Dry run: nothing written. Re-run with --apply after migration 015 and the job redeploy.")
        return 0

    store = _store(settings)
    for item in plan:
        store.add_source(
            connector="ticketmaster",
            name=item["name"],
            config=item["config"],
            city_slug=None,
            state_code=item["state_code"],
            interval_minutes=INTERVAL_MINUTES,
        )
    print(f"Added/updated {len(plan)} sources.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
