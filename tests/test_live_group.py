from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.live_group import (
    LiveFirebaseTokenResponse,
    LiveStartGroupConvergeResponse,
    LiveVotePanelOut,
)
from app.utils.auth import get_current_user

client = TestClient(app)


@pytest.fixture
def auth_user():
    user = MagicMock()
    user.id = uuid4()
    app.dependency_overrides[get_current_user] = lambda: user
    yield user
    app.dependency_overrides.pop(get_current_user, None)


def test_firebase_token_requires_auth():
    app.dependency_overrides.clear()
    res = client.get("/api/v1/live/firebase-token")
    assert res.status_code == 401


def test_firebase_token_success(auth_user):
    with patch(
        "app.routes.live_group.LiveGroupService.get_firebase_token",
        return_value=LiveFirebaseTokenResponse(token="firebase-custom-token"),
    ):
        res = client.get("/api/v1/live/firebase-token")
        assert res.status_code == 200
        assert res.json()["token"] == "firebase-custom-token"


def test_start_group_converge_validation_error(auth_user):
    res = client.post(
        "/api/v1/live/group/converge/start",
        json={
            "tripId": str(uuid4()),
            "destinationLat": 200,
            "destinationLng": -87.63,
        },
    )
    assert res.status_code == 422


def test_start_group_converge_success(auth_user):
    session_id = uuid4()
    trip_id = uuid4()
    with patch(
        "app.routes.live_group.LiveGroupService.start_group_converge",
    ) as mock_start:
        mock_start.return_value = LiveStartGroupConvergeResponse(
            status="ready",
            sessionId=session_id,
            message=None,
        )
        res = client.post(
            "/api/v1/live/group/converge/start",
            json={
                "tripId": str(trip_id),
                "destinationLat": 41.88,
                "destinationLng": -87.63,
                "travelMode": "Drive",
            },
        )
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "ready"
        assert body["sessionId"] == str(session_id)


def test_live_vote_panel_requires_auth():
    app.dependency_overrides.clear()
    res = client.get(f"/api/v1/live/trips/{uuid4()}/vote-panel")
    assert res.status_code == 401


def test_create_live_vote_poll_validation_error(auth_user):
    res = client.post(
        f"/api/v1/live/trips/{uuid4()}/vote-panel",
        json={
            "question": "Where?",
            "options": [{"label": "Only one"}],
        },
    )
    assert res.status_code == 422


def test_get_live_vote_panel_success(auth_user):
    trip_id = uuid4()
    with patch(
        "app.routes.live_group.LiveGroupService.get_vote_panel",
        return_value=LiveVotePanelOut(
            pollId=None,
            question="Where are we eating?",
            closesAtLabel=None,
            memberCount=4,
            options=[],
            myOptionId=None,
            status="empty",
        ),
    ):
        res = client.get(f"/api/v1/live/trips/{trip_id}/vote-panel")
        assert res.status_code == 200
        assert res.json()["memberCount"] == 4
