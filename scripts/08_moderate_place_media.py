#!/usr/bin/env python3
"""
Review user-uploaded Explore place photos.

    python scripts/08_moderate_place_media.py list
    python scripts/08_moderate_place_media.py approve <media_id> [<media_id> ...]
    python scripts/08_moderate_place_media.py reject  <media_id> [<media_id> ...]

Only `rovvy_user` uploads are touched. Approved photos appear on the Explore
card and drawer for that place (newest approved photo wins).
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("action", choices=["list", "approve", "reject"])
    parser.add_argument("ids", nargs="*")
    args = parser.parse_args(argv)

    from dotenv import load_dotenv
    import psycopg2

    load_dotenv(ROOT / ".env")
    conn = psycopg2.connect(os.environ["DATABASE_URL"], connect_timeout=15)
    cur = conn.cursor()

    if args.action == "list":
        cur.execute(
            """
            SELECT m.id, m.place_key, p.name, m.storage_url, m.caption, m.created_at
            FROM place_media m
            LEFT JOIN places p ON 'gers:' || p.gers_id = m.place_key
            WHERE m.source = 'rovvy_user' AND m.moderation_status = 'pending'
            ORDER BY m.created_at
            """
        )
        rows = cur.fetchall()
        for media_id, key, name, url, caption, created in rows:
            print(f"{media_id}  {created:%Y-%m-%d %H:%M}  {name or key}\n    {url}" + (f"\n    caption: {caption}" if caption else ""))
        print(f"{len(rows)} pending")
        return 0

    if not args.ids:
        parser.error("give at least one media id")
    status = "approved" if args.action == "approve" else "rejected"
    cur.execute(
        """
        UPDATE place_media SET moderation_status = %s
        WHERE id = ANY(%s::uuid[]) AND source = 'rovvy_user' AND moderation_status = 'pending'
        RETURNING id
        """,
        (status, args.ids),
    )
    changed = [str(r[0]) for r in cur.fetchall()]
    conn.commit()
    print(f"{status}: {len(changed)} of {len(args.ids)}")
    for missing in sorted(set(args.ids) - set(changed)):
        print(f"  not pending / not found: {missing}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
