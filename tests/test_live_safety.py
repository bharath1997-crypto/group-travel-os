"""Tests for Live Tab L7 safety endpoints."""
from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.models.emergency_contact import EmergencyContact
from app.models.group import GroupMember, MemberRole
from app.models.trip import Trip, TripStatus
from app.services.live_service import LiveService
from app.utils.auth import get_current_user
from tests.conftest import exec_result

_TRIP_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
_GROUP_ID = uuid.UUID("00000000-0000-0000-0000-000000000020")
_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_CONTACT_ID = uuid.UUID("00000000-0000-0000-0000-000000000040")
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


def _member(user_id: uuid.UUID, role: MemberRole = MemberRole.member) -> GroupMember:
    return GroupMember(group_id=_GROUP_ID, user_id=user_id, role=role)


def _contact() -> EmergencyContact:
    return EmergencyContact(
        id=_CONTACT_ID,
        user_id=_USER_ID,
        name="Mom",
        phone="+15551234567",
    )


@pytest.fixture(autouse=True)
def _reset_overrides():
    yield
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def auth_client():
    app.dependency_overrides[get_current_user] = lambda: _mock_user()
    return TestClient(app, raise_server_exceptions=True)


class TestEmergencyContacts:
    def test_get_emergency_contacts_success(self, db, mock_user):
        contact = _contact()
        db.execute.return_value = exec_result(scalars_all=[contact])
        rows = LiveService.get_emergency_contacts(db, mock_user.id)
        assert len(rows) == 1
        assert rows[0].name == "Mom"

    def test_add_emergency_contact_success(self, db, mock_user):
        db.execute.return_value = exec_result(scalar_one=0)

        def _refresh(obj):
            obj.id = _CONTACT_ID

        db.refresh.side_effect = _refresh
        contact = LiveService.add_emergency_contact(db, mock_user.id, "Mom", "+15551234567")
        assert contact.name == "Mom"
        db.add.assert_called_once()
        db.commit.assert_called_once()

    def test_add_emergency_contact_max_limit(self, db, mock_user):
        db.execute.return_value = exec_result(scalar_one=5)
        with pytest.raises(HTTPException) as exc:
            LiveService.add_emergency_contact(db, mock_user.id, "Extra", "+15559999999")
        assert exc.value.status_code == 400
        assert "Maximum 5 emergency contacts" in exc.value.detail

    def test_delete_emergency_contact_success(self, db, mock_user):
        contact = _contact()
        db.execute.return_value = exec_result(scalar_one_or_none=contact)
        LiveService.delete_emergency_contact(db, mock_user.id, _CONTACT_ID)
        db.delete.assert_called_once_with(contact)
        db.commit.assert_called_once()

    def test_delete_emergency_contact_not_owner(self, db, mock_user):
        contact = EmergencyContact(
            id=_CONTACT_ID,
            user_id=uuid.uuid4(),
            name="Other",
            phone="+15550001111",
        )
        db.execute.return_value = exec_result(scalar_one_or_none=contact)
        with pytest.raises(HTTPException) as exc:
            LiveService.delete_emergency_contact(db, mock_user.id, _CONTACT_ID)
        assert exc.value.status_code == 403


class TestSOS:
    @patch("app.services.live_service.set_rtdb")
    @patch("app.services.live_service.NotificationService.send_to_token")
    @patch("app.services.live_service.NotificationService._group_members_with_fcm_tokens")
    def test_trigger_sos_solo(self, mock_members, mock_send, mock_rtdb, db, mock_user):
        mock_user.full_name = "Alice"
        db.execute.side_effect = [
            exec_result(scalar_one_or_none=mock_user),
            exec_result(scalars_all=[]),
        ]
        result = LiveService.trigger_sos(db, mock_user.id, 41.88, -87.63, None, "help")
        assert result["sos_triggered"] is True
        assert result["fcm_sent_to"] == 0
        assert len(result["emergency_contacts"]) == 0
        assert "Alice" in result["sms_template"]
        mock_rtdb.assert_not_called()
        mock_send.assert_not_called()

    @patch("app.services.live_service.set_rtdb")
    @patch("app.services.live_service.NotificationService.send_to_token")
    @patch("app.services.live_service.NotificationService._group_members_with_fcm_tokens")
    def test_trigger_sos_group(self, mock_members, mock_send, mock_rtdb, db, mock_user):
        trip = _trip()
        member = _member(mock_user.id)
        mock_user.full_name = "Alice"
        mock_members.return_value = [_mock_user(uuid.uuid4(), "Bob")]
        mock_send.return_value = True
        db.execute.side_effect = [
            exec_result(scalar_one_or_none=mock_user),
            exec_result(scalars_all=[]),
            exec_result(scalar_one_or_none=trip),
            exec_result(scalar_one_or_none=member),
        ]
        result = LiveService.trigger_sos(db, mock_user.id, 41.88, -87.63, _TRIP_ID, "help")
        assert result["fcm_sent_to"] == 1
        mock_rtdb.assert_called_once()
        mock_send.assert_called_once()


class TestGeofence:
    @patch("app.services.live_service.set_rtdb")
    def test_set_geofence_admin_success(self, mock_rtdb, db, mock_user):
        trip = _trip()
        admin = _member(mock_user.id, MemberRole.admin)
        db.execute.side_effect = [
            exec_result(scalar_one_or_none=trip),
            exec_result(scalar_one_or_none=admin),
            exec_result(scalar_one_or_none=admin),
        ]
        result = LiveService.set_geofence(
            db,
            mock_user.id,
            _TRIP_ID,
            41.88,
            -87.63,
            500,
            "Safe Zone",
        )
        assert result["label"] == "Safe Zone"
        mock_rtdb.assert_called_once()

    def test_set_geofence_not_admin(self, db, mock_user):
        trip = _trip()
        member = _member(mock_user.id, MemberRole.member)
        db.execute.side_effect = [
            exec_result(scalar_one_or_none=trip),
            exec_result(scalar_one_or_none=member),
            exec_result(scalar_one_or_none=None),
        ]
        with pytest.raises(HTTPException) as exc:
            LiveService.set_geofence(
                db,
                mock_user.id,
                _TRIP_ID,
                41.88,
                -87.63,
                500,
                "Safe Zone",
            )
        assert exc.value.status_code == 403


class TestBattery:
    @patch("app.services.live_service.LiveService._send_fcm_to_trip_members")
    @patch("app.services.live_service.update_rtdb")
    def test_battery_update_low(self, mock_rtdb, mock_fcm, db, mock_user):
        trip = _trip()
        member = _member(mock_user.id)
        mock_fcm.return_value = 2
        db.execute.side_effect = [
            exec_result(scalar_one_or_none=trip),
            exec_result(scalar_one_or_none=member),
            exec_result(scalar_one_or_none=mock_user),
        ]
        result = LiveService.update_battery_level(db, mock_user.id, _TRIP_ID, 15)
        assert result["battery_level"] == 15
        assert result["alert_sent"] is True
        mock_rtdb.assert_called_once()
        mock_fcm.assert_called_once()

    @patch("app.services.live_service.LiveService._send_fcm_to_trip_members")
    @patch("app.services.live_service.update_rtdb")
    def test_battery_update_normal(self, mock_rtdb, mock_fcm, db, mock_user):
        trip = _trip()
        member = _member(mock_user.id)
        db.execute.side_effect = [
            exec_result(scalar_one_or_none=trip),
            exec_result(scalar_one_or_none=member),
        ]
        result = LiveService.update_battery_level(db, mock_user.id, _TRIP_ID, 80)
        assert result["battery_level"] == 80
        assert result["alert_sent"] is False
        mock_fcm.assert_not_called()
