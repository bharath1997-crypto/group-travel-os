"""
app/services/feed_service.py — Destination feed and search (Phase 3)

Rules:
- Session is always injected — never created here
- All errors raised via AppException
- SQLAlchemy 2.0 select() only — no session.query()
"""
from __future__ import annotations

import math
import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.destination import Destination
from app.utils.exceptions import AppException


class FeedService:
    ALLOWED_CATEGORIES = frozenset(
        {"beach", "city", "adventure", "culture", "nature"},
    )

    @staticmethod
    def _normalize_category(category: str | None) -> str | None:
        if category is None:
            return None
        c = category.strip().lower()
        if not c:
            return None
        if c not in FeedService.ALLOWED_CATEGORIES:
            AppException.bad_request("Invalid category")
        return c

    @staticmethod
    def get_trending(
        db: Session,
        category: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        cat = FeedService._normalize_category(category)

        page = max(1, page)
        page_size = max(1, page_size)

        filters = []
        if cat is not None:
            filters.append(func.lower(Destination.category) == cat)

        count_stmt = select(func.count(Destination.id))
        if filters:
            count_stmt = count_stmt.where(*filters)
        total = db.execute(count_stmt).scalar_one()

        items_stmt = select(Destination).order_by(Destination.trending_score.desc())
        if filters:
            items_stmt = items_stmt.where(*filters)
        items_stmt = items_stmt.offset((page - 1) * page_size).limit(page_size)
        items = list(db.execute(items_stmt).scalars().all())

        pages = math.ceil(total / page_size) if total else 0

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": pages,
        }

    @staticmethod
    def search_destinations(
        db: Session,
        query: str,
        category: str | None = None,
    ) -> list[Destination]:
        q = query.strip()
        if len(q) < 2:
            AppException.bad_request("Search query too short")

        cat = FeedService._normalize_category(category)
        pattern = f"%{q}%"

        stmt = select(Destination).where(
            or_(
                Destination.name.ilike(pattern),
                Destination.country.ilike(pattern),
            ),
        )
        if cat is not None:
            stmt = stmt.where(func.lower(Destination.category) == cat)

        stmt = stmt.order_by(Destination.trending_score.desc()).limit(50)
        return list(db.execute(stmt).scalars().all())

    @staticmethod
    def get_destination_detail(db: Session, destination_id: uuid.UUID) -> Destination:
        stmt = select(Destination).where(Destination.id == destination_id)
        dest = db.execute(stmt).scalar_one_or_none()
        if dest is None:
            AppException.not_found("Destination not found")
        return dest
