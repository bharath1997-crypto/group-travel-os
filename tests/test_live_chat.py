"""Tests for live report route chat (Firebase RTDB ephemeral)."""
from __future__ import annotations

import uuid
import time
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.models.road_report import ReportType, RoadReport
from app.services import live_service
from app.services.live_service import LiveService
from app.utils.auth import get_current_user
from tests.conftest import exec_result

_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
_REPORT_ID = uuid.UUID("00000000-0000-0000-0000-000000000040")


def _active_report(*, expired: bool = False, active: bool = True) -> RoadReport:
    now = datetime.now(timezone.utc)
    return RoadReport(
        id=_REPORT_ID,
        reporter_id=_USER_ID,
        report_type=ReportType.traffic,
        lat=41.8781,
        lng=-87.6298,
        city="Chicago",
        description=None,
        confirmed_count=0,
        dismissed_count=0,
        is_active=active,
        expires_at=now - timedelta(minutes=5) if expired else now + timedelta(hours=1),
        created_at=now - timedelta(minutes=10),
    )


@pytest.fixture(autouse=True)
def _reset_overrides():
    live_service._chat_rate.clear()
    yield
    app.dependency_overrides.pop(get_current_user, None)
    live_service._chat_rate.clear()


@pytest.fixture
def auth_client():
    user = MagicMock()
    user.id = _USER_ID
    user.is_active = True
    app.dependency_overrides[get_current_user] = lambda: user
    return TestClient(app, raise_server_exceptions=True)


class TestSendReportChat:
    @patch("app.services.live_service.set_rtdb")
    def test_send_chat_success(self, mock_set_rtdb, db, mock_user):
        report = _active_report()
        db.execute.return_value = exec_result(scalar_one_or_none=report)

        result = LiveService.send_report_chat(
            db,
            mock_user.id,
            _REPORT_ID,
            "Road is clear now",
        )

        assert result["text"] == "Road is clear now"
        assert result["sender_label"] == "Traveler nearby"
        assert result["message_id"]
        mock_set_rtdb.assert_called_once()

    def test_send_chat_expired_report(self, db, mock_user):
        report = _active_report(expired=True)
        db.execute.return_value = exec_result(scalar_one_or_none=report)

        with pytest.raises(HTTPException) as exc:
            LiveService.send_report_chat(db, mock_user.id, _REPORT_ID, "Hello")
        assert exc.value.status_code == 400
        assert exc.value.detail == "This report has expired"

    def test_send_chat_blocked_phone(self, db, mock_user):
        report = _active_report()
        db.execute.return_value = exec_result(scalar_one_or_none=report)

        with pytest.raises(HTTPException) as exc:
            LiveService.send_report_chat(
                db,
                mock_user.id,
                _REPORT_ID,
                "Call me at 555-123-4567",
            )
        assert exc.value.status_code == 400
        assert exc.value.detail == "Message contains blocked content"

    def test_send_chat_blocked_url(self, db, mock_user):
        report = _active_report()
        db.execute.return_value = exec_result(scalar_one_or_none=report)

        with pytest.raises(HTTPException) as exc:
            LiveService.send_report_chat(
                db,
                mock_user.id,
                _REPORT_ID,
                "See https://example.com for details",
            )
        assert exc.value.status_code == 400
        assert exc.value.detail == "Message contains blocked content"

    @patch("app.services.live_service.set_rtdb")
    def test_send_chat_rate_limit(self, mock_set_rtdb, db, mock_user):
        report = _active_report()
        db.execute.return_value = exec_result(scalar_one_or_none=report)
        live_service._chat_rate[str(mock_user.id)] = [time.time()] * 10

        with pytest.raises(HTTPException) as exc:
            LiveService.send_report_chat(db, mock_user.id, _REPORT_ID, "Too many")
        assert exc.value.status_code == 400
        assert "Slow down" in exc.value.detail
        mock_set_rtdb.assert_not_called()


class TestGetReportChat:
    @patch("app.services.live_service.get_rtdb")
    def test_get_chat_success(self, mock_get_rtdb, db):
        report = _active_report()
        db.execute.return_value = exec_result(scalar_one_or_none=report)
        mock_get_rtdb.return_value = {
            "m2": {
                "id": "m2",
                "text": "Second",
                "sender_label": "Traveler nearby",
                "sent_at": "2026-06-20T20:00:00+00:00",
            },
            "m1": {
                "id": "m1",
                "text": "First",
                "sender_label": "Traveler nearby",
                "sent_at": "2026-06-20T19:00:00+00:00",
            },
        }

        messages = LiveService.get_report_chat(db, _REPORT_ID)
        assert len(messages) == 2
        assert messages[0]["text"] == "First"
        assert messages[1]["text"] == "Second"


class TestFlagReportChat:
    @patch("app.services.live_service.update_rtdb")
    @patch("app.services.live_service.get_rtdb")
    def test_flag_message_success(self, mock_get_rtdb, mock_update_rtdb, db):
        report = _active_report()
        db.execute.return_value = exec_result(scalar_one_or_none=report)
        mock_get_rtdb.return_value = {"id": "m1", "text": "Hi", "flag_count": 0}

        result = LiveService.flag_chat_message(db, _REPORT_ID, "m1")
        assert result == {"flagged": True, "removed": False}
        mock_update_rtdb.assert_called_once()

    @patch("app.services.live_service.delete_rtdb")
    @patch("app.services.live_service.get_rtdb")
    def test_flag_message_removed(self, mock_get_rtdb, mock_delete_rtdb, db):
        report = _active_report()
        db.execute.return_value = exec_result(scalar_one_or_none=report)
        mock_get_rtdb.return_value = {"id": "m1", "text": "Hi", "flag_count": 1}

        result = LiveService.flag_chat_message(db, _REPORT_ID, "m1")
        assert result == {"flagged": True, "removed": True}
        mock_delete_rtdb.assert_called_once()


class TestReportChatRoutes:
    @patch("app.routes.live.LiveService.send_report_chat")
    def test_send_chat_route_success(self, mock_send, auth_client):
        now = datetime.now(timezone.utc)
        mock_send.return_value = {
            "message_id": "abc",
            "sent_at": now,
            "text": "Clear lane",
            "sender_label": "Traveler nearby",
        }
        resp = auth_client.post(
            f"/api/v1/live/reports/{_REPORT_ID}/chat",
            json={"text": "Clear lane"},
        )
        assert resp.status_code == 200
        assert resp.json()["text"] == "Clear lane"

    @patch("app.routes.live.LiveService.get_report_chat_count")
    def test_get_chat_count_route(self, mock_count):
        mock_count.return_value = 3
        client = TestClient(app, raise_server_exceptions=True)
        resp = client.get(f"/api/v1/live/reports/{_REPORT_ID}/chat/count")
        assert resp.status_code == 200
        assert resp.json()["count"] == 3
