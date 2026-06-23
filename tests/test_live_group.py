"""Tests for Live Tab L6 group live endpoints."""
from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.models.group import GroupMember, MemberRole
from app.models.trip import Trip, TripStatus
from app.models.user import User
from app.services.live_service import LiveService
from app.utils.auth import get_current_user
from tests.conftest import exec_result

_TRIP_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
_GROUP_ID = uuid.UUID("00000000-0000-0000-0000-000000000020")
_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_ADMIN_ID = uuid.UUID("00000000-0000-0000-0000-000000000003")


def _mock_user(user_id: uuid.UUID = _USER_ID, full_name: str = "Test User") -> MagicMock:
    user = MagicMock()
    user.id = user_id
    user.email = "live@example.com"
    user.full_name = full_name
    user.is_active = True
    user.fcm_token = "fake-token"
    return user


def _trip() -> Trip:
    return Trip(
        id=_TRIP_ID,
        group_id=_GROUP_ID,
        title="Chicago Trip",
        description=None,
        status=TripStatus.planning,
        start_date=None,
        end_date=None,
        created_by=_ADMIN_ID,
    )


def _member(
    user_id: uuid.UUID,
    role: MemberRole = MemberRole.member,
) -> GroupMember:
    return GroupMember(group_id=_GROUP_ID, user_id=user_id, role=role)


@pytest.fixture(autouse=True)
def _reset_overrides():
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def auth_client():
    app.dependency_overrides[get_current_user] = lambda: _mock_user()
    return TestClient(app, raise_server_exceptions=True)


class TestValidateGroupMember:
    @patch("app.routes.live.LiveService.validate_group_member")
    def test_validate_group_member_success(self, mock_validate, auth_client):
        mock_validate.return_value = {
            "trip_id": _TRIP_ID,
            "trip_name": "Chicago Trip",
            "member_count": 2,
            "members": [
                {
                    "user_id": _USER_ID,
                    "display_name": "Test User",
                    "is_admin": False,
                }
            ],
            "is_admin": False,
        }
        resp = auth_client.get(f"/api/v1/live/group/{_TRIP_ID}/validate")
        assert resp.status_code == 200
        body = resp.json()
        assert body["trip_name"] == "Chicago Trip"
        assert body["member_count"] == 2
        mock_validate.assert_called_once()

    @patch("app.routes.live.LiveService.validate_group_member")
    def test_validate_group_member_not_member(self, mock_validate, auth_client):
        mock_validate.side_effect = HTTPException(
            status_code=403,
            detail="Not a trip member",
        )
        resp = auth_client.get(f"/api/v1/live/group/{_TRIP_ID}/validate")
        assert resp.status_code == 403
        assert resp.json()["detail"] == "Not a trip member"


class TestMeetingPoint:
    @patch("app.services.live_service.set_rtdb")
    @patch("app.services.live_service.LiveService._send_fcm_to_trip_members")
    def test_set_meeting_point_success(self, mock_fcm, mock_rtdb, db, mock_user):
        trip = _trip()
        member = _member(mock_user.id, MemberRole.admin)
        db.execute.side_effect = [
            exec_result(scalar_one_or_none=trip),
            exec_result(scalar_one_or_none=member),
            exec_result(scalar_one_or_none=member),
            exec_result(scalar_one_or_none=mock_user),
        ]

        result = LiveService.set_meeting_point(
            db,
            mock_user.id,
            _TRIP_ID,
            41.88,
            -87.63,
            "North entrance",
        )

        assert result["lat"] == 41.88
        assert result["label"] == "North entrance"
        mock_rtdb.assert_called_once()
        mock_fcm.assert_called_once()

    def test_set_meeting_point_not_admin(self, db, mock_user):
        trip = _trip()
        member = _member(mock_user.id, MemberRole.member)
        db.execute.side_effect = [
            exec_result(scalar_one_or_none=trip),
            exec_result(scalar_one_or_none=member),
            exec_result(scalar_one_or_none=None),
        ]

        with pytest.raises(HTTPException) as exc:
            LiveService.set_meeting_point(
                db,
                mock_user.id,
                _TRIP_ID,
                41.88,
                -87.63,
                "North entrance",
            )
        assert exc.value.status_code == 403

    @patch("app.services.live_service.delete_rtdb")
    def test_delete_meeting_point_success(self, mock_delete, db, mock_user):
        trip = _trip()
        member = _member(mock_user.id, MemberRole.admin)
        db.execute.side_effect = [
            exec_result(scalar_one_or_none=trip),
            exec_result(scalar_one_or_none=member),
            exec_result(scalar_one_or_none=member),
        ]

        LiveService.delete_meeting_point(db, mock_user.id, _TRIP_ID)
        mock_delete.assert_called_once_with(f"trips/{_TRIP_ID}/live/meeting_point")


class TestQuickStatus:
    @patch("app.services.live_service.set_rtdb")
    def test_set_quick_status_success(self, mock_rtdb, db, mock_user):
        trip = _trip()
        member = _member(mock_user.id)
        db.execute.side_effect = [
            exec_result(scalar_one_or_none=trip),
            exec_result(scalar_one_or_none=member),
        ]

        result = LiveService.set_member_status(
            db,
            mock_user.id,
            _TRIP_ID,
            "on_my_way",
        )
        assert result["status"] == "on_my_way"
        assert "updated_at" in result
        mock_rtdb.assert_called_once()

    @patch("app.services.live_service.LiveService._send_fcm_to_trip_members")
    @patch("app.services.live_service.set_rtdb")
    def test_set_quick_status_need_help(self, mock_rtdb, mock_fcm, db, mock_user):
        trip = _trip()
        member = _member(mock_user.id)
        db.execute.side_effect = [
            exec_result(scalar_one_or_none=trip),
            exec_result(scalar_one_or_none=member),
            exec_result(scalar_one_or_none=mock_user),
        ]

        LiveService.set_member_status(db, mock_user.id, _TRIP_ID, "need_help")
        mock_fcm.assert_called_once()


class TestConvoy:
    @patch("app.services.live_service.LiveService.get_route")
    @patch("app.services.live_service.set_rtdb")
    @patch("app.services.live_service.get_rtdb")
    @patch("app.services.live_service.LiveService._send_fcm_to_trip_members")
    def test_start_convoy_success(
        self,
        mock_fcm,
        mock_get_rtdb,
        mock_set_rtdb,
        mock_route,
        db,
        mock_user,
    ):
        trip = _trip()
        member = _member(mock_user.id, MemberRole.admin)
        mock_get_rtdb.return_value = {"lat": 41.88, "lng": -87.63}
        mock_route.return_value = {
            "geometry": {"type": "LineString", "coordinates": [[-87.63, 41.88]]},
            "steps": [],
            "total_distance_m": 1000.0,
            "total_duration_s": 120.0,
        }
        db.execute.side_effect = [
            exec_result(scalar_one_or_none=trip),
            exec_result(scalar_one_or_none=member),
            exec_result(scalar_one_or_none=member),
            exec_result(scalar_one_or_none=mock_user),
        ]

        result = LiveService.start_convoy(
            db,
            mock_user.id,
            _TRIP_ID,
            41.9,
            -87.6,
            "Millennium Park",
        )

        assert result["active"] is True
        assert result["destination_name"] == "Millennium Park"
        mock_route.assert_called_once()
        mock_set_rtdb.assert_called_once()
        mock_fcm.assert_called_once()

    def test_start_convoy_not_admin(self, db, mock_user):
        trip = _trip()
        member = _member(mock_user.id, MemberRole.member)
        db.execute.side_effect = [
            exec_result(scalar_one_or_none=trip),
            exec_result(scalar_one_or_none=member),
            exec_result(scalar_one_or_none=None),
        ]

        with pytest.raises(HTTPException) as exc:
            LiveService.start_convoy(
                db,
                mock_user.id,
                _TRIP_ID,
                41.9,
                -87.6,
                "Millennium Park",
            )
        assert exc.value.status_code == 403

    @patch("app.services.live_service.delete_rtdb")
    @patch("app.services.live_service.LiveService._send_fcm_to_trip_members")
    def test_end_convoy_success(self, mock_fcm, mock_delete, db, mock_user):
        trip = _trip()
        member = _member(mock_user.id, MemberRole.admin)
        db.execute.side_effect = [
            exec_result(scalar_one_or_none=trip),
            exec_result(scalar_one_or_none=member),
            exec_result(scalar_one_or_none=member),
        ]

        LiveService.end_convoy(db, mock_user.id, _TRIP_ID)
        mock_delete.assert_called_once_with(f"trips/{_TRIP_ID}/live/convoy")
        mock_fcm.assert_called_once()


class TestFirebaseToken:
    @patch("app.utils.firebase.create_custom_token")
    def test_get_firebase_token_success(self, mock_create_token, auth_client):
        mock_create_token.return_value = "mocked-firebase-token"
        resp = auth_client.get("/api/v1/live/firebase-token")
        assert resp.status_code == 200
        assert resp.json() == {"token": "mocked-firebase-token"}
        mock_create_token.assert_called_once_with(str(_USER_ID))

    def test_get_firebase_token_unauthorized(self):
        client = TestClient(app)
        resp = client.get("/api/v1/live/firebase-token")
        assert resp.status_code == 401

