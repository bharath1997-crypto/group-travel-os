"""Unit tests for app.services.location_service.LocationService — mocked Session only."""
from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.models.group import GroupMember, MemberRole
from app.models.location import Location, TripLocation
from app.models.trip import Trip, TripStatus
from app.services.location_service import LocationService
from tests.conftest import exec_result


def _member(gid: uuid.UUID, uid: uuid.UUID) -> GroupMember:
    return GroupMember(group_id=gid, user_id=uid, role=MemberRole.member)


def test_save_location_success(db, mock_user):
    mock_user.id = uuid.uuid4()
    data = SimpleNamespace(
        name="Cafe",
        address="1 St",
        latitude=1.0,
        longitude=2.0,
        place_id=None,
        category="food",
        notes=None,
    )
    loc = LocationService.save_location(db, data, mock_user)
    assert loc.saved_by == mock_user.id
    assert loc.name == "Cafe"
    db.add.assert_called_once()
    db.commit.assert_called_once()


def test_list_user_locations_returns_filtered(db, mock_user):
    mock_user.id = uuid.uuid4()
    loc = Location(
        saved_by=mock_user.id,
        name="X",
        latitude=0.0,
        longitude=0.0,
        category="c1",
    )
    loc.is_visited = True
    db.execute.return_value = exec_result(scalars_all=[loc])

    rows = LocationService.list_user_locations(db, mock_user, category="c1", is_visited=True)
    assert rows == [loc]


def test_get_location_success(db, mock_user):
    mock_user.id = uuid.uuid4()
    loc = Location(
        saved_by=mock_user.id,
        name="N",
        latitude=1.0,
        longitude=2.0,
    )
    db.execute.return_value = exec_result(scalar_one_or_none=loc)
    assert LocationService.get_location(db, loc.id, mock_user) is loc


def test_get_location_not_found(db, mock_user):
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    with pytest.raises(HTTPException) as ei:
        LocationService.get_location(db, uuid.uuid4(), mock_user)
    assert ei.value.status_code == 404


def test_get_location_forbidden_other_owner(db, mock_user):
    mock_user.id = uuid.uuid4()
    loc = Location(
        saved_by=uuid.uuid4(),
        name="N",
        latitude=1.0,
        longitude=2.0,
    )
    db.execute.return_value = exec_result(scalar_one_or_none=loc)
    with pytest.raises(HTTPException) as ei:
        LocationService.get_location(db, loc.id, mock_user)
    assert ei.value.status_code == 403


def test_update_location_success(db, mock_user):
    mock_user.id = uuid.uuid4()
    loc = Location(
        saved_by=mock_user.id,
        name="N",
        latitude=1.0,
        longitude=2.0,
    )
    db.execute.return_value = exec_result(scalar_one_or_none=loc)
    data = SimpleNamespace(notes="hello", is_visited=True, category="x")
    out = LocationService.update_location(db, loc.id, data, mock_user)
    assert out.notes == "hello"
    assert out.is_visited is True


def test_update_location_not_found(db, mock_user):
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    with pytest.raises(HTTPException) as ei:
        LocationService.update_location(db, uuid.uuid4(), SimpleNamespace(notes="x"), mock_user)
    assert ei.value.status_code == 404


def test_update_location_forbidden(db, mock_user):
    mock_user.id = uuid.uuid4()
    loc = Location(
        saved_by=uuid.uuid4(),
        name="N",
        latitude=1.0,
        longitude=2.0,
    )
    db.execute.return_value = exec_result(scalar_one_or_none=loc)
    with pytest.raises(HTTPException) as ei:
        LocationService.update_location(db, loc.id, SimpleNamespace(notes="x"), mock_user)
    assert ei.value.status_code == 403


def test_delete_location_success(db, mock_user):
    mock_user.id = uuid.uuid4()
    loc = Location(
        saved_by=mock_user.id,
        name="N",
        latitude=1.0,
        longitude=2.0,
    )
    db.execute.return_value = exec_result(scalar_one_or_none=loc)
    LocationService.delete_location(db, loc.id, mock_user)
    db.delete.assert_called_once_with(loc)


def test_delete_location_not_found(db, mock_user):
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    with pytest.raises(HTTPException) as ei:
        LocationService.delete_location(db, uuid.uuid4(), mock_user)
    assert ei.value.status_code == 404


def test_add_to_trip_success(db, mock_user):
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
    loc = Location(
        saved_by=mock_user.id,
        name="Spot",
        latitude=0.0,
        longitude=0.0,
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),
        exec_result(scalar_one_or_none=_member(gid, mock_user.id)),
        exec_result(scalar_one_or_none=loc),
        exec_result(scalar_one_or_none=None),
    ]
    row = LocationService.add_to_trip(db, trip.id, loc.id, mock_user)
    assert isinstance(row, TripLocation)
    assert row.trip_id == trip.id
    assert row.location_id == loc.id


def test_add_to_trip_location_not_found(db, mock_user):
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
        exec_result(scalar_one_or_none=_member(gid, mock_user.id)),
        exec_result(scalar_one_or_none=None),
    ]
    with pytest.raises(HTTPException) as ei:
        LocationService.add_to_trip(db, trip.id, uuid.uuid4(), mock_user)
    assert ei.value.status_code == 404


def test_add_to_trip_trip_not_found(db, mock_user):
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    with pytest.raises(HTTPException) as ei:
        LocationService.add_to_trip(db, uuid.uuid4(), uuid.uuid4(), mock_user)
    assert ei.value.status_code == 404


def test_add_to_trip_conflict_when_already_linked(db, mock_user):
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
    loc = Location(
        saved_by=mock_user.id,
        name="Spot",
        latitude=0.0,
        longitude=0.0,
    )
    existing = TripLocation(
        trip_id=trip.id,
        location_id=loc.id,
        status="suggested",
        added_by=mock_user.id,
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),
        exec_result(scalar_one_or_none=_member(gid, mock_user.id)),
        exec_result(scalar_one_or_none=loc),
        exec_result(scalar_one_or_none=existing),
    ]
    with pytest.raises(HTTPException) as ei:
        LocationService.add_to_trip(db, trip.id, loc.id, mock_user)
    assert ei.value.status_code == 409


def test_list_trip_locations_trip_not_found(db, mock_user):
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    with pytest.raises(HTTPException) as ei:
        LocationService.list_trip_locations(db, uuid.uuid4(), mock_user)
    assert ei.value.status_code == 404


def test_list_trip_locations_success(db, mock_user):
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
    loc = Location(
        saved_by=mock_user.id,
        name="L",
        latitude=0.0,
        longitude=0.0,
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),
        exec_result(scalar_one_or_none=_member(gid, mock_user.id)),
        exec_result(scalars_all=[loc]),
    ]
    rows = LocationService.list_trip_locations(db, trip.id, mock_user)
    assert rows == [loc]


def test_remove_from_trip_success(db, mock_user):
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
    loc = Location(
        saved_by=mock_user.id,
        name="L",
        latitude=0.0,
        longitude=0.0,
    )
    link = TripLocation(
        trip_id=trip.id,
        location_id=loc.id,
        status="suggested",
        added_by=mock_user.id,
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),
        exec_result(scalar_one_or_none=_member(gid, mock_user.id)),
        exec_result(scalar_one_or_none=link),
    ]
    LocationService.remove_from_trip(db, trip.id, loc.id, mock_user)
    db.delete.assert_called_once_with(link)
    db.commit.assert_called_once()


def test_remove_from_trip_not_linked(db, mock_user):
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
        exec_result(scalar_one_or_none=_member(gid, mock_user.id)),
        exec_result(scalar_one_or_none=None),
    ]
    with pytest.raises(HTTPException) as ei:
        LocationService.remove_from_trip(db, trip.id, uuid.uuid4(), mock_user)
    assert ei.value.status_code == 404
