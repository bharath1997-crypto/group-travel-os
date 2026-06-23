"""Tests for Live Tab trip track recording and replay."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.models.trip_track import TripTrack
from app.services.live_service import LiveService, MAX_TRACK_POINTS
from app.utils.auth import get_current_user
from tests.conftest import exec_result

_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_OTHER_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")
_SESSION_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")


def _mock_user(user_id: uuid.UUID = _USER_ID):
    user = type("User", (), {})()
    user.id = user_id
    user.is_active = True
    return user


def _track(
    user_id: uuid.UUID = _USER_ID,
    session_id: uuid.UUID = _SESSION_ID,
    points: list | None = None,
) -> TripTrack:
    now = datetime.now(timezone.utc)
    track = TripTrack(
        id=uuid.uuid4(),
        user_id=user_id,
        session_id=session_id,
        trip_id=None,
        track_points=points or [],
        started_at=now,
        created_at=now,
    )
    return track


@pytest.fixture(autouse=True)
def _reset_auth():
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def auth_client():
    app.dependency_overrides[get_current_user] = lambda: _mock_user()
    return TestClient(app, raise_server_exceptions=True)


class TestRecordTrackPoint:
    def test_record_track_point_creates_track(self, db, mock_user):
        session = MagicMock()
        session.started_by = _USER_ID
        session.trip_id = None
        db.execute.side_effect = [
            exec_result(scalar_one_or_none=None),
            exec_result(scalar_one_or_none=session),
        ]
        result = LiveService.record_track_point(
            db,
            _USER_ID,
            _SESSION_ID,
            41.8781,
            -87.6298,
            45,
            180,
            "2026-06-21T12:00:00+00:00",
        )
        assert result["recorded"] is True
        assert result["point_count"] == 1
        db.add.assert_called_once()
        db.commit.assert_called_once()

    def test_record_track_point_appends_to_existing(self, db, mock_user):
        track = _track(points=[{"lat": 1, "lng": 2, "speed_mph": 10, "bearing": 0, "ts": "t1"}])
        db.execute.return_value = exec_result(scalar_one_or_none=track)
        result = LiveService.record_track_point(
            db,
            _USER_ID,
            _SESSION_ID,
            41.8781,
            -87.6298,
            50,
            90,
            "2026-06-21T12:00:10+00:00",
        )
        assert result["point_count"] == 2
        assert len(track.track_points) == 2

    def test_record_track_point_max_cap(self, db, mock_user):
        existing = [
            {
                "lat": 41.0 + i * 0.0001,
                "lng": -87.0,
                "speed_mph": 30,
                "bearing": 0,
                "ts": f"2026-06-21T12:{i % 60:02d}:00+00:00",
            }
            for i in range(MAX_TRACK_POINTS)
        ]
        track = _track(points=existing)
        db.execute.return_value = exec_result(scalar_one_or_none=track)
        result = LiveService.record_track_point(
            db,
            _USER_ID,
            _SESSION_ID,
            41.99,
            -87.6298,
            40,
            180,
            "2026-06-21T18:00:00+00:00",
        )
        assert result["point_count"] == MAX_TRACK_POINTS
        assert len(track.track_points) == MAX_TRACK_POINTS
        assert track.track_points[0]["lat"] == existing[1]["lat"]


class TestEndTrack:
    def test_end_track_calculates_stats(self, db, mock_user):
        track = _track(
            points=[
                {
                    "lat": 41.8781,
                    "lng": -87.6298,
                    "speed_mph": 40,
                    "bearing": 180,
                    "ts": "2026-06-21T12:00:00+00:00",
                },
                {
                    "lat": 41.8791,
                    "lng": -87.6298,
                    "speed_mph": 55,
                    "bearing": 180,
                    "ts": "2026-06-21T12:10:00+00:00",
                },
            ]
        )
        db.execute.return_value = exec_result(scalar_one_or_none=track)
        result = LiveService.end_track(db, _USER_ID, _SESSION_ID, 2, 1)
        assert result["total_duration_s"] == 600
        assert result["max_speed_mph"] == 55
        assert result["avg_speed_mph"] == 47.5
        assert result["reports_encountered"] == 2
        assert result["cameras_passed"] == 1
        assert result["ended_at"] is not None


class TestGetTrack:
    def test_get_track_success(self, db, mock_user):
        track = _track(
            points=[
                {
                    "lat": 41.8781,
                    "lng": -87.6298,
                    "speed_mph": 40,
                    "bearing": 180,
                    "ts": "2026-06-21T12:00:00+00:00",
                }
            ]
        )
        db.execute.return_value = exec_result(scalar_one_or_none=track)
        result = LiveService.get_track(db, _USER_ID, _SESSION_ID)
        assert result["session_id"] == _SESSION_ID
        assert len(result["track_points"]) == 1

    def test_get_track_not_owner(self, db, mock_user):
        track = _track(user_id=_OTHER_ID)
        db.execute.return_value = exec_result(scalar_one_or_none=track)
        with pytest.raises(HTTPException) as exc:
            LiveService.get_track(db, _USER_ID, _SESSION_ID)
        assert exc.value.status_code == 403


class TestTrackRoutes:
    def test_get_track_history_success(self, auth_client, monkeypatch):
        now = datetime.now(timezone.utc)
        monkeypatch.setattr(
            LiveService,
            "get_track_history",
            lambda db, user_id: [
                {
                    "id": uuid.uuid4(),
                    "session_id": _SESSION_ID,
                    "total_distance_m": 12000.0,
                    "total_duration_s": 900,
                    "max_speed_mph": 60.0,
                    "avg_speed_mph": 42.0,
                    "started_at": now,
                    "ended_at": now,
                    "reports_encountered": 1,
                    "cameras_passed": 0,
                }
            ],
        )
        resp = auth_client.get("/api/v1/live/track/history")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["total_distance_m"] == 12000.0
