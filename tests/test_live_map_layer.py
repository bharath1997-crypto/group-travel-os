from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.mark.asyncio
async def test_live_layer_endpoint_returns_points():
    mock_points = [
        {
            "name": "Test Park",
            "category": "Park",
            "lat": 41.88,
            "lng": -87.63,
            "osmType": "node",
            "osmId": "1",
        }
    ]
    with patch(
        "app.routes.live_map_layer.LiveMapLayerService.fetch_layer_points",
        new=AsyncMock(return_value=(mock_points, False, None)),
    ):
        res = client.get(
            "/api/v1/live/layer",
            params={"south": 41.87, "west": -87.64, "north": 41.89, "east": -87.62},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["points"][0]["name"] == "Test Park"
        assert res.headers.get("cache-control") == "public, max-age=604800"


def test_balance_layer_pois_limits_single_category_flood():
    from app.services.live_map_layer_service import _balance_layer_pois

    parks = [
        {"name": f"Park {i}", "category": "Park", "osmType": "node", "osmId": str(i), "tags": {"leisure": "park"}}
        for i in range(80)
    ]
    capitals = [
        {
            "name": "Ottawa",
            "category": "National capital",
            "osmType": "node",
            "osmId": "cap",
            "tags": {"capital": "yes"},
        }
    ]
    cat_list = ("parks", "capitals")
    balanced = _balance_layer_pois([*parks, *capitals], cat_list, max_total=40)
    assert any(p["name"] == "Ottawa" for p in balanced)
    park_count = sum(1 for p in balanced if p["category"] == "Park")
    assert park_count <= 22


def test_live_layer_invalid_bbox():
    res = client.get(
        "/api/v1/live/layer",
        params={"south": 42.0, "west": -87.64, "north": 41.89, "east": -87.62},
    )
    assert res.status_code == 400
