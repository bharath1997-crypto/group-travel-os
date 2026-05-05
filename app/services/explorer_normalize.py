"""Shared helpers for building normalized Explorer rows."""
from __future__ import annotations

import re
from typing import Literal

from app.schemas.explorer import ExplorerResultItem


def safe_id(prefix: str, raw: str, index: int) -> str:
    slug = re.sub(r"[^\w\-]+", "-", raw)[:48].strip("-") or str(index)
    return f"{prefix}-{slug}-{index}"


def make_item(
    *,
    source: str,
    type_: Literal["event", "place", "video"],
    title: str,
    description: str | None,
    image_url: str | None,
    external_url: str | None,
    latitude: float | None,
    longitude: float | None,
    price: float | None,
    item_id: str,
    venue: str,
    city: str,
    date_str: str = "",
    is_free: bool = False,
    emoji: str = "",
) -> ExplorerResultItem:
    price_from = price
    price_label = ""
    if price_from is not None:
        price_label = f"From ${price_from:.0f}" if price_from >= 1 else f"${price_from:.2f}"
    elif is_free:
        price_label = "Free"
    else:
        price_label = "Open details"

    return ExplorerResultItem(
        source=source,
        type=type_,
        title=(title or "Untitled").strip(),
        description=(description or "").strip() or None,
        image_url=image_url or None,
        external_url=external_url or None,
        latitude=latitude,
        longitude=longitude,
        price=price,
        id=item_id,
        source_type=source,
        venue=venue or city,
        city=city,
        date_str=date_str,
        dateLabel=date_str or ("Search result" if type_ != "event" else "Event"),
        price_from=price_from,
        priceLabel=price_label,
        is_free=is_free,
        emoji=emoji,
    )
