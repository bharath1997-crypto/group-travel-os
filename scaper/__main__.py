"""
Scaper CLI.

  python -m scaper preview --connector eventbrite --config '{"kind":"organizer","id":"123"}'
  python -m scaper add-source --connector eventbrite --name eventbrite:org:123 \
      --config '{"kind":"organizer","id":"123"}' --city-slug orlando
  python -m scaper list-sources
  python -m scaper run --source eventbrite:org:123
  python -m scaper run-due            # cron entrypoint
  python -m scaper relink-venues      # backfill after venue-matching changes

`preview` hits the provider but never touches the database.
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from collections import Counter

from sqlalchemy import create_engine

from scaper.config import ScaperSettings
from scaper.connectors import CONNECTOR_NAMES, build_connector
from scaper.models import Rejected
from scaper.pipeline import run_due, run_source
from scaper.store import PostgresStore


def _store(settings: ScaperSettings) -> PostgresStore:
    url = settings.database_url
    if not url.startswith("postgresql"):
        sys.exit("scaper needs a PostgreSQL DATABASE_URL (or SCAPER_DATABASE_URL)")
    return PostgresStore(create_engine(url, pool_pre_ping=True))


def _preview(settings: ScaperSettings, args: argparse.Namespace) -> int:
    connector = build_connector(args.connector, settings)
    reasons: Counter[str] = Counter()
    shown = 0
    for item in connector.fetch(json.loads(args.config)):
        result = connector.extract(item.payload)
        if isinstance(result, Rejected):
            reasons[result.reason] += 1
            continue
        reasons["accepted"] += 1
        if shown < args.limit:
            shown += 1
            venue = result.venue.name if result.venue else "-"
            print(f"{result.starts_at:%Y-%m-%d %H:%M}Z  {result.status:<9} {result.title[:60]}  @ {venue}")
    print(dict(reasons), "complete" if connector.last_fetch_complete else "truncated")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="scaper")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("preview", help="fetch + extract without writing to the database")
    p.add_argument("--connector", choices=CONNECTOR_NAMES, required=True)
    p.add_argument("--config", required=True, help="source config JSON")
    p.add_argument("--limit", type=int, default=10)

    p = sub.add_parser("add-source", help="create or update an ingest.sources row")
    p.add_argument("--connector", choices=CONNECTOR_NAMES, required=True)
    p.add_argument("--name", required=True)
    p.add_argument("--config", required=True, help="source config JSON")
    p.add_argument("--city-slug")
    p.add_argument("--interval-minutes", type=int, default=360)

    sub.add_parser("list-sources")

    p = sub.add_parser("run", help="run one source now")
    p.add_argument("--source", required=True)

    p = sub.add_parser("run-due", help="run enabled sources whose interval has elapsed")
    p.add_argument("--city-slug", help="limit to one configured city, e.g. orlando")

    p = sub.add_parser("set-city-interval", help="set enabled source intervals for a city")
    p.add_argument("--city-slug", required=True)
    p.add_argument("--minutes", type=int, default=60)

    p = sub.add_parser("relink-venues", help="re-match Scaper-created places against widened venue rules")
    p.add_argument("--city-slug")

    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    # httpx logs full request URLs at INFO; Ticketmaster carries its API key in the query string.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    settings = ScaperSettings()

    if args.command == "preview":
        return _preview(settings, args)

    store = _store(settings)
    if args.command == "add-source":
        config = json.loads(args.config)
        build_connector(args.connector, settings).parse_config(config)  # validate before writing
        source = store.add_source(
            connector=args.connector,
            name=args.name,
            config=config,
            city_slug=args.city_slug,
            interval_minutes=args.interval_minutes,
        )
        print(source.model_dump_json())
        return 0
    if args.command == "list-sources":
        for source in store.list_sources():
            print(source.model_dump_json())
        return 0
    if args.command == "set-city-interval":
        count = store.set_city_interval(args.city_slug, args.minutes)
        print(json.dumps({"city_slug": args.city_slug, "interval_minutes": args.minutes, "updated_sources": count}))
        return 0
    if args.command == "run":
        source = store.get_source(args.source)
        if source is None:
            sys.exit(f"no source named {args.source}")
        report = run_source(store, build_connector(source.connector, settings), source)
        print(report.model_dump_json())
        return 0 if report.status in ("succeeded", "partial") else 1
    if args.command == "relink-venues":
        print(json.dumps({"relinked": store.relink_created_places(args.city_slug)}))
        return 0
    if args.command == "run-due":
        reports = run_due(store, lambda name: build_connector(name, settings), city_slug=args.city_slug)
        for report in reports:
            print(report.model_dump_json())
        return 1 if any(r.status == "failed" for r in reports) else 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
