"""
Unit tests for Live Itinerary Plan functionality.
"""
from __future__ import annotations

import uuid
from datetime import date
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.group import GroupMember, MemberRole
from app.models.trip import Trip
from app.models.live_plan import TripLivePlan
from app.utils.auth import get_current_user
from app.utils.database import get_db
from tests.conftest import exec_result

client = TestClient(app)


def _mock_user() -> MagicMock:
    user = MagicMock()
    user.id = uuid.UUID("00000000-0000-0000-0000-000000000033")
    user.email = "plantest@example.com"
    user.full_name = "Plan Tester"
    user.is_active = True
    return user


@pytest.fixture
def auth_header(db) -> dict[str, str]:
    app.dependency_overrides[get_current_user] = _mock_user
    app.dependency_overrides[get_db] = lambda: db
    yield {}
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_db, None)


def test_create_live_plan_saves_to_db(db, auth_header):
    trip_id = uuid.uuid4()
    group_id = uuid.uuid4()
    
    trip = Trip(id=trip_id, group_id=group_id, title="Test Trip", created_by=_mock_user().id)
    member = GroupMember(group_id=group_id, user_id=_mock_user().id, role=MemberRole.admin)
    
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),
        exec_result(scalar_one_or_none=member),
        exec_result(),  # Delete query execution result
    ]

    res = client.post(
        f"/api/v1/trips/{trip_id}/live-plan",
        json={
            "days": [
                {
                    "day_number": 1,
                    "date": "2026-06-05",
                    "destination": "Paris",
                    "departure_time": "09:00",
                    "activities": [
                        {"time": "09:00", "description": "Tour Eiffel"}
                    ]
                }
            ]
        }
    )
    
    assert res.status_code == 200
    assert res.json() == {"status": "success", "message": "Trip plan saved"}
    
    assert db.add.call_count >= 1
    added_plan = db.add.call_args[0][0]
    assert isinstance(added_plan, TripLivePlan)
    assert added_plan.trip_id == trip_id
    assert added_plan.day_number == 1
    assert added_plan.destination == "Paris"
    db.commit.assert_called_once()


def test_get_live_plan_returns_all_days(db, auth_header):
    trip_id = uuid.uuid4()
    group_id = uuid.uuid4()
    
    trip = Trip(id=trip_id, group_id=group_id, title="Test Trip", created_by=_mock_user().id)
    member = GroupMember(group_id=group_id, user_id=_mock_user().id, role=MemberRole.admin)
    
    plan_day = TripLivePlan(
        trip_id=trip_id,
        day_number=1,
        date=date(2026, 6, 5),
        destination="Paris",
        activities=[{"time": "09:00", "description": "Tour Eiffel"}],
        departure_time=None
    )
    
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),
        exec_result(scalar_one_or_none=member),
        exec_result(scalars_all=[plan_day])
    ]

    res = client.get(f"/api/v1/trips/{trip_id}/live-plan")
    
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 1
    assert body[0]["day_number"] == 1
    assert body[0]["destination"] == "Paris"
