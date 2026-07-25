"""Analyze wayra_discovery_questions.jsonl templates."""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JSONL = ROOT / "wyra" / "wayra_discovery_questions.jsonl"

FILLERS = [
    "ok so ",
    "hey ",
    "hmm ",
    "yo ",
    "wait ",
    "so ",
    "please advise: ",
    "could you tell me ",
    "i'd like to know ",
    "actually, ",
    "quick q: ",
    "real quick, ",
    "tell me, ",
    "curious, ",
    "btw ",
    "one more thing, ",
]

DEICTICS = [
    "where i dropped the pin",
    "wat is dis place",
    "this part of town",
    "this location",
    "around here",
    "over here",
    "ova here",
    "out there",
    "this region",
    "this reigon",
    "this place",
    "this plce",
    "this spot",
    "this zone",
    "this area",
    "dis area",
    "dis spot",
    "this arwa",
    "hear",
    "here",
    "this pin on the map",
]


def skeleton(q: str) -> str:
    s = q.lower()
    for filler in FILLERS:
        if s.startswith(filler):
            s = s[len(filler) :]
    for d in sorted(DEICTICS, key=len, reverse=True):
        s = s.replace(d, "{here}")
    s = re.sub(r"\s+", " ", s).strip(" ?")
    return s


def main() -> None:
    skels: dict[str, set[str]] = defaultdict(set)
    with JSONL.open(encoding="utf-8") as f:
        for line in f:
            o = json.loads(line)
            skels[o["category"]].add(skeleton(o["question"]))

    for cat in sorted(skels):
        print(f"=== {cat} ({len(skels[cat])}) ===")
        for s in sorted(skels[cat])[:20]:
            print(f"  {s}")
        if len(skels[cat]) > 20:
            print("  ...")


if __name__ == "__main__":
    main()
