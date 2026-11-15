"""Link reader: SSRF guard, fetch limits, extraction, rate limit and route. No real HTTP."""
from __future__ import annotations

import socket
from unittest.mock import MagicMock, patch
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import link_reader_service as lr
from app.services.link_safety import MAX_BYTES, UnsafeLinkError, assert_public_url, safe_fetch_text
from app.utils.auth import get_current_user

client = TestClient(app)
PUBLIC_IP = "93.184.216.34"


def _addrinfo(*ips):
    return lambda host, port, **kw: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, port)) for ip in ips]


@pytest.fixture(autouse=True)
def _reset():
    lr.reset_state_for_tests()
    yield
    lr.reset_state_for_tests()
    app.dependency_overrides.pop(get_current_user, None)


# ── SSRF guard ────────────────────────────────────────────────────────────────
@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/",
        "http://localhost/admin",
        "http://10.0.0.5/",
        "http://192.168.1.1/",
        "http://172.16.0.9/",
        "http://169.254.169.254/latest/meta-data/",
        "http://100.64.0.1/",
        "http://[::1]/",
        "http://[::ffff:127.0.0.1]/",
        "http://0.0.0.0/",
        "http://printer.local/",
        "ftp://example.com/",
        "file:///etc/passwd",
        "http://user:pw@example.com/",
        "http://example.com:8080/",
        "http://example.com:22/",
        "not a url",
    ],
)
def test_unsafe_urls_are_blocked(url):
    with patch("socket.getaddrinfo", _addrinfo(PUBLIC_IP)):
        with pytest.raises(UnsafeLinkError):
            assert_public_url(url)


def test_host_that_resolves_to_private_address_is_blocked():
    with patch("socket.getaddrinfo", _addrinfo(PUBLIC_IP, "10.1.2.3")):
        with pytest.raises(UnsafeLinkError):
            assert_public_url("https://sneaky.example.com/")


def test_public_url_is_allowed():
    with patch("socket.getaddrinfo", _addrinfo(PUBLIC_IP)):
        assert assert_public_url("https://example.com/a?b=1") == "https://example.com/a?b=1"
        assert assert_public_url(f"http://{PUBLIC_IP}:80/x")


# ── bounded fetch ─────────────────────────────────────────────────────────────
def _client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler), follow_redirects=False)


def test_fetch_returns_text():
    def handler(req):
        return httpx.Response(200, headers={"content-type": "text/html; charset=utf-8"}, text="<p>hi</p>")

    with patch("socket.getaddrinfo", _addrinfo(PUBLIC_IP)):
        final, body = safe_fetch_text("https://example.com/", client=_client(handler))
    assert final == "https://example.com/" and body == "<p>hi</p>"


def test_redirect_to_private_address_is_blocked():
    def handler(req):
        return httpx.Response(302, headers={"location": "http://169.254.169.254/latest/meta-data/"})

    with patch("socket.getaddrinfo", _addrinfo(PUBLIC_IP)):
        with pytest.raises(UnsafeLinkError):
            safe_fetch_text("https://example.com/", client=_client(handler))


def test_too_many_redirects_is_blocked():
    def handler(req):
        return httpx.Response(302, headers={"location": "https://example.com/next"})

    with patch("socket.getaddrinfo", _addrinfo(PUBLIC_IP)):
        with pytest.raises(UnsafeLinkError, match="redirects"):
            safe_fetch_text("https://example.com/", client=_client(handler))


def test_oversized_and_non_html_are_blocked():
    big = httpx.Response(200, headers={"content-type": "text/html"}, content=b"x" * (MAX_BYTES + 10))
    pdf = httpx.Response(200, headers={"content-type": "application/pdf"}, content=b"%PDF")
    with patch("socket.getaddrinfo", _addrinfo(PUBLIC_IP)):
        with pytest.raises(UnsafeLinkError, match="large"):
            safe_fetch_text("https://example.com/", client=_client(lambda r: big))
        with pytest.raises(UnsafeLinkError, match="web page"):
            safe_fetch_text("https://example.com/", client=_client(lambda r: pdf))


def test_http_error_page_is_blocked():
    with patch("socket.getaddrinfo", _addrinfo(PUBLIC_IP)):
        with pytest.raises(UnsafeLinkError):
            safe_fetch_text("https://example.com/", client=_client(lambda r: httpx.Response(404)))


# ── classification and parsing ────────────────────────────────────────────────
def test_platform_and_video_id():
    assert lr.detect_platform("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "youtube"
    assert lr.detect_platform("https://youtu.be/dQw4w9WgXcQ") == "youtube"
    assert lr.detect_platform("https://www.instagram.com/reel/abc/") == "instagram"
    assert lr.detect_platform("https://vm.tiktok.com/xyz") == "tiktok"
    assert lr.detect_platform("https://example.com/top-10") == "article"
    assert lr.detect_platform("https://notyoutube.com/watch?v=dQw4w9WgXcQ") == "article"
    assert lr.youtube_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5") == "dQw4w9WgXcQ"
    assert lr.youtube_video_id("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert lr.youtube_video_id("https://www.youtube.com/shorts/dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert lr.youtube_video_id("https://www.youtube.com/watch?v=short") is None


def test_parse_article_strips_scripts_and_reads_title():
    html = "<html><head><title>Top cafes</title><script>evil()</script></head><body><nav>menu</nav><h2>1. Café A</h2><p>In Lisbon.</p></body></html>"
    title, body = lr.parse_article(html)
    assert title == "Top cafes"
    assert "evil" not in body and "menu" not in body
    assert "Café A" in body and "Lisbon" in body


def test_normalise_dedupes_caps_and_makes_unique_saved_from():
    raw = [{"name": "A", "city": "Lisbon"}, {"name": " a ", "city": "lisbon"}, {"name": ""}, {"name": 5}]
    raw += [{"name": f"P{i}"} for i in range(30)]
    out = lr.normalise_candidates(raw, "https://example.com/x")
    assert len(out) == lr.MAX_CANDIDATES
    assert out[0]["name"] == "A"
    assert len({c["saved_from"] for c in out}) == len(out)
    assert out[0]["saved_from"] == "https://example.com/x#place=a"


# ── read_link ─────────────────────────────────────────────────────────────────
def test_instagram_and_tiktok_are_link_only_and_never_fetched():
    with patch("app.services.link_reader_service.safe_fetch_text") as fetch:
        for url in ("https://www.instagram.com/reel/abc/", "https://www.tiktok.com/@a/video/1"):
            res = lr.read_link(url)
            assert res["link_only"] is True and res["candidates"] == []
            assert "does not read" in res["message"]
        fetch.assert_not_called()


def test_youtube_without_key_is_link_only():
    res = lr.read_link("https://youtu.be/dQw4w9WgXcQ", youtube_key=None)
    assert res["link_only"] is True and res["source_label"] == "YouTube"


def test_youtube_uses_official_api_and_extracts_places():
    api = MagicMock()
    api.raise_for_status.return_value = None
    api.json.return_value = {"items": [{"snippet": {"title": "Food tour in Lisbon", "description": "0:00 Intro\n1:10 Time Out Market\n4:00 Outro"}}]}
    with patch("app.services.link_reader_service.httpx.get", return_value=api) as get:
        res = lr.read_link("https://youtu.be/dQw4w9WgXcQ", youtube_key="k")
    assert get.call_args.args[0] == "https://www.googleapis.com/youtube/v3/videos"
    assert get.call_args.kwargs["params"]["id"] == "dQw4w9WgXcQ"
    assert res["link_only"] is False and res["source_title"] == "Food tour in Lisbon"
    c = res["candidates"][0]
    assert c["name"] == "Time Out Market" and c["city"] == "Lisbon"
    assert c["saved_from"].endswith("#place=time-out-market")
    assert "latitude" not in c and "longitude" not in c  # no venue coordinates


def test_youtube_daily_cap_stops_calls():
    lr._youtube_units[__import__("datetime").datetime.now(__import__("datetime").timezone.utc).strftime("%Y-%m-%d")] = lr.YOUTUBE_DAILY_UNIT_CAP
    with patch("app.services.link_reader_service.httpx.get") as get:
        res = lr.read_link("https://youtu.be/dQw4w9WgXcQ", youtube_key="k")
    get.assert_not_called()
    assert res["link_only"] is True


def test_article_reads_page_and_resolves_city_status():
    html = (
        "<html><title>Best bars in Austin</title><body><h2>1. Bar Uno - cocktails</h2>"
        "<h2>2. Bar Dos</h2><h2>FAQ</h2></body></html>"
    )
    with patch("app.services.link_reader_service.safe_fetch_text", return_value=("https://example.com/a", html)), patch("app.services.link_reader_service._directory_city", side_effect=lambda db, c: ("Austin", "United States") if c == "Austin" else None):
        res = lr.read_link("https://example.com/a")
    assert [c["name"] for c in res["candidates"]] == ["Bar Uno", "Bar Dos"]
    assert [c["match_status"] for c in res["candidates"]] == ["sure", "sure"]
    assert res["candidates"][0]["country"] == "United States"


def test_unreadable_article_and_no_places_fall_back_to_link_only():
    with patch("app.services.link_reader_service.safe_fetch_text", side_effect=UnsafeLinkError("That address is not public.")):
        res = lr.read_link("http://10.0.0.1/")
    assert res["link_only"] is True and "not public" in res["message"]
    with patch("app.services.link_reader_service.safe_fetch_text", return_value=("u", "<p>nothing here</p>")):
        res = lr.read_link("https://example.com/a")
    assert res["link_only"] is True and res["candidates"] == []


# ── rate limit ────────────────────────────────────────────────────────────────
def test_rate_limit_blocks_after_limit_and_resets():
    for i in range(lr.USER_LIMIT):
        assert lr.check_rate_limit("u1", now=1000.0 + i) is None
    wait = lr.check_rate_limit("u1", now=1020.0)
    assert wait is not None and wait > 3000
    assert lr.check_rate_limit("u2", now=1020.0) is None  # per user
    assert lr.check_rate_limit("u1", now=1000.0 + lr.USER_WINDOW_SECONDS + 5) is None


# ── route ─────────────────────────────────────────────────────────────────────
@pytest.fixture
def auth_user():
    user = MagicMock()
    user.id = uuid4()
    app.dependency_overrides[get_current_user] = lambda: user
    yield user


def test_route_requires_auth_and_validates():
    app.dependency_overrides.clear()
    assert client.post("/api/v1/collection/extract-link", json={"url": "https://example.com"}).status_code == 401


def test_route_rejects_bad_url(auth_user):
    assert client.post("/api/v1/collection/extract-link", json={"url": "nope"}).status_code == 422


def test_route_returns_candidates_and_marks_already_saved(auth_user):
    fake = {
        "source_title": "Best bars", "source_label": "example.com", "source_url": "https://example.com/a",
        "link_only": False, "message": "ok",
        "candidates": [
            {"name": "Bar Uno", "city": "Austin", "country": "USA", "category": "Bars", "subcategory": None, "match_status": "sure", "saved_from": "https://example.com/a#place=bar-uno"},
            {"name": "Bar Dos", "city": "Austin", "country": "USA", "category": "Bars", "subcategory": None, "match_status": "sure", "saved_from": "https://example.com/a#place=bar-dos"},
        ],
    }
    have = {"https://example.com/a#place=bar-uno"}
    with patch("app.routes.collection.link_reader_service.read_link", return_value=fake), patch(
        "app.routes.collection.CollectionService.saved_from_keys", return_value=have
    ) as keys:
        res = client.post("/api/v1/collection/extract-link", json={"url": "https://example.com/a"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert [c["already_saved"] for c in body["candidates"]] == [True, False]
    assert keys.call_count == 1  # one lookup for the link and every place
    assert body["link_only"] is False and body["link_saved"] is False


def test_route_rate_limited_with_429(auth_user):
    fake = {"source_title": "t", "source_label": "l", "source_url": "u", "link_only": True, "message": "m", "candidates": []}
    with patch("app.routes.collection.link_reader_service.read_link", return_value=fake), patch(
        "app.routes.collection.CollectionService.saved_from_keys", return_value=set()
    ):
        codes = [client.post("/api/v1/collection/extract-link", json={"url": "https://example.com/a"}).status_code for _ in range(lr.USER_LIMIT + 1)]
    assert codes[: lr.USER_LIMIT] == [200] * lr.USER_LIMIT and codes[-1] == 429


def test_place_slug_keeps_accented_names_distinct_and_stable():
    assert lr.place_slug("Pastéis de Belém") == "pasteis-de-belem"
    assert lr.place_slug("Café A") == "cafe-a"
    a, b = lr.place_slug("東京タワー"), lr.place_slug("大阪城")
    assert a != b and a == lr.place_slug("東京タワー")  # no ascii left: stable, distinct hash


def test_sites_that_refuse_us_get_a_clear_message():
    for code in (401, 403, 429):
        with patch("socket.getaddrinfo", _addrinfo(PUBLIC_IP)):
            with pytest.raises(UnsafeLinkError, match="does not allow Rovvy"):
                safe_fetch_text("https://example.com/", client=_client(lambda r, c=code: httpx.Response(c)))


def test_slow_site_is_cut_off_by_hard_wall_clock_limit(monkeypatch):
    import time

    import app.services.link_safety as ls

    monkeypatch.setattr(ls, "TOTAL_TIMEOUT_SECONDS", 0.2)
    monkeypatch.setattr(ls, "_fetch_text", lambda url, client=None: time.sleep(5))
    start = time.monotonic()
    with pytest.raises(UnsafeLinkError, match="too long"):
        ls.safe_fetch_text("https://example.com/")
    assert time.monotonic() - start < 3
