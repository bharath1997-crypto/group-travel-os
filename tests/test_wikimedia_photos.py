"""Parsing rules for scripts/07_enrich_wikimedia_photos.py (no network)."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

_PATH = Path(__file__).resolve().parents[1] / "scripts" / "07_enrich_wikimedia_photos.py"
_spec = importlib.util.spec_from_file_location("wikimedia_photos", _PATH)
assert _spec and _spec.loader
wm = importlib.util.module_from_spec(_spec)
sys.modules["wikimedia_photos"] = wm
_spec.loader.exec_module(wm)


def _claim(value: str, rank: str = "normal") -> dict:
    return {"rank": rank, "mainsnak": {"datavalue": {"value": value}}}


def test_p18_first_non_deprecated_image() -> None:
    entity = {"claims": {"P18": [_claim("Old.jpg", "deprecated"), _claim("Pritzker Park.jpg")]}}
    assert wm.p18_filename(entity) == "Pritzker Park.jpg"
    assert wm.p18_filename({"claims": {}}) is None


def test_only_free_licenses_are_kept() -> None:
    for name in ("CC BY-SA 4.0", "CC BY 2.0", "CC0", "Public domain", "PD-US"):
        assert wm.is_free_license(name), name
    for name in (None, "", "Fair use", "All rights reserved", "CC BY-NC 2.0", "CC BY-NC-SA 4.0", "CC BY-ND 4.0"):
        assert not wm.is_free_license(name), name


def test_credit_cleanup_strips_html_and_uploader_boilerplate() -> None:
    assert wm.clean_author('<a href="//commons.wikimedia.org/wiki/User:Mahir256">Mahir256</a>') == "Mahir256"
    assert (
        wm.clean_author("kimberlyhobart at English Wikipedia . The original uploader was kimberlyhobart at English Wikipedia .")
        == "kimberlyhobart at English Wikipedia"
    )
    assert wm.clean_author("") is None


def test_photo_from_imageinfo_maps_thumb_author_license() -> None:
    page = {
        "title": "File:Pritzker Park.jpg",
        "imageinfo": [
            {
                "url": "https://upload.wikimedia.org/wikipedia/commons/a/ab/Pritzker_Park.jpg",
                "thumburl": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Pritzker_Park.jpg/1024px-Pritzker_Park.jpg",
                "extmetadata": {
                    "Artist": {"value": "<span>Mahir256</span>"},
                    "LicenseShortName": {"value": "CC BY-SA 3.0"},
                },
            }
        ],
    }
    photo = wm.photo_from_imageinfo(page)
    assert photo is not None
    assert photo.filename == "Pritzker Park.jpg"
    assert photo.thumbnail_url.endswith("1024px-Pritzker_Park.jpg")
    assert photo.attribution == "Mahir256 · Wikimedia Commons"
    assert photo.license == "CC BY-SA 3.0"


def test_non_free_or_missing_info_is_skipped() -> None:
    nonfree = {"title": "File:x.jpg", "imageinfo": [{"url": "u", "extmetadata": {"LicenseShortName": {"value": "Fair use"}}}]}
    assert wm.photo_from_imageinfo(nonfree) is None
    assert wm.photo_from_imageinfo({"title": "File:missing.jpg"}) is None
