from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.explore_editorial_inventory import is_generated_explore_event_row

client = TestClient(app)


def test_explore_events_endpoint_ticketmaster(monkeypatch):
    """Verify /api/v1/explore/events returns mocked Ticketmaster rows."""
    mock_event = {
        "id": "e1",
        "title": "Concert",
        "imageUrl": "https://example.com/img.jpg",
        "url": "https://ticketmaster.com/e1",
        "start_date": "2026-06-01",
        "venue": "Grand Hall",
        "category": "Music",
        "sourceType": "ticketmaster",
    }

    monkeypatch.setattr(
        "app.routes.explore.get_ticketmaster_cached",
        lambda db, city, start_date, end_date, lat, lon, radius: [mock_event],
    )

    response = client.get("/api/v1/explore/events?city=Chicago")
    assert response.status_code == 200
    data = response.json()
    assert data["city"] == "Chicago"
    assert len(data["events"]) == 1
    assert data["events"][0]["title"] == "Concert"
    assert data["events"][0]["category"] == "Music"
    assert data["events"][0].get("sourceType") != "ai_fallback"
    assert data["events"][0].get("source") != "ai_fallback"


def test_explore_events_empty_inventory_no_ai_fallback(monkeypatch):
    """Empty provider inventory stays empty; AI seasonal must not run."""
    ai_called = {"value": False}

    async def fail_if_ai_called(city: str):
        ai_called["value"] = True
        return [{"title": "Should not appear"}]

    monkeypatch.setattr(
        "app.routes.explore.get_ticketmaster_cached",
        lambda db, city, start_date, end_date, lat, lon, radius: [],
    )
    monkeypatch.setattr(
        "app.services.explore_city_extended_service.get_ai_seasonal_events",
        fail_if_ai_called,
    )

    response = client.get("/api/v1/explore/events?city=Bali")
    assert response.status_code == 200
    data = response.json()
    assert data["city"] == "Bali"
    assert data["events"] == []
    assert data["total"] == 0
    assert ai_called["value"] is False
    for key in ("trending", "weekend", "popular", "events"):
        for ev in data.get(key) or []:
            assert ev.get("source") != "ai_fallback"
            assert ev.get("sourceType") != "ai_fallback"
            assert ev.get("time") != "12:00"
            assert ev.get("price_min") != 0.0 or ev.get("price_max") != 0.0


def _future_event_day() -> str:
    from datetime import date, timedelta

    return (date.today() + timedelta(days=2)).isoformat()


def _legacy_mixed_events(day: str) -> list[dict]:
    return [
        {
            "id": "tm-real-1",
            "name": "Verified Concert",
            "category": "Music",
            "date": day,
            "venue": "Main Hall",
            "city": "Chicago",
            "image_url": "https://example.com/tm.jpg",
            "ticket_url": "https://ticketmaster.com/tm-real-1",
            "source": "ticketmaster",
        },
        {
            "id": "ai-ev-0",
            "name": "Legacy AI Row",
            "category": "Festival",
            "date": day,
            "venue": "Park",
            "city": "Chicago",
            "image_url": "https://example.com/ai.jpg",
            "ticket_url": "https://example.com/ai",
            "source": "ai_fallback",
            "sourceType": "ai_fallback",
        },
        {
            "id": "editorial-0",
            "name": "Legacy Editorial Row",
            "category": "Festival",
            "date": day,
            "venue": "River",
            "city": "Chicago",
            "image_url": "https://example.com/ed.jpg",
            "ticket_url": "https://example.com/ed",
            "source": "ai_seasonal",
        },
    ]


def test_explore_events_strips_legacy_generated_rows_hub(monkeypatch):
    """Cached/search payloads with ai_fallback rows return verified inventory only."""
    day = _future_event_day()
    mixed = _legacy_mixed_events(day)

    def fake_search(*args, **kwargs):
        return {
            "events": mixed,
            "total": len(mixed),
            "display_city": "Chicago",
            "nearest_metro": None,
            "fetch_mode": "cache",
            "radius_used": 200,
            "nearby_cities": [],
            "freshness": {"refreshed_at": None, "cache_status": "ready"},
        }

    monkeypatch.setattr("app.services.events_service.search_events_extended", fake_search)

    response = client.get("/api/v1/explore/events?city=Chicago")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert len(data["events"]) == 1
    assert data["events"][0]["id"] == "tm-real-1"
    for section in ("trending", "weekend", "popular"):
        for ev in data.get(section) or []:
            assert ev.get("source") != "ai_fallback"
            assert not str(ev.get("id", "")).startswith("ai-ev-")
            assert not str(ev.get("id", "")).startswith("editorial-")


def _verified_event_row(index: int, day: str) -> dict:
    return {
        "id": f"tm-{index}",
        "name": f"Verified {index}",
        "category": "Music",
        "date": day,
        "venue": "Main Hall",
        "city": "Chicago",
        "image_url": "https://example.com/tm.jpg",
        "ticket_url": f"https://ticketmaster.com/tm-{index}",
        "source": "ticketmaster",
    }


def _cache_pagination_fixture(monkeypatch, cached_rows: list[dict]) -> None:
    row_mock = SimpleNamespace(fetched_at=datetime.now(timezone.utc), data=cached_rows)

    monkeypatch.setattr(
        "app.services.events_service._get_fresh_cached_events",
        lambda db, key: list(cached_rows),
    )
    monkeypatch.setattr(
        "app.services.events_service._get_row",
        lambda db, key, ct: row_mock,
    )


def test_generated_predicate_keeps_ticketmaster():
    assert is_generated_explore_event_row({"id": "tm-1", "source": "ticketmaster"}) is False
    assert is_generated_explore_event_row({"id": "tm-1", "source": "eventbrite"}) is False
    assert is_generated_explore_event_row({"id": "ai-ev-1", "source": "ticketmaster"}) is True
    assert is_generated_explore_event_row({"id": "tm-1", "source": "ai_fallback"}) is True
    assert is_generated_explore_event_row({"id": "tm-1", "source": "ai"}) is True


def test_list_mode_pagination_total_45_verified(monkeypatch):
    day = _future_event_day()
    verified = [_verified_event_row(i, day) for i in range(45)]
    generated = [_legacy_mixed_events(day)[1], _legacy_mixed_events(day)[2]]
    cached = generated + verified

    _cache_pagination_fixture(monkeypatch, cached)

    response = client.get("/api/v1/explore/events?city=Chicago&view=list&page=1&per_page=20")
    assert response.status_code == 200
    data = response.json()
    assert len(data["events"]) == 20
    assert data["total"] == 45
    assert all(ev["id"].startswith("tm-") for ev in data["events"])

    page2 = client.get("/api/v1/explore/events?city=Chicago&view=list&page=2&per_page=20")
    assert page2.status_code == 200
    data2 = page2.json()
    assert len(data2["events"]) == 20
    assert data2["total"] == 45


def test_generated_rows_removed_before_pagination(monkeypatch):
    day = _future_event_day()
    verified = [_verified_event_row(i, day) for i in range(25)]
    generated_front = [_legacy_mixed_events(day)[1] for _ in range(10)]
    cached = generated_front + verified

    _cache_pagination_fixture(monkeypatch, cached)

    response = client.get("/api/v1/explore/events?city=Chicago&view=list&page=1&per_page=20")
    data = response.json()
    assert len(data["events"]) == 20
    assert data["total"] == 25
    assert all(ev["source"] == "ticketmaster" for ev in data["events"])


def test_hub_return_all_excludes_generated_with_correct_total(monkeypatch):
    day = _future_event_day()
    verified = [_verified_event_row(i, day) for i in range(8)]
    cached = [_legacy_mixed_events(day)[1], *verified, _legacy_mixed_events(day)[2]]

    _cache_pagination_fixture(monkeypatch, cached)

    response = client.get("/api/v1/explore/events?city=Chicago")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 8
    assert len(data["events"]) == 8
    for key in ("events", "trending", "weekend", "popular"):
        for ev in data.get(key) or []:
            assert not is_generated_explore_event_row(ev)


def test_explore_events_strips_legacy_generated_rows_list_mode(monkeypatch):
    day = _future_event_day()
    mixed = _legacy_mixed_events(day)

    monkeypatch.setattr(
        "app.services.events_service.search_events_extended",
        lambda *args, **kwargs: {
            "events": mixed,
            "total": len(mixed),
            "display_city": "Chicago",
            "nearest_metro": None,
            "fetch_mode": "cache",
            "radius_used": 200,
            "nearby_cities": [],
            "freshness": {"refreshed_at": None, "cache_status": "ready"},
        },
    )

    response = client.get("/api/v1/explore/events?city=Chicago&view=list")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert [ev["id"] for ev in data["events"]] == ["tm-real-1"]


def test_explore_events_empty_via_search_extended(monkeypatch):
    """Non-mocked path returns honest empty totals without AI injection."""
    ai_called = {"value": False}

    async def fail_if_ai_called(city: str):
        ai_called["value"] = True
        return []

    empty_result = {
        "events": [],
        "total": 0,
        "display_city": "Denver",
        "nearest_metro": None,
        "fetch_mode": "cache",
        "radius_used": 200,
        "nearby_cities": [],
        "freshness": {"refreshed_at": None, "cache_status": "empty"},
    }

    monkeypatch.setattr(
        "app.services.events_service.search_events_extended",
        lambda *args, **kwargs: empty_result,
    )
    monkeypatch.setattr(
        "app.services.explore_city_extended_service.get_ai_seasonal_events",
        fail_if_ai_called,
    )

    response = client.get("/api/v1/explore/events?city=Denver")
    assert response.status_code == 200
    data = response.json()
    assert data["events"] == []
    assert data["total"] == 0
    assert ai_called["value"] is False


@pytest.mark.parametrize("event_id", ["mock-12345", "ai-ev-0", "ai-ev-99"])
def test_get_explore_event_detail_unknown_editorial_ids_404(event_id: str):
    """Removed editorial/mock detail stubs must not return bookable-looking rows."""
    response = client.get(f"/api/v1/explore/events/{event_id}")
    assert response.status_code == 404


def test_get_explore_event_detail_unknown_id_404():
    response = client.get("/api/v1/explore/events/unknown-event-id")
    assert response.status_code == 404


def test_get_explore_event_detail_ticketmaster_row():
    """Detail lookup resolves ticketmaster_event rows by event_id."""
    from datetime import date, datetime, timezone
    from sqlalchemy import delete

    from app.models.explore_content import ExploreContent
    from app.utils.database import SessionLocal

    db = SessionLocal()
    try:
        db.execute(delete(ExploreContent).where(ExploreContent.event_id == "tm_detail_test_1"))
        db.commit()

        row = ExploreContent(
            city="Austin",
            content_type="ticketmaster_event",
            data=[],
            fetched_at=datetime.now(timezone.utc),
            event_id="tm_detail_test_1",
            title="Detail Test Concert",
            category="Music",
            venue_name="Moody Theater",
            venue_lat=30.2672,
            venue_lon=-97.7431,
            state="Texas",
            start_date=date(2026, 6, 15),
            start_time="20:00",
            price_min=25.0,
            price_max=75.0,
            image_url="https://example.com/img.jpg",
            ticket_url="https://ticketmaster.com/tm_detail_test_1",
            source="ticketmaster",
        )
        db.add(row)
        db.commit()

        response = client.get("/api/v1/explore/events/tm_detail_test_1")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "tm_detail_test_1"
        assert data["title"] == "Detail Test Concert"
        assert data["venue"] == "Moody Theater"
        assert data["state"] == "Texas"
        assert data["start_date"] == "2026-06-15"
    finally:
        db.execute(delete(ExploreContent).where(ExploreContent.event_id == "tm_detail_test_1"))
        db.commit()
        db.close()


@pytest.mark.anyio
async def test_seasonal_events_ai_editorial_contract(monkeypatch):
    """Editorial endpoint is isolated from verified inventory."""
    async def mock_ai(city: str):
        return [
            {
                "title": "Harvest fair",
                "emoji": "🍂",
                "description": "Seasonal market vibe",
                "location": "Riverfront",
                "time": "Autumn weekends",
            }
        ]

    monkeypatch.setattr(
        "app.services.explore_city_extended_service.get_ai_seasonal_events",
        mock_ai,
    )

    response = client.get("/api/v1/explore/seasonal-events-ai?city=Portland")
    assert response.status_code == 200
    data = response.json()
    assert data["kind"] == "editorial_suggestions"
    assert data["verified_inventory"] is False
    assert "events" not in data
    assert isinstance(data["suggestions"], list)
    assert len(data["suggestions"]) == 1
    suggestion = data["suggestions"][0]
    assert suggestion["title"] == "Harvest fair"
    assert "date" not in suggestion
    assert "ticket_url" not in suggestion
    assert "price_min" not in suggestion
    assert suggestion["id"].startswith("editorial-")


def test_get_similar_explore_events():
    """Similar events match category and city, exclude anchor, sort by rating."""
    from datetime import date, datetime, timedelta, timezone
    from sqlalchemy import delete

    from app.models.explore_content import ExploreContent
    from app.utils.database import SessionLocal

    ids = [
        "tm_similar_anchor",
        "tm_similar_austin_1",
        "tm_similar_austin_2",
        "tm_similar_nyc",
        "tm_similar_other_cat",
    ]
    db = SessionLocal()
    try:
        db.execute(delete(ExploreContent).where(ExploreContent.event_id.in_(ids)))
        db.commit()

        future_date = (datetime.now(timezone.utc) + timedelta(days=1)).date()
        base = dict(
            content_type="ticketmaster_event",
            data=[],
            fetched_at=datetime.now(timezone.utc),
            category="SimilarEventsTestCategory",
            venue_lat=30.2672,
            venue_lon=-97.7431,
            state="Texas",
            start_date=future_date,
            start_time="20:00",
            source="ticketmaster",
        )
        test_city = "SimilarEventsTestCity"
        rows = [
            ExploreContent(
                **base,
                city=test_city,
                event_id="tm_similar_anchor",
                title="Anchor Show",
                venue_name="Moody Theater",
                price_max=120.0,
            ),
            ExploreContent(
                **base,
                city=test_city,
                event_id="tm_similar_austin_1",
                title="Austin Live A",
                venue_name="ACL Live",
                price_max=90.0,
            ),
            ExploreContent(
                **base,
                city=test_city,
                event_id="tm_similar_austin_2",
                title="Austin Live B",
                venue_name="Stubbs",
                price_max=60.0,
            ),
            ExploreContent(
                **{
                    **base,
                    "city": "New York",
                    "event_id": "tm_similar_nyc",
                    "title": "NYC Show",
                    "venue_name": "MSG",
                    "venue_lat": 40.7505,
                    "venue_lon": -73.9934,
                    "state": "New York",
                },
            ),
            ExploreContent(
                **{
                    **base,
                    "city": "Austin",
                    "event_id": "tm_similar_other_cat",
                    "title": "Sports Game",
                    "category": "SimilarEventsOtherCategory",
                    "venue_name": "Stadium",
                },
            ),
        ]
        db.add_all(rows)
        db.commit()

        response = client.get(
            "/api/v1/explore/events/similar/tm_similar_anchor?limit=4"
        )
        assert response.status_code == 200
        data = response.json()
        returned_ids = [ev["id"] for ev in data["events"]]
        assert "tm_similar_anchor" not in returned_ids
        assert "tm_similar_other_cat" not in returned_ids
        assert "tm_similar_nyc" not in returned_ids
        assert "tm_similar_austin_1" in returned_ids
        assert "tm_similar_austin_2" in returned_ids
        assert len(returned_ids) == 2
    finally:
        db.execute(delete(ExploreContent).where(ExploreContent.event_id.in_(ids)))
        db.commit()
        db.close()
