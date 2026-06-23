#!/usr/bin/env python3
"""Terminate Postgres sessions stuck idle-in-transaction (dev cleanup)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import text

from app.utils.database import SessionLocal

IDLE_QUERY = """
SELECT pid, usename, state,
       EXTRACT(EPOCH FROM (now() - xact_start))::int AS xact_seconds,
       LEFT(query, 120) AS query
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND state = 'idle in transaction'
ORDER BY xact_start
"""

TERMINATE_QUERY = """
SELECT pg_terminate_backend(pid) AS terminated, pid
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND state = 'idle in transaction'
  AND xact_start < now() - interval '5 minutes'
"""


def main() -> int:
    db = SessionLocal()
    try:
        before = [dict(r) for r in db.execute(text(IDLE_QUERY)).mappings().all()]
        print("=== BEFORE ===")
        print("idle_in_transaction_count:", len(before))
        print(json.dumps(before, indent=2, default=str))

        terminated = [dict(r) for r in db.execute(text(TERMINATE_QUERY)).mappings().all()]
        db.commit()
        print("\n=== TERMINATED ===")
        print(json.dumps(terminated, indent=2, default=str))
        print("terminated_count:", sum(1 for r in terminated if r.get("terminated")))

        after = [dict(r) for r in db.execute(text(IDLE_QUERY)).mappings().all()]
        print("\n=== AFTER ===")
        print("idle_in_transaction_count:", len(after))
        print(json.dumps(after, indent=2, default=str))
    finally:
        db.close()

    return 1 if after else 0


if __name__ == "__main__":
    raise SystemExit(main())
