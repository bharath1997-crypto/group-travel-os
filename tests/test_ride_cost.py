"""Unit tests for ride cost engine — no DB required for arithmetic."""
from __future__ import annotations

import math
from datetime import date
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.models.seats import FuelPrice
from app.services.ride_cost_service import (
    compute_cost,
    compute_cost_for_region,
    lookup_fuel_config,
    route_distance_km,
)
from tests.conftest import exec_result


def test_cap_arithmetic_plus_one_divisor():
    basis = compute_cost(
        distance_km=150.0,
        mileage_kmpl=15.0,
        tolls_paise=50000,
        seats_offered=3,
        region="IN-MH",
        fuel_rate_paise_per_l=10500,
        toll_fallback_paise_per_km=180,
    )
    litres = 150.0 / 15.0
    fuel = int(math.ceil(litres * 10500))
    total = fuel + 50000
    assert basis.cost_total_paise == total
    assert basis.max_per_seat_paise == math.ceil(total / (3 + 1))


def test_missing_toll_fallback():
    basis = compute_cost(
        distance_km=100.0,
        mileage_kmpl=12.0,
        tolls_paise=None,
        seats_offered=2,
        region="IN-MH",
        fuel_rate_paise_per_l=10000,
        toll_fallback_paise_per_km=200,
    )
    assert basis.tolls_estimated is True
    assert basis.tolls_paise == 20000


def test_config_lookup_by_date(db):
    cfg = FuelPrice(
        region_code="IN-MH",
        effective_from=date(2026, 1, 1),
        fuel_rate_paise_per_l=10500,
        toll_fallback_paise_per_km=180,
    )
    db.execute.return_value = exec_result(scalar_one_or_none=cfg)
    row = lookup_fuel_config(db, "IN-MH", on_date=date(2026, 6, 1))
    assert row.fuel_rate_paise_per_l == 10500


def test_publish_above_cap_raises_422():
    from app.services.ride_cost_service import assert_price_within_cap, CostBasis

    basis = CostBasis(
        distance_km=100,
        fuel_rate_paise_per_l=10000,
        mileage_kmpl=15,
        fuel_paise=70000,
        tolls_paise=10000,
        tolls_estimated=False,
        cost_total_paise=80000,
        max_per_seat_paise=40000,
        seats_offered=1,
        region_code="IN-MH",
        computed_at="2026-01-01T00:00:00Z",
        tolls=[],
    )
    with pytest.raises(HTTPException) as ei:
        assert_price_within_cap(50000, basis)
    assert ei.value.status_code == 422
    assert ei.value.detail["max_per_seat_paise"] == 40000


def test_route_distance_requires_two_stops():
    from fastapi import HTTPException

    with pytest.raises(HTTPException):
        route_distance_km([(19.0, 72.0)])
