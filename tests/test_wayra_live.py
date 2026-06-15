"""
Unit tests for Wayra Live endpoints.
"""
from __future__ import annotations

import uuid
import time
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.group import GroupMember, MemberRole
from app.models.trip import Trip
from app.utils.auth import get_current_user
from app.utils.database import get_db
from tests.conftest import exec_result

client = TestClient(app)


def _mock_user() -> MagicMock:
    user = MagicMock()
    user.id = uuid.UUID("00000000-0000-0000-0000-000000000033")
    user.email = "wayratest@example.com"
    user.full_name = "Wayra Tester"
    user.is_active = True
    return user


@pytest.fixture
def auth_header(db) -> dict[str, str]:
    app.dependency_overrides[get_current_user] = _mock_user
    app.dependency_overrides[get_db] = lambda: db
    yield {}
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_db, None)


def test_live_context_returns_alert_or_null(db, auth_header):
    trip_id = uuid.uuid4()
    group_id = uuid.uuid4()
    
    trip = Trip(id=trip_id, group_id=group_id, title="Test Trip", created_by=_mock_user().id)
    member = GroupMember(group_id=group_id, user_id=_mock_user().id, role=MemberRole.admin)
    
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),    # Trip query in _verify_membership
        exec_result(scalar_one_or_none=member),  # Member query in _verify_membership
        exec_result(scalar_one_or_none=None),    # Query TripPlan in router
    ]

    with patch("app.utils.firebase.get_rtdb", return_value={}), \
         patch("app.services.wayra_service._gemini_key", return_value="fake_key"), \
         patch("httpx.Client.post") as mock_post:
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [{"text": "Alert: Group member delayed by 5 mins"}]
                    }
                }
            ]
        }
        mock_post.return_value = mock_response

        from app.routers.explorer import _live_context_cache
        _live_context_cache.clear()

        res = client.get(f"/api/v1/wayra/live-context/{trip_id}")
        assert res.status_code == 200
        assert res.json() == {"alert": "Alert: Group member delayed by 5 mins"}


def test_live_context_cached_60_seconds(db, auth_header):
    trip_id = uuid.uuid4()
    group_id = uuid.uuid4()
    
    from app.routers.explorer import _live_context_cache
    _live_context_cache[trip_id] = (time.time(), "Cached Alert Message")

    trip = Trip(id=trip_id, group_id=group_id, title="Test Trip", created_by=_mock_user().id)
    member = GroupMember(group_id=group_id, user_id=_mock_user().id, role=MemberRole.admin)
    
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),    # Trip query in _verify_membership
        exec_result(scalar_one_or_none=member),  # Member query in _verify_membership
    ]

    res = client.get(f"/api/v1/wayra/live-context/{trip_id}")
    assert res.status_code == 200
    assert res.json() == {"alert": "Cached Alert Message"}


def test_nearby_returns_two_picks(db, auth_header):
    trip_id = uuid.uuid4()
    group_id = uuid.uuid4()
    
    trip = Trip(id=trip_id, group_id=group_id, title="Test Trip", created_by=_mock_user().id)
    member = GroupMember(group_id=group_id, user_id=_mock_user().id, role=MemberRole.admin)
    
    mock_sql_result = MagicMock()
    mock_sql_result.all.return_value = []
    
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),    # Trip query in _verify_membership
        exec_result(scalar_one_or_none=member),  # Member query in _verify_membership
        mock_sql_result,                         # OSM query Result object
    ]

    with patch("app.utils.firebase.get_rtdb", return_value={}), \
         patch("app.services.wayra_service._gemini_key", return_value="fake_key"), \
         patch("httpx.Client.post") as mock_post:
        
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [{"text": '[{"name": "Spot A", "type": "park", "distance": 1.2, "description": "Desc A"}, {"name": "Spot B", "type": "museum", "distance": 2.1, "description": "Desc B"}]'}]
                    }
                }
            ]
        }
        mock_post.return_value = mock_response

        from app.routers.explorer import _nearby_picks_cache
        _nearby_picks_cache.clear()

        res = client.get(f"/api/v1/wayra/nearby/{trip_id}")
        assert res.status_code == 200
        body = res.json()
        assert "picks" in body
        assert len(body["picks"]) == 2
        assert body["picks"][0]["name"] == "Spot A"
        assert body["picks"][1]["name"] == "Spot B"
