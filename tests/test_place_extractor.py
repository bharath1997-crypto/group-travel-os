"""Rule-based place extraction (no AI model, no network)."""
from __future__ import annotations

import pytest

from app.services import place_extractor as pe


@pytest.mark.parametrize(
    "title,city",
    [
        ("Best cafes in Lisbon (2026)", "Lisbon"),
        ("Top 10 restaurants in New Orleans", "New Orleans"),
        ("24 hours in Tokyo - travel guide", "Tokyo"),
        ("I ate my way through Lisbon | Food Vlog", "Lisbon"),
        ("Things to do in Austin, Texas", "Austin"),
        ("My trip", None),
        ("", None),
    ],
)
def test_city_from_title(title, city):
    assert pe.city_from_title(title) == city


def test_chapters_pins_and_labels_become_places_and_generic_lines_are_dropped():
    desc = (
        "Welcome!\n0:00 Intro\n0:30 Time Out Market\n3:45 - Pastéis de Belém\n"
        "7:10 Cervejaria Ramiro – best seafood in town\n9:00 Outro\n"
        "📍 Topo Chiado\nLocation: Pensão Amor\nSubscribe for more!\n"
    )
    out = pe.extract_from_description("Lisbon food tour", desc)
    assert [p["name"] for p in out] == [
        "Time Out Market", "Pastéis de Belém", "Cervejaria Ramiro", "Topo Chiado", "Pensão Amor",
    ]
    assert {p["city"] for p in out} == {None}  # title has no "in <city>"
    assert pe.extract_from_description("Food in Lisbon", "1:00 Time Out Market")[0]["city"] == "Lisbon"


def test_description_without_chapters_gives_nothing():
    assert pe.extract_from_description("Vlog", "Hi everyone, thanks for watching and subscribe") == []
    assert pe.extract_from_description("", "") == []


LD = (
    '<script type="application/ld+json">{"@type":"ItemList","itemListElement":['
    '{"@type":"ListItem","position":1,"item":{"@type":"Restaurant","name":"Ramiro",'
    '"address":{"addressLocality":"Lisboa","addressCountry":"PT"}}},'
    '{"@type":"ListItem","position":2,"item":{"@type":"CafeOrCoffeeShop","name":"Fabrica Coffee"}},'
    '{"@type":"ListItem","position":3,"item":{"@type":"City","name":"Lisbon"}}]}</script>'
)


def test_json_ld_places_win_over_headings_and_cities_are_not_places():
    html = f"<html><head>{LD}</head><body><h2>1. Not used</h2><h2>2. Also not</h2></body></html>"
    out = pe.extract_from_article(html, "Best cafes in Lisbon")
    assert [p["name"] for p in out] == ["Ramiro", "Fabrica Coffee"]
    assert out[0]["city"] == "Lisboa" and out[0]["country"] == "PT"
    assert out[1]["city"] == "Lisbon"  # from the title when the page has no address


def test_broken_json_ld_is_ignored():
    html = '<script type="application/ld+json">{not json</script><h2>1. Bar Uno</h2><h2>2. Bar Dos</h2>'
    assert [p["name"] for p in pe.extract_from_article(html, "x")] == ["Bar Uno", "Bar Dos"]


def test_numbered_headings_strip_descriptions_and_skip_generic():
    html = (
        "<h1>Best bars in Austin</h1><h2>1. Midnight Cowboy – speakeasy</h2>"
        "<h2>#2 Whisler's</h2><h2>3) Nickel City</h2><h2>FAQ</h2><h2>Where to stay</h2>"
    )
    out = pe.extract_from_article(html, "Best bars in Austin")
    assert [p["name"] for p in out] == ["Midnight Cowboy", "Whisler's", "Nickel City"]
    assert {p["city"] for p in out} == {"Austin"}


def test_plain_headings_only_count_for_listicle_titles():
    heads = "<h2>Time Out Market</h2><h2>Cervejaria Ramiro</h2><h2>Topo Chiado</h2><h2>Final thoughts</h2>"
    assert [p["name"] for p in pe.extract_from_article(heads, "Best food in Lisbon")] == [
        "Time Out Market", "Cervejaria Ramiro", "Topo Chiado",
    ]
    assert pe.extract_from_article(heads, "My diary") == []


def test_sentences_and_junk_are_not_names():
    assert pe._tidy("This is a very long sentence that is obviously not a venue name at all really") is None
    assert pe._tidy("12:30") is None
    assert pe._tidy("Intro") is None and pe._tidy("A") is None
