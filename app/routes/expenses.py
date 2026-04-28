"""
app/routes/expenses.py — Trip expense endpoints

Routes are thin: accept request, call service, return response.
"""
import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.expense import (
    BalanceSummaryItem,
    CurrencyRow,
    ExchangeRateOut,
    ExpenseCategorySummaryRow,
    ExpenseCreate,
    ExpenseOut,
    ExpenseSplitOut,
    ExpenseUpdate,
    SimplifiedDebtItem,
)
from app.services.currency_service import get_all_currencies, get_exchange_rate
from app.services.expense_service import ExpenseService
from app.utils.auth import get_current_user
from app.utils.database import get_db

expenses_router = APIRouter(prefix="/trips", tags=["Expenses"])

currencies_router = APIRouter(prefix="/currencies", tags=["Currencies"])


@currencies_router.get(
    "",
    response_model=list[CurrencyRow],
    status_code=status.HTTP_200_OK,
    summary="Supported currencies (code, name, symbol)",
)
def list_currencies():
    return get_all_currencies()


@currencies_router.get(
    "/rate",
    response_model=ExchangeRateOut,
    status_code=status.HTTP_200_OK,
    summary="Exchange rate between two currency codes",
)
def get_currency_rate(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    from_currency: str = Query(..., alias="from", min_length=3, max_length=10),
    to_currency: str = Query(..., alias="to", min_length=3, max_length=10),
):
    fr = from_currency.strip().upper()
    to = to_currency.strip().upper()
    rate = get_exchange_rate(fr, to, db)
    return ExchangeRateOut(rate=rate, from_curr=fr, to=to)


@expenses_router.post(
    "/{trip_id}/expenses",
    response_model=ExpenseOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add an expense to a trip",
)
def add_expense(
    trip_id: uuid.UUID,
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lines = [s.model_dump() for s in data.splits] if data.splits else None
    expense = ExpenseService.add_expense(
        db,
        trip_id,
        data.description,
        data.amount,
        data.currency,
        data.split_with,
        current_user,
        split_type=data.split_type,
        split_lines=lines,
        category=data.category,
        notes=data.notes,
        receipt_url=data.receipt_url,
    )
    return expense


@expenses_router.get(
    "/{trip_id}/expenses",
    response_model=list[ExpenseOut],
    status_code=status.HTTP_200_OK,
    summary="List expenses for a trip",
)
def list_trip_expenses(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ExpenseService.list_trip_expenses(db, trip_id, current_user)


@expenses_router.get(
    "/{trip_id}/expenses/summary",
    response_model=list[BalanceSummaryItem],
    status_code=status.HTTP_200_OK,
    summary="Simplified balance summary for a trip",
)
def get_trip_balance_summary(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = ExpenseService.get_trip_balance_summary(db, trip_id, current_user)
    return [BalanceSummaryItem.model_validate(r) for r in rows]


@expenses_router.get(
    "/{trip_id}/expenses/simplified-debts",
    response_model=list[SimplifiedDebtItem],
    status_code=status.HTTP_200_OK,
    summary="Splitwise-style minimum transfers to settle (in group default currency)",
)
def get_simplified_debts(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = ExpenseService.get_simplified_debts(db, trip_id, current_user)
    return [SimplifiedDebtItem.model_validate(r) for r in rows]


@expenses_router.get(
    "/{trip_id}/expenses/summary/category",
    response_model=list[ExpenseCategorySummaryRow],
    status_code=status.HTTP_200_OK,
    summary="Expense totals grouped by category",
)
def get_expense_category_summary(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = ExpenseService.get_expense_category_summary(db, trip_id, current_user)
    return [ExpenseCategorySummaryRow.model_validate(r) for r in rows]


@expenses_router.get(
    "/{trip_id}/expenses/export",
    status_code=status.HTTP_200_OK,
    summary="Export trip expenses as CSV",
    response_class=Response,
)
def export_trip_expenses(
    trip_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    csv_data = ExpenseService.export_expenses_csv(db, trip_id, current_user)
    return Response(
        content=csv_data.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="trip-expenses.csv"',
        },
    )


@expenses_router.patch(
    "/{trip_id}/expenses/{expense_id}",
    response_model=ExpenseOut,
    status_code=status.HTTP_200_OK,
    summary="Update an expense",
)
def update_expense(
    trip_id: uuid.UUID,
    expense_id: uuid.UUID,
    data: ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expense = ExpenseService.update_expense(
        db,
        trip_id,
        expense_id,
        current_user,
        description=data.description,
        amount=data.amount,
        notes=data.notes,
        category=data.category,
        currency=data.currency,
    )
    return expense


@expenses_router.patch(
    "/{trip_id}/expenses/splits/{split_id}/settle",
    response_model=ExpenseSplitOut,
    status_code=status.HTTP_200_OK,
    summary="Mark an expense split as settled",
)
def mark_split_settled(
    trip_id: uuid.UUID,
    split_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    split = ExpenseService.mark_split_settled(db, trip_id, split_id, current_user)
    return split


@expenses_router.delete(
    "/{trip_id}/expenses/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an expense",
)
def delete_expense(
    trip_id: uuid.UUID,
    expense_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ExpenseService.delete_expense(db, trip_id, expense_id, current_user)
