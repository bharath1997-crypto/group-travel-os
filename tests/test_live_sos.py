"""
Unit tests for SOS Emergency alert functionality.
"""
from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.models.group import GroupMember, MemberRole
from app.models.trip import Trip, TripStatus
from app.models.user import User
from app.services.live_sos_service import LiveSOSService
from tests.conftest import exec_result


def test_sos_requires_trip_membership(db, mock_user):
    trip_id = uuid.uuid4()
    user_id = mock_user.id
    
    # Mock database returns trip but user is NOT a group member
    trip = Trip(id=trip_id, group_id=uuid.uuid4(), title="Test Trip", created_by=uuid.uuid4())
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),  # Query Trip
        exec_result(scalar_one_or_none=None),  # Query GroupMember (Not found)
    ]

    with pytest.raises(HTTPException) as exc:
        LiveSOSService.send_sos(db, user_id, trip_id, 40.7128, -74.006)
    
    assert exc.value.status_code == 403
    assert "Not a member of this trip's group" in exc.value.detail


def test_sos_logs_event_to_db(db, mock_user):
    trip_id = uuid.uuid4()
    user_id = mock_user.id
    group_id = uuid.uuid4()
    
    trip = Trip(id=trip_id, group_id=group_id, title="Test Trip", created_by=uuid.uuid4())
    member = GroupMember(group_id=group_id, user_id=user_id, role=MemberRole.member)
    sender = User(id=user_id, email="test@example.com", full_name="Sender User")
    
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),   # Query Trip
        exec_result(scalar_one_or_none=member), # Query GroupMember
        exec_result(scalar_one_or_none=sender), # Query User
    ]

    with patch("app.services.notification_service.NotificationService._group_member_recipients", return_value=[]):
        LiveSOSService.send_sos(db, user_id, trip_id, 40.7128, -74.006)

    # Verify db.add was called with the SOSEvent
    db.add.assert_called_once()
    added_obj = db.add.call_args[0][0]
    assert added_obj.trip_id == trip_id
    assert added_obj.user_id == user_id
    assert added_obj.latitude == 40.7128
    assert added_obj.longitude == -74.006
    db.commit.assert_called_once()


def test_sos_sends_to_all_members(db, mock_user):
    trip_id = uuid.uuid4()
    user_id = mock_user.id
    group_id = uuid.uuid4()
    
    trip = Trip(id=trip_id, group_id=group_id, title="Test Trip", created_by=uuid.uuid4())
    member = GroupMember(group_id=group_id, user_id=user_id, role=MemberRole.member)
    sender = User(id=user_id, email="test@example.com", full_name="Sender User")
    
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),   # Query Trip
        exec_result(scalar_one_or_none=member), # Query GroupMember
        exec_result(scalar_one_or_none=sender), # Query User
    ]

    recipient1 = User(id=uuid.uuid4(), email="rec1@example.com", full_name="Rec 1")
    recipient1.fcm_token = "token_1"
    
    recipient2 = User(id=uuid.uuid4(), email="rec2@example.com", full_name="Rec 2")
    recipient2.fcm_token = "token_2"

    with patch("app.services.notification_service.NotificationService._group_member_recipients", return_value=[recipient1, recipient2]) as mock_recipients, \
         patch("app.services.notification_service.NotificationService.send_to_token") as mock_send_token:
        
        LiveSOSService.send_sos(db, user_id, trip_id, 40.7128, -74.006)
        
        mock_recipients.assert_called_once_with(db, group_id, exclude_user_id=user_id)
        assert mock_send_token.call_count == 2
        
        # Verify first call args
        first_call_args = mock_send_token.call_args_list[0][0]
        assert first_call_args[0] == "token_1"
        assert "Emergency SOS Alert!" in first_call_args[1]
        assert "Sender User" in first_call_args[2]
        
        # Verify second call args
        second_call_args = mock_send_token.call_args_list[1][0]
        assert second_call_args[0] == "token_2"
