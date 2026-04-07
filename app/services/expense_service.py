"""
app/services/expense_service.py — Trip expenses and balance summary

Rules:
- Session is always injected — never created here
- All errors raised via AppException
- Balance lines are computed fresh for each request — never stored
"""
from __future__ import annotations

import logging
import uuid
from collections import defaultdict
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.expense import Expense, ExpenseSplit
from app.models.group import GroupMember, MemberRole
from app.models.trip import Trip
from app.models.user import User
from app.services.trip_service import TripService
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)

_BALANCE_EPS = 1e-6


def _group_member_ids(db: Session, group_id: uuid.UUID) -> list[uuid.UUID]:
    rows = db.execute(
        select(GroupMember.user_id).where(GroupMember.group_id == group_id)
    ).scalars().all()
    return list(rows)


def _split_amounts_equal(amount: float, n: int) -> list[float]:
    if n <= 0:
        return []
    per = round(amount / n, 2)
    out: list[float] = []
    acc = 0.0
    for i in range(n):
        if i == n - 1:
            out.append(round(amount - acc, 2))
        else:
            out.append(per)
            acc += per
    return out


def _simplify_net_balances(net: dict[uuid.UUID, float]) -> list[dict[str, Any]]:
    """Turn per-user net (paid - owed) into pairwise debts: from_user owes to_user."""
    debtors: list[tuple[uuid.UUID, float]] = []
    creditors: list[tuple[uuid.UUID, float]] = []
    for uid, bal in net.items():
        if bal < -_BALANCE_EPS:
            debtors.append((uid, -bal))
        elif bal > _BALANCE_EPS:
            creditors.append((uid, bal))
    debtors.sort(key=lambda x: x[1], reverse=True)
    creditors.sort(key=lambda x: x[1], reverse=True)

    result: list[dict[str, Any]] = []
    i, j = 0, 0
    while i < len(debtors) and j < len(creditors):
        du, d_amt = debtors[i]
        cu, c_amt = creditors[j]
        pay = min(d_amt, c_amt)
        if pay > _BALANCE_EPS:
            result.append(
                {
                    "from_user_id": du,
                    "to_user_id": cu,
                    "amount": round(pay, 2),
                }
            )
        d_amt -= pay
        c_amt -= pay
        if d_amt <= _BALANCE_EPS:
            i += 1
        else:
            debtors[i] = (du, d_amt)
        if c_amt <= _BALANCE_EPS:
            j += 1
        else:
            creditors[j] = (cu, c_amt)
    return result


def _is_group_admin(db: Session, group_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    row = db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
            GroupMember.role == MemberRole.admin,
        )
    ).scalar_one_or_none()
    return row is not None


class ExpenseService:

    @staticmethod
    def add_expense(
        db: Session,
        trip_id: uuid.UUID,
        description: str,
        amount: float,
        currency: str,
        split_with: list[uuid.UUID],
        current_user: User,
    ) -> Expense:
        if amount <= 0:
            AppException.bad_request("Expense amount must be greater than zero")

        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        TripService._verify_membership(db, trip.group_id, current_user.id)

        member_ids = _group_member_ids(db, trip.group_id)
        member_set = set(member_ids)

        if not split_with:
            split_uids = list(member_ids)
        else:
            split_uids = split_with

        if len(split_uids) < 1:
            AppException.bad_request("There must be at least one person to split the expense")

        if len(split_uids) != len(set(split_uids)):
            AppException.bad_request("split_with cannot contain duplicate user ids")

        for uid in split_uids:
            if uid not in member_set:
                AppException.bad_request(
                    "All split participants must be members of the trip's group",
                )

        amounts = _split_amounts_equal(amount, len(split_uids))

        expense = Expense(
            trip_id=trip_id,
            paid_by=current_user.id,
            description=description,
            amount=amount,
            currency=currency or "USD",
        )
        db.add(expense)
        db.flush()

        for uid, split_amt in zip(split_uids, amounts, strict=True):
            db.add(
                ExpenseSplit(
                    expense_id=expense.id,
                    user_id=uid,
                    amount=split_amt,
                )
            )

        db.commit()

        out = db.execute(
            select(Expense)
            .where(Expense.id == expense.id)
            .options(selectinload(Expense.splits))
        ).scalar_one()
        logger.info("Expense added: %s trip %s", out.id, trip_id)
        return out

    @staticmethod
    def list_trip_expenses(
        db: Session,
        trip_id: uuid.UUID,
        current_user: User,
    ) -> list[Expense]:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        TripService._verify_membership(db, trip.group_id, current_user.id)

        rows = db.execute(
            select(Expense)
            .where(Expense.trip_id == trip_id)
            .options(selectinload(Expense.splits))
            .order_by(Expense.created_at.desc())
        ).scalars().all()
        return list(rows)

    @staticmethod
    def get_trip_balance_summary(
        db: Session,
        trip_id: uuid.UUID,
        current_user: User,
    ) -> list[dict[str, Any]]:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        TripService._verify_membership(db, trip.group_id, current_user.id)

        expenses = db.execute(
            select(Expense)
            .where(Expense.trip_id == trip_id)
            .options(selectinload(Expense.splits))
        ).scalars().all()

        paid: dict[uuid.UUID, float] = defaultdict(float)
        owed: dict[uuid.UUID, float] = defaultdict(float)

        for exp in expenses:
            paid[exp.paid_by] += exp.amount
            for sp in exp.splits:
                owed[sp.user_id] += sp.amount

        all_users = set(paid) | set(owed)
        net: dict[uuid.UUID, float] = {
            u: round(paid.get(u, 0.0) - owed.get(u, 0.0), 2) for u in all_users
        }

        return _simplify_net_balances(net)

    @staticmethod
    def mark_split_settled(
        db: Session,
        trip_id: uuid.UUID,
        split_id: uuid.UUID,
        current_user: User,
    ) -> ExpenseSplit:
        split = db.execute(
            select(ExpenseSplit)
            .where(ExpenseSplit.id == split_id)
            .options(selectinload(ExpenseSplit.expense))
        ).scalar_one_or_none()
        if not split:
            AppException.not_found("Expense split not found")

        exp = split.expense
        if exp.trip_id != trip_id:
            AppException.not_found("Expense split not found for this trip")

        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one()
        TripService._verify_membership(db, trip.group_id, current_user.id)

        if split.user_id != current_user.id and exp.paid_by != current_user.id:
            AppException.forbidden(
                "Only the participant who owes this share or the payer can mark it settled",
            )

        split.is_settled = True
        db.commit()
        db.refresh(split)
        logger.info("ExpenseSplit %s marked settled", split_id)
        return split

    @staticmethod
    def delete_expense(
        db: Session,
        trip_id: uuid.UUID,
        expense_id: uuid.UUID,
        current_user: User,
    ) -> None:
        expense = db.execute(
            select(Expense).where(Expense.id == expense_id)
        ).scalar_one_or_none()
        if not expense:
            AppException.not_found("Expense not found")

        if expense.trip_id != trip_id:
            AppException.not_found("Expense not found for this trip")

        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one()
        TripService._verify_membership(db, trip.group_id, current_user.id)

        if expense.paid_by != current_user.id and not _is_group_admin(
            db, trip.group_id, current_user.id
        ):
            AppException.forbidden("Only the payer or a group admin can delete this expense")

        db.delete(expense)
        db.commit()
        logger.info("Expense deleted: %s", expense_id)
