"""Unit tests for app.services.expense_service.ExpenseService — mocked Session only."""
from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException

from app.models.expense import Expense, ExpenseSplit
from app.models.group import GroupMember, MemberRole
from app.models.trip import Trip, TripStatus
from app.services.expense_service import ExpenseService
from tests.conftest import exec_result


def _member(gid: uuid.UUID, uid: uuid.UUID) -> GroupMember:
    return GroupMember(group_id=gid, user_id=uid, role=MemberRole.member)


def test_add_expense_success_splits_all_members(db, mock_user):
    mock_user.id = uuid.uuid4()
    uid_other = uuid.uuid4()
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
    n = {"i": 0}

    def se(_stmt=None):
        n["i"] += 1
        if n["i"] == 1:
            return exec_result(scalar_one_or_none=trip)
        if n["i"] == 2:
            return exec_result(scalar_one_or_none=_member(gid, mock_user.id))
        if n["i"] == 3:
            return exec_result(scalars_all=[mock_user.id, uid_other])
        if n["i"] == 4:
            expense = db.add.call_args_list[0][0][0]
            splits = [c[0][0] for c in db.add.call_args_list[1:]]
            expense.splits = splits
            return exec_result(scalar_one=expense)
        raise AssertionError("unexpected execute")

    db.execute.side_effect = se

    out = ExpenseService.add_expense(
        db,
        trip.id,
        "Lunch",
        30.0,
        "USD",
        [],
        mock_user,
    )
    assert out.amount == 30.0
    assert len(out.splits) == 2
    db.commit.assert_called_once()


def test_add_expense_bad_request_non_positive_amount(db, mock_user):
    with pytest.raises(HTTPException) as ei:
        ExpenseService.add_expense(
            db,
            uuid.uuid4(),
            "x",
            0.0,
            "USD",
            [],
            mock_user,
        )
    assert ei.value.status_code == 400


def test_add_expense_split_user_not_in_group(db, mock_user):
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
    insider = uuid.uuid4()
    outsider = uuid.uuid4()
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),
        exec_result(scalar_one_or_none=_member(gid, mock_user.id)),
        exec_result(scalars_all=[insider]),
    ]
    with pytest.raises(HTTPException) as ei:
        ExpenseService.add_expense(
            db,
            trip.id,
            "Dinner",
            20.0,
            "USD",
            [insider, outsider],
            mock_user,
        )
    assert ei.value.status_code == 400


def test_list_trip_expenses_success(db, mock_user):
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
    exp = Expense(
        trip_id=trip.id,
        paid_by=mock_user.id,
        description="x",
        amount=1.0,
        currency="USD",
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),
        exec_result(scalar_one_or_none=_member(gid, mock_user.id)),
        exec_result(scalars_all=[exp]),
    ]
    rows = ExpenseService.list_trip_expenses(db, trip.id, mock_user)
    assert rows == [exp]


def test_list_trip_expenses_trip_not_found(db, mock_user):
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    with pytest.raises(HTTPException) as ei:
        ExpenseService.list_trip_expenses(db, uuid.uuid4(), mock_user)
    assert ei.value.status_code == 404


def test_get_trip_balance_summary_success(db, mock_user):
    mock_user.id = uuid.uuid4()
    other = uuid.uuid4()
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
    exp = Expense(
        trip_id=trip.id,
        paid_by=mock_user.id,
        description="hotel",
        amount=100.0,
        currency="USD",
    )
    s_self = ExpenseSplit(expense_id=exp.id, user_id=mock_user.id, amount=50.0)
    s_other = ExpenseSplit(expense_id=exp.id, user_id=other, amount=50.0)
    exp.splits = [s_self, s_other]
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=trip),
        exec_result(scalar_one_or_none=_member(gid, mock_user.id)),
        exec_result(scalars_all=[exp]),
    ]
    lines = ExpenseService.get_trip_balance_summary(db, trip.id, mock_user)
    assert any(
        line["from_user_id"] == other and line["to_user_id"] == mock_user.id
        for line in lines
    )


def test_get_trip_balance_summary_trip_not_found(db, mock_user):
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    with pytest.raises(HTTPException) as ei:
        ExpenseService.get_trip_balance_summary(db, uuid.uuid4(), mock_user)
    assert ei.value.status_code == 404


def test_mark_split_settled_success_as_oweing_user(db, mock_user):
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
    payer = uuid.uuid4()
    exp = Expense(
        trip_id=trip.id,
        paid_by=payer,
        description="x",
        amount=10.0,
        currency="USD",
    )
    split = ExpenseSplit(
        expense_id=exp.id,
        user_id=mock_user.id,
        amount=10.0,
        is_settled=False,
    )
    split.expense = exp
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=split),
        exec_result(scalar_one=trip),
        exec_result(scalar_one_or_none=_member(gid, mock_user.id)),
    ]
    out = ExpenseService.mark_split_settled(db, trip.id, split.id, mock_user)
    assert out.is_settled is True
    db.commit.assert_called_once()


def test_mark_split_settled_not_found(db, mock_user):
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    with pytest.raises(HTTPException) as ei:
        ExpenseService.mark_split_settled(db, uuid.uuid4(), uuid.uuid4(), mock_user)
    assert ei.value.status_code == 404


def test_mark_split_settled_forbidden(db, mock_user):
    mock_user.id = uuid.uuid4()
    stranger = uuid.uuid4()
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
    exp = Expense(
        trip_id=trip.id,
        paid_by=stranger,
        description="x",
        amount=10.0,
        currency="USD",
    )
    split = ExpenseSplit(expense_id=exp.id, user_id=stranger, amount=10.0)
    split.expense = exp
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=split),
        exec_result(scalar_one=trip),
        exec_result(scalar_one_or_none=_member(gid, mock_user.id)),
    ]
    with pytest.raises(HTTPException) as ei:
        ExpenseService.mark_split_settled(db, trip.id, split.id, mock_user)
    assert ei.value.status_code == 403


def test_delete_expense_success_as_payer(db, mock_user):
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
    exp = Expense(
        trip_id=trip.id,
        paid_by=mock_user.id,
        description="x",
        amount=5.0,
        currency="USD",
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=exp),
        exec_result(scalar_one=trip),
        exec_result(scalar_one_or_none=_member(gid, mock_user.id)),
    ]
    ExpenseService.delete_expense(db, trip.id, exp.id, mock_user)
    db.delete.assert_called_once_with(exp)


def test_delete_expense_forbidden(db, mock_user):
    mock_user.id = uuid.uuid4()
    payer = uuid.uuid4()
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
    exp = Expense(
        trip_id=trip.id,
        paid_by=payer,
        description="x",
        amount=5.0,
        currency="USD",
    )
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=exp),
        exec_result(scalar_one=trip),
        exec_result(scalar_one_or_none=_member(gid, mock_user.id)),
        exec_result(scalar_one_or_none=None),
    ]
    with pytest.raises(HTTPException) as ei:
        ExpenseService.delete_expense(db, trip.id, exp.id, mock_user)
    assert ei.value.status_code == 403


def test_delete_expense_not_found(db, mock_user):
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    with pytest.raises(HTTPException) as ei:
        ExpenseService.delete_expense(db, uuid.uuid4(), uuid.uuid4(), mock_user)
    assert ei.value.status_code == 404
