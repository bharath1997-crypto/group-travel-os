#!/usr/bin/env python3
"""Print summary stats for geocoding battery report."""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "tests" / "reports" / "geocoding_battery_2026-09-16.json"
FIXTURE = ROOT / "tests" / "fixtures" / "geocoding_remote_battery.json"


def main() -> None:
    report_path = Path(sys.argv[1]) if len(sys.argv) > 1 else REPORT
    data = json.loads(report_path.read_text(encoding="utf-8"))
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    s = data["summary"]
    ok = s["success"]
    print(f"Cases run: {data['total']} / {fixture['count']}")
    print(f"Success: {ok} ({s['success_rate_pct']}%)")
    print(f"Failed: {s['failed']}")
    print(f"With country: {s['with_country']} ({round(100 * s['with_country'] / max(ok, 1), 1)}% of successes)")
    print(f"With state: {s['with_state']}")
    print(f"With city: {s['with_city']}")
    errs = Counter(
        r.get("error")
        or (f"http_{r.get('http_status')}" if r.get("http_status") else "connection")
        for r in data["results"]
        if not r.get("ok")
    )
    print("Failure breakdown:", dict(errs))


if __name__ == "__main__":
    main()
