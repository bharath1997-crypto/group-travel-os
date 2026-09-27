"""
app/services/collection_service.py — My Space / Collection saved places
"""
from __future__ import annotations

import uuid
from collections import Counter
from datetime import datetime, timezone
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.collection_item import CollectionItem
from app.models.user_collection import UserCollection
from app.utils.exceptions import AppException

ALLOWED_SOURCES = frozenset(
    {"Search", "Reel", "Pin", "Friend", "Wayra", "Article", "Link"},
)
ALLOWED_MATCH_STATUSES = frozenset({"sure", "unsure", "unknown"})


class CollectionService:
    @staticmethod
    def _validate_source(source: str) -> None:
        if source not in ALLOWED_SOURCES:
            AppException.bad_request("Invalid source type")

    @staticmethod
    def _validate_match_status(status: str) -> None:
        if status not in ALLOWED_MATCH_STATUSES:
            AppException.bad_request("Invalid match status")

    @staticmethod
    def _validate_stars(stars: int) -> None:
        if stars < 0 or stars > 5:
            AppException.bad_request("Stars must be between 0 and 5")

    @staticmethod
    def list_items(
        db: Session,
        user_id: uuid.UUID,
        *,
        country: str | None = None,
        city: str | None = None,
        category: str | None = None,
        include_unsorted: bool = True,
    ) -> list[CollectionItem]:
        stmt = select(CollectionItem).where(CollectionItem.user_id == user_id)
        if country and country != "Any":
            stmt = stmt.where(CollectionItem.country == country)
        if city and city != "Any":
            stmt = stmt.where(CollectionItem.city == city)
        if category and category != "Any":
            stmt = stmt.where(CollectionItem.category == category)
        if not include_unsorted:
            stmt = stmt.where(CollectionItem.is_unsorted.is_(False))
        stmt = stmt.order_by(CollectionItem.created_at.desc())
        return list(db.execute(stmt).scalars().all())

    @staticmethod
    def filter_facets(items: list[CollectionItem]) -> dict[str, list[str]]:
        countries = sorted({i.country for i in items if i.country})
        cities = sorted({i.city for i in items if i.city})
        categories = sorted({i.category for i in items if i.category})
        return {
            "countries": countries,
            "cities": cities,
            "categories": categories,
        }

    @staticmethod
    def city_counts(items: list[CollectionItem]) -> dict[str, int]:
        counts = Counter(i.city for i in items if i.city and not i.is_unsorted)
        return dict(counts)

    @staticmethod
    def unsorted_count(items: list[CollectionItem]) -> int:
        return sum(1 for i in items if i.is_unsorted)

    @staticmethod
    def find_item_by_saved_from(
        db: Session,
        user_id: uuid.UUID,
        saved_from: str,
    ) -> CollectionItem | None:
        key = saved_from.strip()
        if not key:
            return None
        stmt = (
            select(CollectionItem)
            .where(CollectionItem.user_id == user_id, CollectionItem.saved_from == key)
            .limit(1)
        )
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def create_item(
        db: Session,
        user_id: uuid.UUID,
        *,
        name: str,
        latitude: float | None = None,
        longitude: float | None = None,
        city: str | None = None,
        country: str | None = None,
        category: str | None = None,
        subcategory: str | None = None,
        source: str = "Search",
        saved_from: str | None = None,
        note: str | None = None,
        stars: int = 0,
        match_status: str = "sure",
        is_unsorted: bool = False,
        collection_id: uuid.UUID | None = None,
    ) -> CollectionItem:
        CollectionService._validate_source(source)
        CollectionService._validate_match_status(match_status)
        CollectionService._validate_stars(stars)

        if collection_id is not None:
            CollectionService._get_owned_collection(db, collection_id, user_id)

        if saved_from and saved_from.strip():
            existing = CollectionService.find_item_by_saved_from(db, user_id, saved_from)
            if existing is not None:
                return existing

        row = CollectionItem(
            user_id=user_id,
            collection_id=collection_id,
            name=name.strip(),
            latitude=latitude,
            longitude=longitude,
            city=city.strip() if city else None,
            country=country.strip() if country else None,
            category=category.strip() if category else None,
            subcategory=subcategory.strip() if subcategory else None,
            source=source,
            saved_from=saved_from.strip() if saved_from else None,
            note=note.strip() if note else None,
            stars=stars,
            match_status=match_status,
            is_unsorted=is_unsorted,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    @staticmethod
    def update_item(
        db: Session,
        item_id: uuid.UUID,
        user_id: uuid.UUID,
        fields: dict,
    ) -> CollectionItem:
        row = CollectionService._get_owned_item(db, item_id, user_id)

        if "collection_id" in fields:
            cid = fields["collection_id"]
            if cid is not None:
                CollectionService._get_owned_collection(db, cid, user_id)
            row.collection_id = cid

        if "name" in fields and fields["name"] is not None:
            row.name = str(fields["name"]).strip()
        if "note" in fields:
            n = fields["note"]
            row.note = n.strip() if isinstance(n, str) and n.strip() else None
        if "stars" in fields and fields["stars"] is not None:
            CollectionService._validate_stars(fields["stars"])
            row.stars = fields["stars"]
        if "category" in fields:
            c = fields["category"]
            row.category = c.strip() if isinstance(c, str) and c.strip() else None
        if "subcategory" in fields:
            s = fields["subcategory"]
            row.subcategory = s.strip() if isinstance(s, str) and s.strip() else None
        if "city" in fields:
            c = fields["city"]
            row.city = c.strip() if isinstance(c, str) and c.strip() else None
        if "country" in fields:
            c = fields["country"]
            row.country = c.strip() if isinstance(c, str) and c.strip() else None
        if "is_unsorted" in fields and fields["is_unsorted"] is not None:
            row.is_unsorted = bool(fields["is_unsorted"])
        if "match_status" in fields and fields["match_status"] is not None:
            CollectionService._validate_match_status(fields["match_status"])
            row.match_status = fields["match_status"]

        row.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(row)
        return row

    @staticmethod
    def delete_item(db: Session, item_id: uuid.UUID, user_id: uuid.UUID) -> None:
        row = CollectionService._get_owned_item(db, item_id, user_id)
        db.delete(row)
        db.commit()

    @staticmethod
    def list_collections(
        db: Session,
        user_id: uuid.UUID,
    ) -> list[UserCollection]:
        rows = db.execute(
            select(UserCollection)
            .where(UserCollection.user_id == user_id)
            .order_by(UserCollection.created_at.desc())
        ).scalars().all()
        return list(rows)

    @staticmethod
    def create_collection(
        db: Session,
        user_id: uuid.UUID,
        name: str,
        group_id: uuid.UUID | None = None,
    ) -> UserCollection:
        row = UserCollection(
            user_id=user_id,
            name=name.strip(),
            group_id=group_id,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    @staticmethod
    def extract_link(url: str) -> dict:
        parsed = urlparse(url.strip())
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            AppException.bad_request("Enter a valid http or https link")

        host = parsed.netloc.lower().removeprefix("www.")
        source_label = host.split(".")[0].title() if host else "Link"
        if "instagram" in host:
            source_label = "Instagram"
        elif "tiktok" in host:
            source_label = "TikTok"
        elif "youtube" in host or "youtu.be" in host:
            source_label = "YouTube"

        title = parsed.path.strip("/").replace("-", " ").replace("_", " ")
        if not title:
            title = url.strip()

        return {
            "source_title": title[:200],
            "source_label": source_label,
            "candidates": [],
            "message": (
                "Link saved for review. Place extraction from articles and reels "
                "is rolling out — confirm matches manually for now."
            ),
        }

    @staticmethod
    def _get_owned_item(
        db: Session,
        item_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> CollectionItem:
        row = db.execute(
            select(CollectionItem).where(CollectionItem.id == item_id)
        ).scalar_one_or_none()
        if not row:
            AppException.not_found("Collection item not found")
        if row.user_id != user_id:
            AppException.forbidden()
        return row

    @staticmethod
    def _get_owned_collection(
        db: Session,
        collection_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> UserCollection:
        row = db.execute(
            select(UserCollection).where(UserCollection.id == collection_id)
        ).scalar_one_or_none()
        if not row:
            AppException.not_found("Collection not found")
        if row.user_id != user_id:
            AppException.forbidden()
        return row
