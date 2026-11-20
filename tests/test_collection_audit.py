"""
Collection bug audit (2026-11-15): one regression test per proven bug that was fixed.
IDs match the Bug Register sheet in Scram Book/Collection Tab. SQLite in memory, no network.
"""
from __future__ import annotations

import uuid
from unittest.mock import patch

import pytest

from app.services import link_reader_service as lr
from app.services import place_extractor as pe
from app.services.collection_service import normalise_tags
from tests.test_collection_tags_share import API, _save, env  # noqa: F401  (env is a fixture)


# ── API / service ─────────────────────────────────────────────────────────────
def test_b01_b02_blank_name_is_rejected(env):
    client, *_ = env
    assert client.post(f"{API}/items", json={"name": "   "}).status_code == 400
    item = _save(client, name="Real")
    assert client.patch(f"{API}/items/{item['id']}", json={"name": "   "}).status_code == 400
    assert client.get(f"{API}/items").json()["items"][0]["name"] == "Real"


def test_b03_blank_collection_name_is_rejected_and_same_name_is_reused(env):
    client, *_ = env
    assert client.post(f"{API}/collections", json={"name": "  "}).status_code == 400
    a = client.post(f"{API}/collections", json={"name": "Dates"}).json()
    b = client.post(f"{API}/collections", json={"name": " dates "}).json()
    assert a["id"] == b["id"]


def test_b04_collection_group_must_be_one_you_belong_to(env):
    client, session, *_ = env
    from app.models.group import GroupMember
    from app.utils.database import Base
    Base.metadata.create_all(session.get_bind(), tables=[GroupMember.__table__])
    assert client.post(f"{API}/collections", json={"name": "G", "group_id": str(uuid.uuid4())}).status_code == 403


def test_b06_coordinates_must_be_real(env):
    client, *_ = env
    assert client.post(f"{API}/items", json={"name": "Geo", "latitude": 999, "longitude": 10}).status_code == 422
    assert client.post(f"{API}/items", json={"name": "Geo", "latitude": 10, "longitude": -181}).status_code == 422
    assert client.post(f"{API}/items", json={"name": "Geo", "latitude": 38.7, "longitude": -9.1}).status_code == 201


def test_b07_blank_note_is_stored_as_none(env):
    client, *_ = env
    assert _save(client, note="   ")["note"] is None


def test_b11_user_cannot_forge_a_share_key(env):
    client, *_ = env
    res = client.post(f"{API}/items", json={"name": "X", "saved_from": "share:abc:def"})
    assert res.status_code == 400


def test_b16_hash_inside_a_tag_is_kept():
    assert normalise_tags(["c#", "#Food", "f #sharp"]) == ["c#", "food", "f sharp"]


def test_b15_a_bare_string_is_split_on_commas_not_characters():
    assert normalise_tags("date night, rainy") == ["date night", "rainy"]  # type: ignore[arg-type]


def test_b18_saving_a_known_link_again_merges_tags_in_the_order_given(env):
    client, *_ = env
    a = _save(client, name="L", saved_from="https://x.test/p", tags=["zebra"])
    b = client.post(f"{API}/items", json={"name": "L", "saved_from": "https://x.test/p", "tags": ["apple"]}).json()
    assert a["id"] == b["id"]
    assert b["tags"] == ["zebra", "apple"]


def test_b14_list_filters_still_work_with_one_query(env):
    client, *_ = env
    _save(client, name="A", city="Lisbon", tags=["kids"])
    _save(client, name="B", city="Porto")
    data = client.get(f"{API}/items?city=Lisbon&tag=KIDS").json()
    assert [i["name"] for i in data["items"]] == ["A"]
    assert data["total_count"] == 2  # counts and facets still cover everything you saved


def test_b12_extract_link_releases_the_db_before_reading(env):
    client, session, *_ = env
    order: list[str] = []
    real_rollback = session.rollback
    session.rollback = lambda: (order.append("rollback"), real_rollback())[1]  # type: ignore[method-assign]
    with patch.object(
        lr, "read_link",
        side_effect=lambda *a, **k: order.append("read") or {
            "source_title": "t", "source_label": "x", "candidates": [], "link_only": True,
        },
    ):
        res = client.post(f"{API}/extract-link", json={"url": "https://example.com/a"})
    assert res.status_code == 200
    assert order == ["rollback", "read"]


# ── link reader ───────────────────────────────────────────────────────────────
def test_b23_look_alike_domains_are_not_instagram_or_tiktok():
    assert lr.detect_platform("https://notinstagram.com/x") == "article"
    assert lr.detect_platform("https://nottiktok.com/x") == "article"
    assert lr.detect_platform("https://www.instagram.com/reel/abc/") == "instagram"
    assert lr.detect_platform("https://vm.tiktok.com/abc") == "tiktok"


def test_b25_long_links_keep_the_place_part_of_the_key():
    base = "https://example.com/" + "a" * 520
    k1, k2 = lr.candidate_saved_from(base, "Cafe Uno"), lr.candidate_saved_from(base, "Bar Dos")
    assert len(k1) <= 500 and k1 != k2
    assert k1.endswith("#place=cafe-uno")


# ── extractor ─────────────────────────────────────────────────────────────────
@pytest.mark.parametrize(
    "name",
    ["Introspect Bar", "Tipsy Bar", "Welcome Inn", "Day 1 Cafe", "Final Straw", "Shared Table", "Budget Inn",
     "Why Not Cafe", "What the Fork", "My Place", "Our Lady of the Rosary", "Aboutique", "Recapitulation", "Faq Bar"],
)
def test_b26_real_venue_names_are_not_dropped_as_headings(name):
    assert pe._tidy(name) == name


@pytest.mark.parametrize("name", ["Intro", "Introduction", "Day 2: Pisa", "Final thoughts", "Where to stay", "Comments (4)", "Leave a Comment"])
def test_b26_b29_page_furniture_is_still_dropped(name):
    assert pe._tidy(name) is None


def test_b26_json_ld_names_are_trusted():
    html = '<script type="application/ld+json">{"@type":"Restaurant","name":"Why Not Cafe"}</script>'
    assert [p["name"] for p in pe.extract_from_json_ld(html)] == ["Why Not Cafe"]


def test_b27_headings_in_footer_and_sidebar_are_ignored():
    html = "<h2>1. Real Cafe</h2><h2>2. Real Bar</h2><footer><h3>1. Newsletter</h3></footer><aside><h3>3. Ad</h3></aside>"
    assert [p["name"] for p in pe.extract_from_headings(html, "x")] == ["Real Cafe", "Real Bar"]


def test_b28_a_guide_title_alone_does_not_turn_every_heading_into_a_place():
    html = "<h2>Getting Started</h2><h2>Pricing</h2><h2>Features</h2><h2>Contact Sales</h2><h2>Our Team</h2>"
    assert pe.extract_from_article(html, "The Ultimate Guide to Widgets") == []


def test_b29_comment_headings_are_not_places():
    html = "<h2>Hotel Rosa</h2><h2>Cafe Uno</h2><h2>Bar Dos</h2><h2>Pasta</h2><h2>Comments (4)</h2><h2>Leave a Comment</h2>"
    assert [p["name"] for p in pe.extract_from_headings(html, "Best bars in Rome")] == ["Hotel Rosa", "Cafe Uno", "Bar Dos", "Pasta"]


def test_b30_city_is_not_taken_from_of_or_from():
    assert pe.city_from_title("I Went From Zero to Hero") != "Zero"
    assert pe.city_from_title("Best cafes in Lisbon (2026)") == "Lisbon"


def test_b34_html_entities_in_json_ld_names_are_decoded():
    html = '<script type="application/ld+json">{"@type":"Restaurant","name":"Caf&eacute; Uno"}</script>'
    assert pe.extract_from_json_ld(html)[0]["name"] == "Café Uno"


def test_b35_times_of_day_and_addresses_are_not_chapters_or_pins():
    rows = pe.extract_from_description("Rome tour", "5:00 PM Dinner\n1:02:03 Colosseum\n📍 Via Roma 12, 00100 Rome\n📍 Forno Campo de' Fiori")
    assert [r["name"] for r in rows] == ["Colosseum", "Forno Campo de' Fiori"]
