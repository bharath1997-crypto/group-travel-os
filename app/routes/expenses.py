"""
app/routes/expenses.py — Trip expense endpoints

Routes are thin: accept request, call service, return response.
"""
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.expense import (
    BalanceSummaryItem,
    ExpenseCreate,
    ExpenseOut,
    ExpenseSplitOut,
)
from app.services.expense_service import ExpenseService
from app.utils.auth import get_current_user
from app.utils.database import get_db

expenses_router = APIRouter(prefix="/trips", tags=["Expenses"])


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
    expense = ExpenseService.add_expense(
        db,
        trip_id,
        data.description,
        data.amount,
        data.currency,
        data.split_with,
        current_user,
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
