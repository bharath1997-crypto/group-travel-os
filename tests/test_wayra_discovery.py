"""Discovery routing tests against wyra_discovery_questions.jsonl."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.services.wayra_discovery import classify_discovery_expects
from app.services.wayra_intent import (
    WayraMode,
    classify_mode,
    is_live_map_identity_question,
    is_live_place_deep_question,
    resolve_app_intent,
)

ROOT = Path(__file__).resolve().parents[1]
JSONL = ROOT / "wyra" / "wayra_discovery_questions.jsonl"


def _load_rows() -> list[dict]:
    rows: list[dict] = []
    with JSONL.open(encoding="utf-8") as f:
        for line in f:
            if line.strip():
                rows.append(json.loads(line))
    return rows


class TestDiscoveryRoutingSamples:
    def test_identity_local(self) -> None:
        assert classify_discovery_expects("ok so Where exactly is this plce?") == "local"
        assert is_live_map_identity_question("What's the name of around here?") is True

    def test_special_goes_llm(self) -> None:
        assert classify_discovery_expects("What is the special out there?") == "llm"
        assert is_live_place_deep_question("Anything fun around here?") is True

    def test_app_guide_live_work(self) -> None:
        q = "one more thing, i'd like to know how does Live work?"
        assert classify_discovery_expects(q) == "app_guide"
        assert classify_mode(q) == WayraMode.APP_GUIDE
        assert resolve_app_intent(q) is not None

    def test_place_name_ui_chips_route_to_llm(self) -> None:
        assert classify_discovery_expects("What's at Kitikmeot Region?") == "llm"
        assert classify_discovery_expects("What's at Paris?") == "llm"
        assert classify_discovery_expects("How far is this from me?") == "llm"
        assert classify_discovery_expects("Is this family friendly?") == "llm"
        assert classify_discovery_expects("Is Chicago family friendly?") == "llm"
        assert classify_mode("What's at Kitikmeot Region?") == WayraMode.TRAVEL
        assert classify_mode("How far is this from me?") == WayraMode.TRAVEL
        assert classify_mode("Is this family friendly?") == WayraMode.TRAVEL
        assert is_live_place_deep_question("What's at Kitikmeot Region?") is True


def test_jsonl_expects_all_rows() -> None:
    rows = _load_rows()
    misses: list[str] = []

    for row in rows:
        expected = row["expects"]
        question = row["question"]

        if expected == "local":
            ok = is_live_map_identity_question(question)
        elif expected == "llm":
            ok = is_live_place_deep_question(question) and classify_mode(question) == WayraMode.TRAVEL
        else:
            ok = classify_mode(question) == WayraMode.APP_GUIDE

        if not ok:
            misses.append(row["id"])

    assert misses == [], f"{len(misses)} discovery routing misses: {misses[:10]}"
