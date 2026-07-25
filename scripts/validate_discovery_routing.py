"""Validate discovery routing against wyra/wayra_discovery_questions.jsonl."""
from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JSONL = ROOT / "wyra" / "wayra_discovery_questions.jsonl"

sys.path.insert(0, str(ROOT))

from app.services.wayra_discovery import classify_discovery_expects  # noqa: E402
from app.services.wayra_intent import (  # noqa: E402
    WayraMode,
    classify_mode,
    is_live_map_identity_question,
    is_live_place_deep_question,
    resolve_app_intent,
)


def route_question(question: str, expected: str) -> tuple[str, str | None]:
    """Return (actual_route, detail) where route matches JSONL expects field."""
    discovery = classify_discovery_expects(question)

    if expected == "local":
        if is_live_map_identity_question(question):
            return "local", discovery
        return "other", discovery

    if expected == "llm":
        if is_live_place_deep_question(question) and classify_mode(question) == WayraMode.TRAVEL:
            return "llm", discovery
        return "other", discovery

    if expected == "app_guide":
        if classify_mode(question) == WayraMode.APP_GUIDE and resolve_app_intent(question):
            return "app_guide", discovery
        if classify_mode(question) == WayraMode.APP_GUIDE:
            return "app_guide", discovery
        return "other", discovery

    return "unknown", discovery


def main() -> int:
    total = 0
    ok = 0
    fails: list[dict] = []
    by_cat = Counter()
    miss_cat = Counter()

    with JSONL.open(encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            row = json.loads(line)
            total += 1
            expected = row["expects"]
            actual, discovery = route_question(row["question"], expected)
            by_cat[row["category"]] += 1

            if actual == expected:
                ok += 1
            else:
                miss_cat[row["category"]] += 1
                if len(fails) < 30:
                    fails.append(
                        {
                            "id": row["id"],
                            "category": row["category"],
                            "expected": expected,
                            "actual": actual,
                            "discovery": discovery,
                            "question": row["question"],
                        }
                    )

    print(f"total={total} ok={ok} accuracy={ok/total*100:.2f}%")
    print("misses by category:", dict(miss_cat))
    if fails:
        print("\nSample failures:")
        for f in fails[:15]:
            print(json.dumps(f, ensure_ascii=False))

    return 0 if ok == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
