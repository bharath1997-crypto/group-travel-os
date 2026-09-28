"""Ride cost engine — server-side price cap enforcement (legal spine)."""
from __future__ import annotations

import math
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.seats import FuelPrice
from app.utils.exceptions import AppException

DEFAULT_REGION = "IN-MH"


@dataclass(frozen=True)
class CostBasis:
    distance_km: float
    fuel_rate_paise_per_l: int
    mileage_kmpl: float
    fuel_paise: int
    tolls_paise: int
    tolls_estimated: bool
    cost_total_paise: int
    max_per_seat_paise: int
    seats_offered: int
    region_code: str
    computed_at: str
    tolls: list[dict[str, Any]]

    def to_dict(self) -> dict[str, Any]:
        return {
            "distance_km": self.distance_km,
            "fuel_rate_paise_per_l": self.fuel_rate_paise_per_l,
            "mileage_kmpl": self.mileage_kmpl,
            "fuel_paise": self.fuel_paise,
            "tolls_paise": self.tolls_paise,
            "tolls_estimated": self.tolls_estimated,
            "cost_total_paise": self.cost_total_paise,
            "max_per_seat_paise": self.max_per_seat_paise,
            "seats_offered": self.seats_offered,
            "region_code": self.region_code,
            "computed_at": self.computed_at,
            "tolls": self.tolls,
        }


def format_money(paise: int) -> dict[str, int | str]:
    rupees = paise // 100
    display = f"₹{rupees:,}"
    return {"amount_paise": paise, "display": display}


def lookup_fuel_config(
    db: Session,
    region: str,
    on_date: date | None = None,
) -> FuelPrice:
    ref = on_date or datetime.now(timezone.utc).date()
    row = db.execute(
        select(FuelPrice)
        .where(
            FuelPrice.region_code == region,
            FuelPrice.effective_from <= ref,
        )
        .order_by(FuelPrice.effective_from.desc())
        .limit(1)
    ).scalar_one_or_none()
    if row is None:
        AppException.unprocessable(f"No fuel config for region {region}")
    return row


def compute_cost(
    *,
    distance_km: float,
    mileage_kmpl: float,
    tolls_paise: int | None,
    seats_offered: int,
    region: str,
    fuel_rate_paise_per_l: int,
    toll_fallback_paise_per_km: int,
) -> CostBasis:
    if distance_km <= 0:
        AppException.bad_request("distance_km must be positive")
    if mileage_kmpl <= 0:
        AppException.bad_request("mileage_kmpl must be positive")
    if seats_offered < 1:
        AppException.bad_request("seats_offered must be at least 1")

    litres = distance_km / mileage_kmpl
    fuel_paise = int(math.ceil(litres * fuel_rate_paise_per_l))

    tolls_estimated = False
    toll_items: list[dict[str, Any]] = []
    if tolls_paise is None:
        tolls_paise = int(math.ceil(distance_km * toll_fallback_paise_per_km))
        tolls_estimated = True
        toll_items.append(
            {"label": "Estimated tolls (per-km fallback)", "amount_paise": tolls_paise}
        )
    else:
        toll_items.append({"label": "Tolls", "amount_paise": tolls_paise})

    cost_total_paise = fuel_paise + tolls_paise
    max_per_seat_paise = math.ceil(cost_total_paise / (seats_offered + 1))

    return CostBasis(
        distance_km=round(distance_km, 2),
        fuel_rate_paise_per_l=fuel_rate_paise_per_l,
        mileage_kmpl=mileage_kmpl,
        fuel_paise=fuel_paise,
        tolls_paise=tolls_paise,
        tolls_estimated=tolls_estimated,
        cost_total_paise=cost_total_paise,
        max_per_seat_paise=max_per_seat_paise,
        seats_offered=seats_offered,
        region_code=region,
        computed_at=datetime.now(timezone.utc).isoformat(),
        tolls=toll_items,
    )


def compute_cost_for_region(
    db: Session,
    *,
    distance_km: float,
    mileage_kmpl: float,
    tolls_paise: int | None,
    seats_offered: int,
    region: str = DEFAULT_REGION,
) -> CostBasis:
    cfg = lookup_fuel_config(db, region)
    return compute_cost(
        distance_km=distance_km,
        mileage_kmpl=mileage_kmpl,
        tolls_paise=tolls_paise,
        seats_offered=seats_offered,
        region=region,
        fuel_rate_paise_per_l=cfg.fuel_rate_paise_per_l,
        toll_fallback_paise_per_km=cfg.toll_fallback_paise_per_km,
    )


def assert_price_within_cap(price_per_seat_paise: int, basis: CostBasis) -> None:
    if price_per_seat_paise > basis.max_per_seat_paise:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Price exceeds legal cost-sharing cap",
                "max_per_seat_paise": basis.max_per_seat_paise,
                "max_per_seat": format_money(basis.max_per_seat_paise),
                "cost_basis": basis.to_dict(),
            },
        )


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance for route length when no routing engine."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return r * 2 * math.asin(math.sqrt(a))


def route_distance_km(stops: list[tuple[float, float]]) -> float:
    if len(stops) < 2:
        AppException.bad_request("At least two stops required")
    total = 0.0
    for i in range(len(stops) - 1):
        total += haversine_km(stops[i][0], stops[i][1], stops[i + 1][0], stops[i + 1][1])
    return round(total, 2)
