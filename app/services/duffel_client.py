"""Duffel REST API v2 client (Python SDK pins deprecated v1)."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from config import settings

logger = logging.getLogger(__name__)

DUFFEL_API_BASE = "https://api.duffel.com"
DUFFEL_API_VERSION = "v2"


def _api_key() -> str:
    key = (settings.duffel_api_key or "").strip()
    if not key:
        raise ValueError("DUFFEL_API_KEY is not configured")
    return key


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_api_key()}",
        "Duffel-Version": DUFFEL_API_VERSION,
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "Content-Type": "application/json",
    }


def create_offer_request(
    slices: list[dict[str, Any]],
    passengers: list[dict[str, Any]],
    *,
    cabin_class: str = "economy",
    max_connections: int | None = None,
    timeout: float = 55.0,
) -> dict[str, Any]:
    """POST /air/offer_requests with return_offers=true."""
    data: dict[str, Any] = {
        "slices": slices,
        "passengers": passengers,
        "cabin_class": cabin_class,
    }
    if max_connections is not None:
        data["max_connections"] = max_connections
    payload = {"data": data}
    with httpx.Client(timeout=timeout) as client:
        response = client.post(
            f"{DUFFEL_API_BASE}/air/offer_requests",
            params={"return_offers": "true"},
            json=payload,
            headers=_headers(),
        )
    if response.status_code >= 400:
        detail = response.text[:500]
        logger.warning("Duffel offer_request failed %s: %s", response.status_code, detail)
        response.raise_for_status()
    body = response.json()
    data = body.get("data")
    if not isinstance(data, dict):
        raise ValueError("Unexpected Duffel response shape")
    return data


def get_offer(offer_id: str, *, timeout: float = 20.0) -> dict[str, Any]:
    with httpx.Client(timeout=timeout) as client:
        response = client.get(
            f"{DUFFEL_API_BASE}/air/offers/{offer_id}",
            headers=_headers(),
        )
    if response.status_code >= 400:
        logger.warning("Duffel offer lookup failed %s: %s", response.status_code, offer_id)
        response.raise_for_status()
    body = response.json()
    data = body.get("data")
    if not isinstance(data, dict):
        raise ValueError("Unexpected Duffel offer response")
    return data


def create_order(
    offer_id: str,
    passengers: list[dict[str, Any]],
    *,
    amount: str,
    currency: str,
    timeout: float = 60.0,
) -> dict[str, Any]:
    """POST /air/orders — instant pay with Duffel balance (test mode)."""
    payload = {
        "data": {
            "type": "instant",
            "selected_offers": [offer_id],
            "payments": [
                {
                    "type": "balance",
                    "currency": currency,
                    "amount": amount,
                }
            ],
            "passengers": passengers,
        }
    }
    with httpx.Client(timeout=timeout) as client:
        response = client.post(
            f"{DUFFEL_API_BASE}/air/orders",
            json=payload,
            headers=_headers(),
        )
    if response.status_code >= 400:
        detail = response.text[:500]
        logger.warning("Duffel create_order failed %s: %s", response.status_code, detail)
        response.raise_for_status()
    body = response.json()
    data = body.get("data")
    if not isinstance(data, dict):
        raise ValueError("Unexpected Duffel order response")
    return data


def get_order(order_id: str, *, timeout: float = 20.0) -> dict[str, Any]:
    """GET /air/orders/{order_id}."""
    with httpx.Client(timeout=timeout) as client:
        response = client.get(
            f"{DUFFEL_API_BASE}/air/orders/{order_id}",
            headers=_headers(),
        )
    if response.status_code >= 400:
        logger.warning("Duffel order lookup failed %s: %s", response.status_code, order_id)
        response.raise_for_status()
    body = response.json()
    data = body.get("data")
    if not isinstance(data, dict):
        raise ValueError("Unexpected Duffel order response")
    return data


def get_seat_maps(offer_id: str, *, timeout: float = 30.0) -> list[dict[str, Any]]:
    """GET /air/seat_maps?offer_id={offer_id}."""
    with httpx.Client(timeout=timeout) as client:
        response = client.get(
            f"{DUFFEL_API_BASE}/air/seat_maps",
            params={"offer_id": offer_id},
            headers=_headers(),
        )
    if response.status_code >= 400:
        logger.warning("Duffel seat_maps lookup failed %s: %s", response.status_code, offer_id)
        return []
    body = response.json()
    data = body.get("data")
    if isinstance(data, list):
        return [d for d in data if isinstance(d, dict)]
    return []


def create_cancellation_quote(order_id: str, *, timeout: float = 30.0) -> dict[str, Any]:
    """POST /air/order_cancellations — create a cancellation quote."""
    payload = {"data": {"order_id": order_id}}
    with httpx.Client(timeout=timeout) as client:
        response = client.post(
            f"{DUFFEL_API_BASE}/air/order_cancellations",
            json=payload,
            headers=_headers(),
        )
    if response.status_code >= 400:
        detail = response.text[:500]
        logger.warning("Duffel order_cancellations failed %s: %s", response.status_code, detail)
        response.raise_for_status()
    body = response.json()
    data = body.get("data")
    if not isinstance(data, dict):
        raise ValueError("Unexpected Duffel cancellation response")
    return data


def confirm_cancellation(cancellation_id: str, *, timeout: float = 30.0) -> dict[str, Any]:
    """POST /air/order_cancellations/{id}/actions/confirm — confirm order cancellation."""
    with httpx.Client(timeout=timeout) as client:
        response = client.post(
            f"{DUFFEL_API_BASE}/air/order_cancellations/{cancellation_id}/actions/confirm",
            headers=_headers(),
        )
    if response.status_code >= 400:
        detail = response.text[:500]
        logger.warning("Duffel confirm cancellation failed %s: %s", response.status_code, detail)
        response.raise_for_status()
    body = response.json()
    data = body.get("data")
    if not isinstance(data, dict):
        raise ValueError("Unexpected Duffel confirm cancellation response")
    return data


def search_place_suggestions(query: str, *, timeout: float = 8.0) -> list[dict[str, Any]]:
    """GET /places/suggestions — Duffel airport/city autocomplete."""
    q = query.strip()
    if len(q) < 1:
        return []

    try:
        key = _api_key()
    except ValueError:
        return []

    with httpx.Client(timeout=timeout) as client:
        response = client.get(
            f"{DUFFEL_API_BASE}/places/suggestions",
            params={"query": q},
            headers={
                "Authorization": f"Bearer {key}",
                "Duffel-Version": DUFFEL_API_VERSION,
                "Accept": "application/json",
                "Accept-Encoding": "gzip",
            },
        )
    if response.status_code >= 400:
        detail = response.text[:500]
        logger.warning("Duffel place suggestions failed %s: %s", response.status_code, detail)
        return []

    body = response.json()
    data = body.get("data")
    if not isinstance(data, list):
        return []
    return [row for row in data if isinstance(row, dict)]

