from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.collection_item import CollectionItem
from app.utils.auth import get_current_user

client = TestClient(app)


@pytest.fixture
def auth_user():
    user = MagicMock()
    user.id = uuid4()
    app.dependency_overrides[get_current_user] = lambda: user
    yield user
    app.dependency_overrides.pop(get_current_user, None)


def test_list_collection_items_requires_auth():
    app.dependency_overrides.clear()
    res = client.get("/api/v1/collection/items")
    assert res.status_code == 401


def test_create_collection_item_validation_error(auth_user):
    res = client.post(
        "/api/v1/collection/items",
        json={"name": ""},
    )
    assert res.status_code == 422


def test_create_and_list_collection_items(auth_user):
    item_id = uuid4()
    now = datetime.now(timezone.utc)
    mock_item = CollectionItem(
        id=item_id,
        user_id=auth_user.id,
        collection_id=None,
        name="The Green Mill",
        latitude=None,
        longitude=None,
        city="Chicago",
        country="USA",
        category="Live music",
        subcategory="Jazz club",
        source="Reel",
        saved_from="Instagram reel — @chicagonights",
        note=None,
        stars=5,
        match_status="sure",
        is_unsorted=False,
        created_at=now,
        updated_at=now,
    )

    with patch("app.routes.collection.CollectionService.create_item", return_value=mock_item):
        create = client.post(
            "/api/v1/collection/items",
            json={
                "name": "The Green Mill",
                "city": "Chicago",
                "country": "USA",
                "category": "Live music",
                "subcategory": "Jazz club",
                "source": "Reel",
                "saved_from": "Instagram reel — @chicagonights",
                "stars": 5,
            },
        )
    assert create.status_code == 201
    body = create.json()
    assert body["name"] == "The Green Mill"
    assert body["city"] == "Chicago"

    with patch(
        "app.routes.collection.CollectionService.list_items",
        side_effect=[[mock_item], [mock_item]],
    ), patch(
        "app.routes.collection.CollectionService.unsorted_count",
        return_value=0,
    ), patch(
        "app.routes.collection.CollectionService.filter_facets",
        return_value={"countries": ["USA"], "cities": ["Chicago"], "categories": ["Live music"]},
    ), patch(
        "app.routes.collection.CollectionService.city_counts",
        return_value={"Chicago": 1},
    ):
        listed = client.get("/api/v1/collection/items")
    assert listed.status_code == 200
    payload = listed.json()
    assert payload["total_count"] == 1
    assert len(payload["items"]) == 1
    assert payload["facets"]["cities"] == ["Chicago"]


def test_extract_link_validation_error(auth_user):
    res = client.post(
        "/api/v1/collection/extract-link",
        json={"url": "not-a-url"},
    )
    assert res.status_code == 422


def test_extract_link_success(auth_user):
    res = client.post(
        "/api/v1/collection/extract-link",
        json={"url": "https://www.instagram.com/reel/example"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["source_label"] == "Instagram"
    assert isinstance(body["candidates"], list)
