from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services.place_name_transliteration import transliterate_to_latin
from app.services.place_name_translation_service import (
    clear_place_name_translation_cache_for_tests,
    detect_source_language,
)

client = TestClient(app)


def setup_function() -> None:
    clear_place_name_translation_cache_for_tests()


def test_detect_source_language_cyrillic_russia():
    detected = detect_source_language("Обход п. Октябрьский", "Russia")
    assert detected == ("ru", "Russian")


def test_detect_source_language_english_skips():
    assert detect_source_language("Starbucks Reserve", "United States") is None


def test_transliterate_cyrillic_preserves_name_not_meaning():
    latin = transliterate_to_latin("Обход п. Октябрьский")
    assert latin is not None
    assert latin.startswith("Obkhod")
    assert "Oktyabr" in latin
    assert "Bypass" not in latin


def test_display_name_endpoint_latin_name_no_conversion():
    res = client.get(
        "/api/v1/geocoding/display-name",
        params={
            "name": "Central Park",
            "lat": 40.78,
            "lng": -73.97,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["displayName"] == "Central Park"
    assert body["translated"] is False
    assert body["sourceLanguageLabel"] is None


def test_display_name_endpoint_transliterates_cyrillic():
    res = client.get(
        "/api/v1/geocoding/display-name",
        params={
            "name": "Обход п. Октябрьский",
            "lat": 55.61,
            "lng": 38.0,
            "country": "Russia",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["translated"] is True
    assert body["displayName"].startswith("Obkhod")
    assert "Oktyabr" in body["displayName"]
    assert body["originalName"] == "Обход п. Октябрьский"
    assert body["sourceLanguageLabel"] == "Russian"
