"""Unit tests for app.services.trip_service.TripService — mocked Session only."""
from __future__ import annotations

import uuid
from datetime import date
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.models.group import GroupMember, MemberRole
from app.models.trip import Trip, TripStatus
from app.services.trip_service import TripService
from tests.conftest import exec_result


def _member_row(gid: uuid.UUID, uid: uuid.UUID) -> GroupMember:
    return GroupMember(group_id=gid, user_id=uid, role=MemberRole.member)


def test_create_trip_success(db, mock_user):
    mock_user.id = uuid.uuid4()
    gid = uuid.uuid4()
    db.execute.return_value = exec_result(scalar_one_or_none=_member_row(gid, mock_user.id))

    data = SimpleNamespace(
        title="  Paris  ",
        description="Fun",
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 10),
    )
    trip = TripService.create_trip(db, gid, data, mock_user)
    assert trip.group_id == gid
    assert trip.title == "Paris"
    assert trip.created_by == mock_user.id
    db.add.assert_called_once()
    db.commit.assert_called_once()


def test_create_trip_bad_request_when_title_missing(db, mock_user):
    mock_user.id = uuid.uuid4()
    gid = uuid.uuid4()
    db.execute.return_value = exec_result(scalar_one_or_none=_member_row(gid, mock_user.id))

    data = SimpleNamespace(title="   ", description=None, start_date=None, end_date=None)
    with pytest.raises(HTTPException) as ei:
        TripService.create_trip(db, gid, data, mock_user)
    assert ei.value.status_code == 400


def test_create_trip_bad_request_when_start_after_end(db, mock_user):
    mock_user.id = uuid.uuid4()
    gid = uuid.uuid4()
    db.execute.return_value = exec_result(scalar_one_or_none=_member_row(gid, mock_user.id))
    data = SimpleNamespace(
        title="T",
        description=None,
        start_date=date(2026, 7, 1),
        end_date=date(2026, 6, 1),
    )
    with pytest.raises(HTTPException) as ei:
        TripService.create_trip(db, gid, data, mock_user)
    assert ei.value.status_code == 400


def test_create_trip_forbidden_when_not_group_member(db, mock_user):
    mock_user.id = uuid.uuid4()
    gid = uuid.uuid4()
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    data = SimpleNamespace(title="T", description=None, start_date=None, end_date=None)
    with pytest.raises(HTTPException) as ei:
        TripService.create_trip(db, gid, data, mock_user)
    assert ei.value.status_code == 403


def test_get_trip_success(db, mock_user):
    mock_user.id = uuid.uuid4()
    gid = uuid.uuid4()
    trip = Trip(
        group_id=gid,
        title="T",
        description=None,
        status=TripStatus.planning,
        start_date=None,
        end_date=None,
        created_by=mock_user.id,
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),
        exec_result(scalar_one_or_none=_member_row(gid, mock_user.id)),
    ]
    assert TripService.get_trip(db, trip.id, mock_user) is trip


def test_get_trip_not_found(db, mock_user):
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    with pytest.raises(HTTPException) as ei:
        TripService.get_trip(db, uuid.uuid4(), mock_user)
    assert ei.value.status_code == 404


def test_list_group_trips_success(db, mock_user):
    mock_user.id = uuid.uuid4()
    gid = uuid.uuid4()
    t1 = Trip(
        group_id=gid,
        title="A",
        description=None,
        status=TripStatus.planning,
        start_date=None,
        end_date=None,
        created_by=mock_user.id,
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=_member_row(gid, mock_user.id)),
        exec_result(scalars_all=[t1]),
    ]
    rows = TripService.list_group_trips(db, gid, mock_user)
    assert rows == [t1]


def test_list_group_trips_forbidden(db, mock_user):
    mock_user.id = uuid.uuid4()
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    with pytest.raises(HTTPException) as ei:
        TripService.list_group_trips(db, uuid.uuid4(), mock_user)
    assert ei.value.status_code == 403


def test_update_trip_success_as_creator(db, mock_user):
    mock_user.id = uuid.uuid4()
    gid = uuid.uuid4()
    trip = Trip(
        group_id=gid,
        title="Old",
        description=None,
        status=TripStatus.planning,
        start_date=None,
        end_date=None,
        created_by=mock_user.id,
    )
    db.execute.return_value = exec_result(scalar_one_or_none=trip)

    payload = SimpleNamespace(title="New", description="d", start_date=None, end_date=None)
    out = TripService.update_trip(db, trip.id, payload, mock_user)
    assert out.title == "New"
    assert out.description == "d"
    db.commit.assert_called_once()


def test_update_trip_not_found(db, mock_user):
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    with pytest.raises(HTTPException) as ei:
        TripService.update_trip(db, uuid.uuid4(), SimpleNamespace(title="N"), mock_user)
    assert ei.value.status_code == 404


def test_update_trip_forbidden_when_not_creator_or_admin(db, mock_user):
    mock_user.id = uuid.uuid4()
    other = uuid.uuid4()
    gid = uuid.uuid4()
    trip = Trip(
        group_id=gid,
        title="Old",
        description=None,
        status=TripStatus.planning,
        start_date=None,
        end_date=None,
        created_by=other,
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),
        exec_result(scalar_one_or_none=None),
    ]
    with pytest.raises(HTTPException) as ei:
        TripService.update_trip(db, trip.id, SimpleNamespace(title="N"), mock_user)
    assert ei.value.status_code == 403


def test_delete_trip_success(db, mock_user):
    mock_user.id = uuid.uuid4()
    gid = uuid.uuid4()
    trip = Trip(
        group_id=gid,
        title="T",
        description=None,
        status=TripStatus.planning,
        start_date=None,
        end_date=None,
        created_by=mock_user.id,
    )
    db.execute.return_value = exec_result(scalar_one_or_none=trip)

    TripService.delete_trip(db, trip.id, mock_user)
    db.delete.assert_called_once_with(trip)
    db.commit.assert_called_once()


def test_delete_trip_not_found(db, mock_user):
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    with pytest.raises(HTTPException) as ei:
        TripService.delete_trip(db, uuid.uuid4(), mock_user)
    assert ei.value.status_code == 404


def test_delete_trip_forbidden(db, mock_user):
    mock_user.id = uuid.uuid4()
    gid = uuid.uuid4()
    trip = Trip(
        group_id=gid,
        title="T",
        description=None,
        status=TripStatus.planning,
        start_date=None,
        end_date=None,
        created_by=uuid.uuid4(),
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),
        exec_result(scalar_one_or_none=None),
    ]
    with pytest.raises(HTTPException) as ei:
        TripService.delete_trip(db, trip.id, mock_user)
    assert ei.value.status_code == 403


def test_change_status_success(db, mock_user):
    mock_user.id = uuid.uuid4()
    gid = uuid.uuid4()
    trip = Trip(
        group_id=gid,
        title="T",
        description=None,
        status=TripStatus.planning,
        start_date=None,
        end_date=None,
        created_by=mock_user.id,
    )
    db.execute.return_value = exec_result(scalar_one_or_none=trip)

    out = TripService.change_status(db, trip.id, TripStatus.confirmed, mock_user)
    assert out.status == TripStatus.confirmed


def test_change_status_not_found(db, mock_user):
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    with pytest.raises(HTTPException) as ei:
        TripService.change_status(db, uuid.uuid4(), TripStatus.confirmed, mock_user)
    assert ei.value.status_code == 404


def test_change_status_forbidden(db, mock_user):
    mock_user.id = uuid.uuid4()
    gid = uuid.uuid4()
    trip = Trip(
        group_id=gid,
        title="T",
        description=None,
        status=TripStatus.planning,
        start_date=None,
        end_date=None,
        created_by=uuid.uuid4(),
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),
        exec_result(scalar_one_or_none=None),
    ]
    with pytest.raises(HTTPException) as ei:
        TripService.change_status(db, trip.id, TripStatus.confirmed, mock_user)
    assert ei.value.status_code == 403
