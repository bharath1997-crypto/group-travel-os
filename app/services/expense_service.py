"""
app/services/expense_service.py — Trip expenses and balance summary

Rules:
- Session is always injected — never created here
- All errors raised via AppException
- Balance lines are computed fresh for each request — never stored
"""
from __future__ import annotations

import csv
import io
import logging
import uuid
from collections import defaultdict
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.expense import Expense, ExpenseSplit
from app.models.group import Group, GroupMember, MemberRole
from app.models.trip import Trip
from app.models.user import User
from app.services.currency_service import convert_amount, get_exchange_rate
from app.services.trip_service import TripService
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)

_BALANCE_EPS = 1e-6
_MONEY_EPS = 0.02

_EXPENSE_CATEGORIES = frozenset(
    {
        "food",
        "transport",
        "accommodation",
        "entertainment",
        "shopping",
        "utilities",
        "medical",
        "other",
    }
)


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
    """Greedily settle net balances into pairwise transfers (amounts in same basis)."""
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


def _normalize_category(cat: str | None) -> str | None:
    if cat is None:
        return None
    t = str(cat).strip().lower()
    if not t:
        return None
    if t not in _EXPENSE_CATEGORIES:
        AppException.bad_request(
            f"Invalid category; use one of: {', '.join(sorted(_EXPENSE_CATEGORIES))}",
        )
    return t


def _rate_expense_to_inr(db: Session, exp: Expense) -> float:
    if exp.exchange_rate is not None:
        return float(exp.exchange_rate)
    cur = (exp.currency or "INR").strip().upper()
    if cur == "INR":
        return 1.0
    return get_exchange_rate(cur, "INR", db)


def _build_split_rows(
    db: Session,
    split_type: str,
    amount: float,
    currency: str,
    split_uids: list[uuid.UUID],
    split_lines: list[dict[str, Any]] | None,
    member_set: set[uuid.UUID],
) -> list[tuple[uuid.UUID, float, dict[str, Any | None]]]:
    """
    Returns list of (user_id, split_amount, kwargs for ExpenseSplit extra columns).
      kwargs: exact_amount, percentage, share_units, notes
    """
    st = (split_type or "equal").strip().lower()
    if st == "equal":
        if not split_uids:
            AppException.bad_request("There must be at least one person to split the expense")
        if len(split_uids) != len(set(split_uids)):
            AppException.bad_request("split_with cannot contain duplicate user ids")
        for uid in split_uids:
            if uid not in member_set:
                AppException.bad_request(
                    "All split participants must be members of the trip's group",
                )
        amounts = _split_amounts_equal(amount, len(split_uids))
        return [
            (u, a, {"exact_amount": None, "percentage": None, "share_units": None, "notes": None})
            for u, a in zip(split_uids, amounts, strict=True)
        ]

    if not split_lines:
        AppException.bad_request(f"split_type '{st}' requires split line items")

    lines_by_user: dict[uuid.UUID, dict[str, Any]] = {}
    for row in split_lines:
        uid = row["user_id"]
        if uid in lines_by_user:
            AppException.bad_request("Duplicate split line for the same user")
        if uid not in member_set:
            AppException.bad_request(
                "All split participants must be members of the trip's group",
            )
        lines_by_user[uid] = row

    uids = sorted(lines_by_user.keys(), key=lambda x: str(x))
    if st == "exact":
        total_exact = 0.0
        out: list[tuple[uuid.UUID, float, dict[str, Any | None]]] = []
        for uid in uids:
            row = lines_by_user[uid]
            ex = row.get("exact_amount")
            if ex is None:
                AppException.bad_request("exact_amount required for each participant")
            ex_f = float(ex)
            if ex_f < 0:
                AppException.bad_request("exact_amount must be non-negative")
            total_exact += ex_f
            note = row.get("notes")
            note_s = str(note)[:200] if note is not None else None
            out.append(
                (
                    uid,
                    round(ex_f, 2),
                    {
                        "exact_amount": round(ex_f, 2),
                        "percentage": None,
                        "share_units": None,
                        "notes": note_s,
                    },
                )
            )
        if not _money_close(total_exact, amount):
            AppException.bad_request("Exact amounts must sum to total")
        return out

    if st == "percentage":
        total_pct = 0.0
        out = []
        for uid in uids:
            row = lines_by_user[uid]
            p = row.get("percentage")
            if p is None:
                AppException.bad_request("percentage required for each participant")
            p_f = float(p)
            if p_f < 0:
                AppException.bad_request("percentage must be non-negative")
            total_pct += p_f
            note = row.get("notes")
            note_s = str(note)[:200] if note is not None else None
            out.append(
                (
                    uid,
                    0.0,
                    {
                        "exact_amount": None,
                        "percentage": p_f,
                        "share_units": None,
                        "notes": note_s,
                    },
                )
            )
        if not _money_close(total_pct, 100.0, eps=0.05):
            AppException.bad_request("Percentages must sum to 100")
        result: list[tuple[uuid.UUID, float, dict[str, Any | None]]] = []
        acc = 0.0
        for i, (uid, _, meta) in enumerate(out):
            if i == len(out) - 1:
                amt = round(amount - acc, 2)
            else:
                pct = float(meta["percentage"] or 0)
                amt = round(amount * (pct / 100.0), 2)
                acc += amt
            result.append((uid, amt, meta))
        return result

    if st == "shares":
        shares: list[tuple[uuid.UUID, float, dict[str, Any]]] = []
        for uid in uids:
            row = lines_by_user[uid]
            su = row.get("share_units")
            if su is None:
                AppException.bad_request("share_units required for each participant")
            su_f = float(su)
            if su_f <= 0:
                AppException.bad_request("share_units must be greater than zero")
            note = row.get("notes")
            note_s = str(note)[:200] if note is not None else None
            meta = {
                "exact_amount": None,
                "percentage": None,
                "share_units": su_f,
                "notes": note_s,
            }
            shares.append((uid, su_f, meta))
        total_shares = sum(s[1] for s in shares)
        result_shares: list[tuple[uuid.UUID, float, dict[str, Any | None]]] = []
        acc = 0.0
        for i, (uid, units, meta) in enumerate(shares):
            if i == len(shares) - 1:
                amt = round(amount - acc, 2)
            else:
                amt = round(amount * (units / total_shares), 2)
                acc += amt
            result_shares.append((uid, amt, meta))
        return result_shares

    AppException.bad_request(f"Unknown split_type: {split_type}")


def _money_close(a: float, b: float, eps: float = _MONEY_EPS) -> bool:
    return abs(float(a) - float(b)) <= eps


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
        *,
        split_type: str = "equal",
        split_lines: list[dict[str, Any]] | None = None,
        category: str | None = None,
        notes: str | None = None,
        receipt_url: str | None = None,
    ) -> Expense:
        if amount <= 0:
            AppException.bad_request("Expense amount must be greater than zero")

        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        TripService._verify_membership(db, trip.group_id, current_user.id)

        member_ids = _group_member_ids(db, trip.group_id)
        member_set = set(member_ids)

        cur = (currency or "INR").strip().upper()
        cat = _normalize_category(category)
        note_s = str(notes).strip()[:500] if notes else None
        rec_s = str(receipt_url).strip()[:500] if receipt_url else None
        st = (split_type or "equal").strip().lower()

        if not split_with and st == "equal":
            split_uids = list(member_ids)
        elif st == "equal":
            split_uids = list(split_with)
        else:
            split_uids = []

        rows = _build_split_rows(
            db, st, amount, cur, split_uids, split_lines, member_set
        )

        if cur == "INR":
            ex_rate = 1.0
        else:
            ex_rate = get_exchange_rate(cur, "INR", db)

        expense = Expense(
            trip_id=trip_id,
            paid_by=current_user.id,
            description=description,
            amount=amount,
            currency=cur,
            category=cat,
            notes=note_s,
            receipt_url=rec_s,
            split_type=st,
            exchange_rate=ex_rate,
            original_amount=amount,
        )
        db.add(expense)
        db.flush()

        for uid, split_amt, meta in rows:
            db.add(
                ExpenseSplit(
                    expense_id=expense.id,
                    user_id=uid,
                    amount=split_amt,
                    exact_amount=meta.get("exact_amount"),
                    percentage=meta.get("percentage"),
                    share_units=meta.get("share_units"),
                    notes=meta.get("notes"),
                )
            )

        db.commit()

        from app.services.notification_service import NotificationService

        NotificationService.on_expense_added(db, trip, expense, current_user)

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
    def get_simplified_debts(
        db: Session,
        trip_id: uuid.UUID,
        current_user: User,
    ) -> list[dict[str, Any]]:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")

        TripService._verify_membership(db, trip.group_id, current_user.id)

        group = db.execute(select(Group).where(Group.id == trip.group_id)).scalar_one()
        target_ccy = (group.default_currency or "INR").strip().upper()

        expenses = db.execute(
            select(Expense)
            .where(Expense.trip_id == trip_id)
            .options(selectinload(Expense.splits))
        ).scalars().all()

        net_inr: dict[uuid.UUID, float] = defaultdict(float)
        for exp in expenses:
            r = _rate_expense_to_inr(db, exp)
            amt_inr = exp.amount * r
            net_inr[exp.paid_by] += amt_inr
            for sp in exp.splits:
                net_inr[sp.user_id] -= sp.amount * r

        net_inr = {k: round(v, 4) for k, v in net_inr.items()}
        raw = _simplify_net_balances(net_inr)
        out: list[dict[str, Any]] = []
        for row in raw:
            amt_out = convert_amount(row["amount"], "INR", target_ccy, db)
            out.append(
                {
                    "from_user_id": row["from_user_id"],
                    "to_user_id": row["to_user_id"],
                    "amount": round(amt_out, 2),
                    "currency": target_ccy,
                }
            )
        return out

    @staticmethod
    def update_expense(
        db: Session,
        trip_id: uuid.UUID,
        expense_id: uuid.UUID,
        current_user: User,
        *,
        description: str | None = None,
        amount: float | None = None,
        notes: str | None = None,
        category: str | None = None,
        currency: str | None = None,
    ) -> Expense:
        expense = db.execute(
            select(Expense)
            .where(Expense.id == expense_id)
            .options(selectinload(Expense.splits))
        ).scalar_one_or_none()
        if not expense or expense.trip_id != trip_id:
            AppException.not_found("Expense not found")

        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one()
        TripService._verify_membership(db, trip.group_id, current_user.id)

        if expense.paid_by != current_user.id and not _is_group_admin(
            db, trip.group_id, current_user.id
        ):
            AppException.forbidden("Only the payer or a group admin can edit this expense")

        if all(
            v is None
            for v in (description, amount, notes, category, currency)
        ):
            AppException.bad_request("No fields to update")

        old_amt = expense.amount
        if description is not None:
            expense.description = description.strip()[:300]
        if notes is not None:
            expense.notes = str(notes).strip()[:500] or None
        if category is not None:
            expense.category = _normalize_category(category)

        cur_changed = False
        if currency is not None:
            expense.currency = currency.strip().upper()[:10]
            cur_changed = True

        if amount is not None:
            if amount <= 0:
                AppException.bad_request("Expense amount must be greater than zero")
            expense.amount = amount
        if cur_changed or amount is not None:
            expense.original_amount = expense.amount
            c = expense.currency.strip().upper()
            if c == "INR":
                expense.exchange_rate = 1.0
            else:
                expense.exchange_rate = get_exchange_rate(c, "INR", db)

        if amount is not None and old_amt > 0 and not _money_close(old_amt, amount):
            factor = amount / old_amt
            for sp in expense.splits:
                sp.amount = round(sp.amount * factor, 2)
            total = sum(sp.amount for sp in expense.splits)
            if expense.splits and not _money_close(total, amount):
                last = expense.splits[-1]
                last.amount = round(last.amount + (amount - total), 2)

        db.commit()
        out = db.execute(
            select(Expense)
            .where(Expense.id == expense.id)
            .options(selectinload(Expense.splits))
        ).scalar_one()
        logger.info("Expense updated: %s", expense_id)
        return out

    @staticmethod
    def get_expense_category_summary(
        db: Session,
        trip_id: uuid.UUID,
        current_user: User,
    ) -> list[dict[str, Any]]:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")
        TripService._verify_membership(db, trip.group_id, current_user.id)
        group = db.execute(select(Group).where(Group.id == trip.group_id)).scalar_one()
        target_ccy = (group.default_currency or "INR").strip().upper()

        rows = db.execute(select(Expense).where(Expense.trip_id == trip_id)).scalars().all()
        totals_inr: dict[str, float] = defaultdict(float)
        counts: dict[str, int] = defaultdict(int)
        for exp in rows:
            cat = (exp.category or "other").strip().lower() or "other"
            r = _rate_expense_to_inr(db, exp)
            totals_inr[cat] += exp.amount * r
            counts[cat] += 1

        out: list[dict[str, Any]] = []
        for cat in sorted(totals_inr.keys()):
            amt = convert_amount(totals_inr[cat], "INR", target_ccy, db)
            out.append(
                {
                    "category": cat,
                    "total": round(amt, 2),
                    "currency": target_ccy,
                    "expense_count": counts[cat],
                }
            )
        return out

    @staticmethod
    def export_expenses_csv(
        db: Session,
        trip_id: uuid.UUID,
        current_user: User,
    ) -> str:
        trip = db.execute(select(Trip).where(Trip.id == trip_id)).scalar_one_or_none()
        if not trip:
            AppException.not_found("Trip not found")
        TripService._verify_membership(db, trip.group_id, current_user.id)

        users = db.execute(select(User)).scalars().all()
        id_to_name = {u.id: u.full_name or "" for u in users}

        expenses = db.execute(
            select(Expense)
            .where(Expense.trip_id == trip_id)
            .order_by(Expense.created_at.asc())
        ).scalars().all()

        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(
            [
                "Date",
                "Description",
                "Amount",
                "Currency",
                "Category",
                "Paid By",
                "Split Type",
            ]
        )
        for exp in expenses:
            paid_name = id_to_name.get(exp.paid_by, str(exp.paid_by))
            w.writerow(
                [
                    exp.created_at.isoformat() if exp.created_at else "",
                    exp.description,
                    exp.amount,
                    exp.currency,
                    exp.category or "",
                    paid_name,
                    exp.split_type,
                ]
            )
        return buf.getvalue()

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
