"""
app/schemas/expense.py — Expense request and response schemas (Pydantic v2)
"""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ExpenseSplitLineIn(BaseModel):
    user_id: UUID
    exact_amount: float | None = None
    percentage: float | None = None
    share_units: float | None = None
    notes: str | None = Field(None, max_length=200)


class ExpenseCreate(BaseModel):
    description: str = Field(..., min_length=1, max_length=300)
    amount: float = Field(..., gt=0)
    currency: str = Field(default="INR", min_length=3, max_length=10)
    split_with: list[UUID] = Field(default_factory=list)
    split_type: Literal["equal", "exact", "percentage", "shares"] = "equal"
    splits: list[ExpenseSplitLineIn] = Field(default_factory=list)
    category: str | None = Field(None, max_length=50)
    notes: str | None = Field(None, max_length=500)
    receipt_url: str | None = Field(None, max_length=500)


class ExpenseUpdate(BaseModel):
    description: str | None = Field(None, min_length=1, max_length=300)
    amount: float | None = Field(None, gt=0)
    notes: str | None = Field(None, max_length=500)
    category: str | None = Field(None, max_length=50)
    currency: str | None = Field(None, min_length=3, max_length=10)


class ExpenseSplitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    expense_id: UUID
    user_id: UUID
    amount: float
    is_settled: bool
    share_units: float | None = None
    percentage: float | None = None
    exact_amount: float | None = None
    notes: str | None = None


class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    trip_id: UUID
    paid_by: UUID
    description: str
    amount: float
    currency: str
    category: str | None = None
    notes: str | None = None
    receipt_url: str | None = None
    split_type: str = "equal"
    exchange_rate: float | None = None
    original_amount: float | None = None
    created_at: datetime
    splits: list[ExpenseSplitOut] = []


class BalanceSummaryItem(BaseModel):
    from_user_id: UUID
    to_user_id: UUID
    amount: float


class SimplifiedDebtItem(BaseModel):
    from_user_id: UUID
    to_user_id: UUID
    amount: float
    currency: str


class ExpenseCategorySummaryRow(BaseModel):
    category: str
    total: float
    currency: str
    expense_count: int


class ExchangeRateOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    rate: float
    from_curr: str = Field(serialization_alias="from")
    to: str = Field(serialization_alias="to")


class CurrencyRow(BaseModel):
    code: str
    name: str
    symbol: str


class SettleSplitRequest(BaseModel):
    """Empty body for PATCH settle — keeps OpenAPI consistent."""

    model_config = ConfigDict(extra="forbid")
