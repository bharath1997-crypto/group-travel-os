from __future__ import annotations

import json
from unittest.mock import MagicMock, AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

@pytest.mark.asyncio
async def test_extract_returns_location_for_youtube_url(monkeypatch):
    # Mock yt-dlp metadata extraction
    mock_info = {
        "title": "Exploring Paris",
        "description": "Visited the Eiffel Tower today, it was amazing!",
        "tags": ["travel", "paris"],
        "location": "Paris, France",
        "thumbnail": "https://example.com/thumb.jpg"
    }
    
    def fake_extract_info(self, url, download=False):
        return mock_info

    monkeypatch.setattr("yt_dlp.YoutubeDL.extract_info", fake_extract_info)

    # Mock Gemini call
    class FakeAwaitableString(str):
        def __await__(self):
            async def _val():
                return '{"place_name": "Eiffel Tower", "city": "Paris", "country": "France"}'
            return _val().__await__()

    monkeypatch.setattr(
        "app.routes.video_extract.generate_gemini_content",
        lambda prompt: FakeAwaitableString()
    )

    # Mock Geocoding request
    mock_nominatim_resp = MagicMock()
    mock_nominatim_resp.status_code = 200
    mock_nominatim_resp.json.return_value = [
        {
            "lat": "48.8584",
            "lon": "2.2945",
            "address": {
                "city": "Paris",
                "country": "France"
            }
        }
    ]

    async def fake_get(*args, **kwargs):
        return mock_nominatim_resp

    monkeypatch.setattr("httpx.AsyncClient.get", fake_get)

    r = client.post(
        "/api/v1/cart/extract-from-url",
        json={"url": "https://www.youtube.com/watch?v=12345"}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["extracted_place"] == "Eiffel Tower"
    assert body["city"] == "Paris"
    assert body["country"] == "France"
    assert body["lat"] == 48.8584
    assert body["lng"] == 2.2945
    assert body["confidence"] == "high"

@pytest.mark.asyncio
async def test_extract_handles_invalid_url_gracefully(monkeypatch):
    # Mock yt-dlp exception
    def fake_extract_info_err(self, url, download=False):
        raise Exception("Download failed")

    monkeypatch.setattr("yt_dlp.YoutubeDL.extract_info", fake_extract_info_err)

    # Mock Gemini call to return nulls
    class FakeAwaitableString(str):
        def __await__(self):
            async def _val():
                return '{"place_name": null, "city": null, "country": null}'
            return _val().__await__()

    monkeypatch.setattr(
        "app.routes.video_extract.generate_gemini_content",
        lambda prompt: FakeAwaitableString()
    )

    r = client.post(
        "/api/v1/cart/extract-from-url",
        json={"url": "https://invalid.com/video"}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["extracted_place"] is None
    assert body["city"] is None
    assert body["lat"] == 0.0
    assert body["lng"] == 0.0
    assert body["confidence"] == "low"

def test_google_maps_url_parsed_correctly(monkeypatch):
    # Mock direct parsing of google maps url
    # Ensure redirect follow returns redirect URL
    mock_head = MagicMock()
    mock_head.url = "https://www.google.com/maps/place/Eiffel+Tower/@48.85837,2.2944813,17z/data=..."
    monkeypatch.setattr("requests.head", lambda *args, **kwargs: mock_head)

    # Mock Geocoding request for map place search
    mock_nominatim_resp = MagicMock()
    mock_nominatim_resp.status_code = 200
    mock_nominatim_resp.json.return_value = [
        {
            "lat": "48.85837",
            "lon": "2.2944813",
            "address": {
                "city": "Paris",
                "country": "France"
            }
        }
    ]

    async def fake_get(*args, **kwargs):
        return mock_nominatim_resp

    monkeypatch.setattr("httpx.AsyncClient.get", fake_get)

    r = client.post(
        "/api/v1/cart/extract-from-url",
        json={"url": "https://maps.app.goo.gl/xyz"}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["extracted_place"] == "Eiffel Tower"
    assert body["lat"] == 48.85837
    assert body["lng"] == 2.2944813
    assert body["confidence"] == "high"
    assert body["platform"] == "google_maps"
