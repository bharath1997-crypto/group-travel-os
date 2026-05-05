"""Unit tests for app.services.group_service.GroupService — mocked Session only."""
from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.models.group import Group, GroupMember, MemberRole
from app.services.group_service import GroupService
from tests.conftest import exec_result


def test_create_group_invite_unique_and_adds_admin(db, mock_user):
    mock_user.id = uuid.uuid4()
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=None),
    ]

    g = GroupService.create_group(db, "Team", "desc", mock_user)

    assert g.name == "Team"
    assert g.description == "desc"
    assert g.created_by == mock_user.id
    assert db.add.call_count == 2
    db.flush.assert_called_once()
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(g)


def test_join_group_success(db, mock_user):
    mock_user.id = uuid.uuid4()
    group = Group(
        name="G",
        description=None,
        created_by=uuid.uuid4(),
        invite_code="abcinvite1",
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=group),
        exec_result(scalar_one_or_none=None),
        # NotificationService.on_user_joined_group — no other members yet
        exec_result(scalars_all=[]),
    ]

    out = GroupService.join_group(db, "  abcinvite1  ", mock_user)
    assert out is group
    db.commit.assert_called_once()


def test_join_group_not_found(db, mock_user):
    db.execute.return_value = exec_result(scalar_one_or_none=None)

    with pytest.raises(HTTPException) as ei:
        GroupService.join_group(db, "missing", mock_user)
    assert ei.value.status_code == 404


def test_join_group_conflict_when_already_member(db, mock_user):
    mock_user.id = uuid.uuid4()
    group = Group(
        name="G",
        description=None,
        created_by=uuid.uuid4(),
        invite_code="same",
    )
    existing = GroupMember(
        group_id=group.id,
        user_id=mock_user.id,
        role=MemberRole.member,
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=group),
        exec_result(scalar_one_or_none=existing),
    ]
    with pytest.raises(HTTPException) as ei:
        GroupService.join_group(db, "same", mock_user)
    assert ei.value.status_code == 409


def test_get_group_success(db, mock_user):
    mock_user.id = uuid.uuid4()
    group = Group(
        name="G",
        description=None,
        created_by=uuid.uuid4(),
        invite_code="x",
    )
    membership = GroupMember(
        group_id=group.id,
        user_id=mock_user.id,
        role=MemberRole.member,
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=group),
        exec_result(scalar_one_or_none=membership),
    ]

    assert GroupService.get_group(db, group.id, mock_user) is group


def test_get_group_not_found(db, mock_user):
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    with pytest.raises(HTTPException) as ei:
        GroupService.get_group(db, uuid.uuid4(), mock_user)
    assert ei.value.status_code == 404


def test_get_group_forbidden_when_not_member(db, mock_user):
    mock_user.id = uuid.uuid4()
    group = Group(
        name="G",
        description=None,
        created_by=uuid.uuid4(),
        invite_code="x",
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=group),
        exec_result(scalar_one_or_none=None),
    ]

    with pytest.raises(HTTPException) as ei:
        GroupService.get_group(db, group.id, mock_user)
    assert ei.value.status_code == 403


def test_list_user_groups_returns_rows(db, mock_user):
    mock_user.id = uuid.uuid4()
    g1 = Group(
        name="A",
        description=None,
        created_by=mock_user.id,
        invite_code="a1",
    )
    db.execute.return_value = exec_result(scalars_all=[g1])

    rows = GroupService.list_user_groups(db, mock_user)
    assert rows == [g1]


def test_list_user_groups_empty(db, mock_user):
    db.execute.return_value = exec_result(scalars_all=[])
    assert GroupService.list_user_groups(db, mock_user) == []


def test_remove_member_success(db, mock_user):
    mock_user.id = uuid.uuid4()
    gid = uuid.uuid4()
    victim_id = uuid.uuid4()
    target = GroupMember(
        group_id=gid,
        user_id=victim_id,
        role=MemberRole.member,
    )
    admin_row = GroupMember(
        group_id=gid,
        user_id=mock_user.id,
        role=MemberRole.admin,
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=admin_row),
        exec_result(scalar_one_or_none=target),
        exec_result(scalar_one=2),
    ]

    GroupService.remove_member(db, gid, victim_id, mock_user)
    db.delete.assert_called_once_with(target)
    db.commit.assert_called_once()


def test_remove_member_forbidden_when_not_admin(db, mock_user):
    mock_user.id = uuid.uuid4()
    gid = uuid.uuid4()
    db.execute.return_value = exec_result(scalar_one_or_none=None)

    with pytest.raises(HTTPException) as ei:
        GroupService.remove_member(db, gid, uuid.uuid4(), mock_user)
    assert ei.value.status_code == 403


def test_remove_member_bad_request_when_only_admin_removes_self(db, mock_user):
    mock_user.id = uuid.uuid4()
    gid = uuid.uuid4()
    target = GroupMember(
        group_id=gid,
        user_id=mock_user.id,
        role=MemberRole.admin,
    )
    admin_check = GroupMember(
        group_id=gid,
        user_id=mock_user.id,
        role=MemberRole.admin,
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=admin_check),
        exec_result(scalar_one_or_none=target),
        exec_result(scalar_one=1),
    ]
    with pytest.raises(HTTPException) as ei:
        GroupService.remove_member(db, gid, mock_user.id, mock_user)
    assert ei.value.status_code == 400


def test_remove_member_not_found(db, mock_user):
    mock_user.id = uuid.uuid4()
    gid = uuid.uuid4()
    admin_row = GroupMember(
        group_id=gid,
        user_id=mock_user.id,
        role=MemberRole.admin,
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=admin_row),
        exec_result(scalar_one_or_none=None),
    ]
    with pytest.raises(HTTPException) as ei:
        GroupService.remove_member(db, gid, uuid.uuid4(), mock_user)
    assert ei.value.status_code == 404


def test_require_admin_no_op_when_admin(db):
    uid = uuid.uuid4()
    gid = uuid.uuid4()
    row = MagicMock()
    db.execute.return_value = exec_result(scalar_one_or_none=row)
    GroupService.require_admin(db, gid, uid)


def test_require_admin_forbidden(db):
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    with pytest.raises(HTTPException) as ei:
        GroupService.require_admin(db, uuid.uuid4(), uuid.uuid4())
    assert ei.value.status_code == 403


def test_regenerate_invite_code_success(db, mock_user):
    mock_user.id = uuid.uuid4()
    gid = uuid.uuid4()
    group = Group(
        name="G",
        description=None,
        created_by=mock_user.id,
        invite_code="oldcode",
    )
    admin_row = GroupMember(
        group_id=gid,
        user_id=mock_user.id,
        role=MemberRole.admin,
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=admin_row),
        exec_result(scalar_one_or_none=group),
        exec_result(scalar_one_or_none=None),
    ]

    out = GroupService.regenerate_invite_code(db, gid, mock_user)
    assert out is group
    assert out.invite_code != "oldcode"
    db.commit.assert_called_once()


def test_regenerate_invite_code_forbidden_when_not_admin(db, mock_user):
    mock_user.id = uuid.uuid4()
    gid = uuid.uuid4()
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    with pytest.raises(HTTPException) as ei:
        GroupService.regenerate_invite_code(db, gid, mock_user)
    assert ei.value.status_code == 403


def test_regenerate_invite_code_not_found(db, mock_user):
    mock_user.id = uuid.uuid4()
    gid = uuid.uuid4()
    admin_row = GroupMember(
        group_id=gid,
        user_id=mock_user.id,
        role=MemberRole.admin,
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=admin_row),
        exec_result(scalar_one_or_none=None),
    ]
    with pytest.raises(HTTPException) as ei:
        GroupService.regenerate_invite_code(db, gid, mock_user)
    assert ei.value.status_code == 404
