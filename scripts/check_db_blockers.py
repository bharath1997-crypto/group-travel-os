#!/usr/bin/env python3
"""Print Postgres blockers, pool stats, and timeout settings (dev troubleshooting)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.utils.database import SessionLocal
from app.utils.db_diagnostics import collect_db_diagnostics


def main() -> int:
    db = SessionLocal()
    try:
        report = collect_db_diagnostics(db)
    finally:
        db.close()

    print(json.dumps(report, indent=2, default=str))

    blockers = report.get("blockers") or []
    idle_tx = report.get("idle_in_transaction") or []
    if blockers or idle_tx:
        print(
            "\nWARNING: blockers or idle-in-transaction sessions detected.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
