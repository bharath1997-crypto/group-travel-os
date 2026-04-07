"""
app/schemas/expense.py — Expense request and response schemas (Pydantic v2)
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ExpenseCreate(BaseModel):
    description: str = Field(..., min_length=1, max_length=300)
    amount: float = Field(..., gt=0)
    currency: str = Field(default="USD", max_length=3)
    split_with: list[UUID] = Field(default_factory=list)


class ExpenseSplitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    expense_id: UUID
    user_id: UUID
    amount: float
    is_settled: bool


class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    trip_id: UUID
    paid_by: UUID
    description: str
    amount: float
    currency: str
    created_at: datetime
    splits: list[ExpenseSplitOut] = []


class BalanceSummaryItem(BaseModel):
    from_user_id: UUID
    to_user_id: UUID
    amount: float


class SettleSplitRequest(BaseModel):
    """Empty body for PATCH settle — keeps OpenAPI consistent."""

    model_config = ConfigDict(extra="forbid")
