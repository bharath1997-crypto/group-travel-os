"""Unit tests for Wikidata enrichment matching helpers."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _load_module():
    spec = importlib.util.spec_from_file_location(
        "enrich_wikidata",
        ROOT / "scripts" / "05_enrich_wikidata.py",
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load 05_enrich_wikidata.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_normalize_name_strips_the_and_suffix():
    mod = _load_module()
    assert mod.normalize_name("The Violet Hour Restaurant") == "violet hour"
    assert mod.normalize_name("Lou Malnati's Pizzeria") == "lou malnati s pizzeria"


def test_name_score_accepts_close_names():
    mod = _load_module()
    score = mod.name_score("The Violet Hour", "Violet Hour")
    assert score >= 85.0


def test_match_requires_single_candidate():
    mod = _load_module()
    entity = mod.WikidataEntity(
        qid="Q123",
        name="The Violet Hour",
        lon=-87.6779,
        lat=41.9086,
        instagram="theviolethour",
        website="https://theviolethour.com",
        description="Cocktail bar",
    )
    good = mod.PlaceRow(
        gers_id="a",
        name="Violet Hour",
        lon=-87.677905,
        lat=41.908609,
        instagram=None,
        website=None,
        wikidata_qid=None,
        depth_tier=0,
    )
    near_other = mod.PlaceRow(
        gers_id="b",
        name="The Violet Hour Bar",
        lon=-87.67795,
        lat=41.90865,
        instagram=None,
        website=None,
        wikidata_qid=None,
        depth_tier=0,
    )
    far = mod.PlaceRow(
        gers_id="c",
        name="Violet Hour",
        lon=-87.90,
        lat=41.75,
        instagram=None,
        website=None,
        wikidata_qid=None,
        depth_tier=0,
    )

    matches, stats = mod.match_entities([entity], [good], used_qids=set())
    assert len(matches) == 1
    assert stats.matched == 1

    matches_amb, stats_amb = mod.match_entities(
        [entity], [good, near_other], used_qids=set()
    )
    assert len(matches_amb) == 0
    assert stats_amb.ambiguous == 1

    matches_far, stats_far = mod.match_entities([entity], [far], used_qids=set())
    assert len(matches_far) == 0
    assert stats_far.matched == 0


def test_depth_tier_2_place_not_matched():
    mod = _load_module()
    entity = mod.WikidataEntity(
        qid="Q999",
        name="Hand Curated Bar",
        lon=-87.0,
        lat=41.0,
        instagram=None,
        website=None,
        description=None,
    )
    place = mod.PlaceRow(
        gers_id="x",
        name="Hand Curated Bar",
        lon=-87.0,
        lat=41.0,
        instagram="@handle",
        website="https://example.com",
        wikidata_qid=None,
        depth_tier=2,
    )
    matches, stats = mod.match_entities([entity], [place], used_qids=set())
    assert matches == []
    assert stats.matched == 0
