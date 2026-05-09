from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel

class TravelCurrencyInfo(BaseModel):
    destination_currency: str
    user_currency: str
    rate: float  # destination_to_user: 1 dest = X user
    inverse_rate: float # user_to_dest: 1 user = X dest
    symbol: str

class TravelSafetyInfo(BaseModel):
    score: float
    level: str
    description: str
    updated_at: str

class TravelInfoBundle(BaseModel):
    city: str
    country_code: str
    safety: Optional[TravelSafetyInfo]
    currency: Optional[TravelCurrencyInfo]
