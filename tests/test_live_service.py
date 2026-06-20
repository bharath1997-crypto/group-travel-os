"""Unit tests for app.services.live_service.LiveService — mocked Session only."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.models.group import GroupMember, MemberRole
from app.models.live_session import LiveMode, LiveSession
from app.models.road_report import ReportConfirmation, ReportType, RoadReport
from app.models.trip import Trip, TripStatus
from app.schemas.live import RoadReportCreate
from app.services.live_service import LiveService
from tests.conftest import exec_result


def _trip(trip_id: uuid.UUID, group_id: uuid.UUID) -> Trip:
    return Trip(
        id=trip_id,
        group_id=group_id,
        title="Chicago",
        description=None,
        status=TripStatus.planning,
        start_date=None,
        end_date=None,
        created_by=uuid.uuid4(),
    )


def _member(group_id: uuid.UUID, user_id: uuid.UUID) -> GroupMember:
    return GroupMember(group_id=group_id, user_id=user_id, role=MemberRole.member)


def test_start_session_solo_success(db, mock_user):
    session = LiveService.start_session(db, mock_user.id, None, LiveMode.solo)
    assert session.trip_id is None
    assert session.started_by == mock_user.id
    assert session.mode == LiveMode.solo
    db.add.assert_called_once()
    db.commit.assert_called_once()


def test_start_session_group_success(db, mock_user):
    trip_id = uuid.uuid4()
    group_id = uuid.uuid4()
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=_trip(trip_id, group_id)),
        exec_result(scalar_one_or_none=_member(group_id, mock_user.id)),
    ]

    session = LiveService.start_session(db, mock_user.id, trip_id, LiveMode.group)
    assert session.trip_id == trip_id
    assert session.mode == LiveMode.group
    db.add.assert_called_once()
    db.commit.assert_called_once()


def test_start_session_group_not_member(db, mock_user):
    trip_id = uuid.uuid4()
    group_id = uuid.uuid4()
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=_trip(trip_id, group_id)),
        exec_result(scalar_one_or_none=None),
    ]

    with pytest.raises(HTTPException) as exc:
        LiveService.start_session(db, mock_user.id, trip_id, LiveMode.group)
    assert exc.value.status_code == 403


def test_end_session_success(db, mock_user):
    session_id = uuid.uuid4()
    session = LiveSession(
        id=session_id,
        trip_id=None,
        started_by=mock_user.id,
        mode=LiveMode.solo,
        is_active=True,
    )
    db.execute.return_value = exec_result(scalar_one_or_none=session)

    LiveService.end_session(db, mock_user.id, session_id)
    assert session.is_active is False
    assert session.ended_at is not None
    db.commit.assert_called_once()


def test_end_session_not_owner(db, mock_user):
    session_id = uuid.uuid4()
    session = LiveSession(
        id=session_id,
        trip_id=None,
        started_by=uuid.uuid4(),
        mode=LiveMode.solo,
        is_active=True,
    )
    db.execute.return_value = exec_result(scalar_one_or_none=session)

    with pytest.raises(HTTPException) as exc:
        LiveService.end_session(db, mock_user.id, session_id)
    assert exc.value.status_code == 403


def test_submit_report_success(db, mock_user):
    data = RoadReportCreate(
        report_type=ReportType.traffic,
        lat=41.8781,
        lng=-87.6298,
        city="Chicago",
        description="Heavy traffic",
    )
    report = LiveService.submit_report(db, mock_user.id, data)
    assert report.reporter_id == mock_user.id
    assert report.report_type == ReportType.traffic
    assert report.lat == 41.8781
    assert report.lng == -87.6298
    db.add.assert_called_once()
    db.commit.assert_called_once()


def test_get_nearby_reports_success(db, mock_user):
    now = datetime.now(timezone.utc)
    close = RoadReport(
        id=uuid.uuid4(),
        reporter_id=mock_user.id,
        report_type=ReportType.traffic,
        lat=41.8790,
        lng=-87.6298,
        city="Chicago",
        description=None,
        confirmed_count=0,
        dismissed_count=0,
        is_active=True,
        expires_at=now + timedelta(hours=1),
        created_at=now,
    )
    far = RoadReport(
        id=uuid.uuid4(),
        reporter_id=mock_user.id,
        report_type=ReportType.police,
        lat=42.0,
        lng=-88.0,
        city="Far",
        description=None,
        confirmed_count=0,
        dismissed_count=0,
        is_active=True,
        expires_at=now + timedelta(hours=1),
        created_at=now,
    )
    expired = RoadReport(
        id=uuid.uuid4(),
        reporter_id=mock_user.id,
        report_type=ReportType.hazard,
        lat=41.8781,
        lng=-87.6298,
        city="Chicago",
        description=None,
        confirmed_count=0,
        dismissed_count=0,
        is_active=True,
        expires_at=now - timedelta(minutes=5),
        created_at=now - timedelta(hours=2),
    )
    # DB query filters expired rows; mock only returns active, non-expired reports.
    db.execute.return_value = exec_result(scalars_all=[close, far])

    reports = LiveService.get_nearby_reports(db, 41.8781, -87.6298, 5.0)
    assert len(reports) == 1
    assert reports[0].id == close.id


def test_confirm_report_success(db, mock_user):
    report_id = uuid.uuid4()
    report = RoadReport(
        id=report_id,
        reporter_id=uuid.uuid4(),
        report_type=ReportType.accident,
        lat=41.8781,
        lng=-87.6298,
        city="Chicago",
        description=None,
        confirmed_count=0,
        dismissed_count=0,
        is_active=True,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        created_at=datetime.now(timezone.utc),
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=report),
        exec_result(scalar_one_or_none=None),
    ]

    updated = LiveService.confirm_report(db, mock_user.id, report_id, "confirm")
    assert updated.confirmed_count == 1
    assert updated.dismissed_count == 0
    db.add.assert_called_once()
    db.commit.assert_called_once()


def test_confirm_report_duplicate_vote(db, mock_user):
    report_id = uuid.uuid4()
    report = RoadReport(
        id=report_id,
        reporter_id=uuid.uuid4(),
        report_type=ReportType.accident,
        lat=41.8781,
        lng=-87.6298,
        city=None,
        description=None,
        confirmed_count=1,
        dismissed_count=0,
        is_active=True,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        created_at=datetime.now(timezone.utc),
    )
    existing = ReportConfirmation(
        report_id=report_id,
        user_id=mock_user.id,
        action="confirm",
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=report),
        exec_result(scalar_one_or_none=existing),
    ]

    with pytest.raises(HTTPException) as exc:
        LiveService.confirm_report(db, mock_user.id, report_id, "dismiss")
    assert exc.value.status_code == 409


def test_dismiss_report_auto_deactivate(db, mock_user):
    report_id = uuid.uuid4()
    report = RoadReport(
        id=report_id,
        reporter_id=uuid.uuid4(),
        report_type=ReportType.hazard,
        lat=41.8781,
        lng=-87.6298,
        city=None,
        description=None,
        confirmed_count=0,
        dismissed_count=2,
        is_active=True,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        created_at=datetime.now(timezone.utc),
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=report),
        exec_result(scalar_one_or_none=None),
    ]

    updated = LiveService.confirm_report(db, mock_user.id, report_id, "dismiss")
    assert updated.dismissed_count == 3
    assert updated.is_active is False


def test_guest_wayra_success():
    from app.services import live_service

    live_service.guest_wayra_counts.clear()
    with patch(
        "app.services.live_service._call_guest_wayra_gemini",
        return_value="Traffic is light right now.",
    ):
        result = LiveService.guest_wayra_chat("How is traffic?", "svc-session-1")
    assert result["reply"] == "Traffic is light right now."
    assert result["remaining"] == 2


def test_guest_wayra_limit():
    from app.services import live_service

    live_service.guest_wayra_counts.clear()
    live_service.guest_wayra_counts["svc-session-limit"] = 3
    with pytest.raises(HTTPException) as exc:
        LiveService.guest_wayra_chat("Fourth message", "svc-session-limit")
    assert exc.value.status_code == 400
    assert exc.value.detail == "Guest message limit reached"


def test_traffic_density_success(db, mock_user):
    now = datetime.now(timezone.utc)
    reports = [
        RoadReport(
            id=uuid.uuid4(),
            reporter_id=mock_user.id,
            report_type=ReportType.traffic,
            lat=41.8781,
            lng=-87.6298,
            city="Chicago",
            description=None,
            confirmed_count=0,
            dismissed_count=0,
            is_active=True,
            expires_at=now + timedelta(hours=1),
            created_at=now,
        ),
        RoadReport(
            id=uuid.uuid4(),
            reporter_id=mock_user.id,
            report_type=ReportType.accident,
            lat=41.8782,
            lng=-87.6299,
            city="Chicago",
            description=None,
            confirmed_count=0,
            dismissed_count=0,
            is_active=True,
            expires_at=now + timedelta(hours=1),
            created_at=now,
        ),
    ]
    db.execute.return_value = exec_result(scalars_all=reports)

    points = LiveService.get_traffic_density(db, 41.8781, -87.6298, 10.0)
    assert len(points) == 1
    assert points[0].count == 2
    assert points[0].level == "medium"


def test_traffic_density_empty(db):
    db.execute.return_value = exec_result(scalars_all=[])
    points = LiveService.get_traffic_density(db, 41.8781, -87.6298, 10.0)
    assert points == []
