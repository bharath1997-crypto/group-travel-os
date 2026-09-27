from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.place_spine import PlaceSpineDetail
from app.services.place_spine_service import PlaceSpineService

client = TestClient(app)


def test_get_place_spine_success():
    mock_detail = PlaceSpineDetail(
        gers_id="08f2664a1c2b3d4e5f6789012345678",
        name="The Hidden Room",
        category="cocktail_bar",
        category_label="Cocktail Bar",
        lat=41.8892,
        lon=-87.6345,
        address="1427 N Milwaukee Ave",
        depth_tier=0,
    )

    with patch.object(PlaceSpineService, "get_by_gers_id", return_value=mock_detail):
        res = client.get("/api/v1/places/spine/08f2664a1c2b3d4e5f6789012345678")
        assert res.status_code == 200
        body = res.json()
        assert body["gers_id"] == mock_detail.gers_id
        assert body["name"] == "The Hidden Room"
        assert body["category_label"] == "Cocktail Bar"


def test_get_place_spine_not_found():
    with patch.object(PlaceSpineService, "get_by_gers_id") as mock_get:
        from app.utils.exceptions import AppException

        def _raise(*_args, **_kwargs):
            AppException.not_found("Place not found")

        mock_get.side_effect = _raise
        res = client.get("/api/v1/places/spine/08f2664a1c2b3d4e5f6789012345678")
        assert res.status_code == 404


def test_get_place_spine_invalid_gers_id():
    res = client.get("/api/v1/places/spine/not-a-valid-id")
    assert res.status_code == 400


def test_place_spine_service_invalid_gers_id():
    db = MagicMock()
    with pytest.raises(Exception) as exc:
        PlaceSpineService.get_by_gers_id(db, "bad id!")
    assert exc.value.status_code == 400


def test_get_place_spine_near_success():
    mock_detail = PlaceSpineDetail(
        gers_id="08f2664a1c2b3d4e5f6789012345678",
        name="Near Me Bar",
        category="bar",
        category_label="Bar",
        lat=41.8892,
        lon=-87.6345,
        address="1427 N Milwaukee Ave",
        depth_tier=1,
    )

    with patch.object(PlaceSpineService, "get_nearest", return_value=mock_detail):
        res = client.get(
            "/api/v1/places/spine/near",
            params={"lat": 41.8892, "lng": -87.6345, "radius_meters": 50},
        )
        assert res.status_code == 200
        assert res.json()["name"] == "Near Me Bar"


def test_get_place_spine_near_not_found():
    with patch.object(PlaceSpineService, "get_nearest") as mock_get:
        from app.utils.exceptions import AppException

        def _raise(*_args, **_kwargs):
            AppException.not_found("Place not found")

        mock_get.side_effect = _raise
        res = client.get(
            "/api/v1/places/spine/near",
            params={"lat": 0.0, "lng": 0.0},
        )
        assert res.status_code == 404


def test_get_place_spine_near_validation():
    res = client.get(
        "/api/v1/places/spine/near",
        params={"lat": 999, "lng": 0},
    )
    assert res.status_code == 422
