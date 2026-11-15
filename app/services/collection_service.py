"""
app/services/collection_service.py — My Space / Collection saved places
"""
from __future__ import annotations

import uuid
from collections import Counter
from datetime import datetime, timezone
from urllib.parse import urlparse

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.collection_item import CollectionItem
from app.models.collection_item_tag import CollectionItemTag
from app.models.friend_request import FriendRequest
from app.models.group import GroupMember
from app.models.user import User
from app.models.user_collection import UserCollection
from app.services.notification_service import NotificationService
from app.utils.exceptions import AppException

MAX_TAGS_PER_ITEM = 10
MAX_TAG_LENGTH = 40
MAX_SHARE_RECIPIENTS = 20
RESERVED_KEY_PREFIXES = ("share:",)  # written by the server when a friend sends you a save


def _require_text(value: str | None, what: str) -> str:
    """Trimmed text, or a 400 when nothing is left ("   " used to be saved as an empty name)."""
    text = (value or "").strip()
    if not text:
        AppException.bad_request(f"{what} cannot be empty")
    return text


def normalise_tags(tags: list[str] | None) -> list[str]:
    """Lower-case, trim, collapse spaces, drop empties and duplicates, keep order."""
    out: list[str] = []
    if isinstance(tags, str):  # a bare "a, b" string must not be split into characters
        tags = tags.split(",")
    for raw in tags or []:
        # Only a leading '#' is decoration; "c#" and "f#" are real tags.
        tag = " ".join(str(raw).split()).lstrip("#").strip().lower()
        tag = " ".join(tag.replace(" #", " ").split())
        if not tag:
            continue
        if len(tag) > MAX_TAG_LENGTH:
            AppException.bad_request(f"A tag can be at most {MAX_TAG_LENGTH} characters")
        if tag not in out:
            out.append(tag)
    if len(out) > MAX_TAGS_PER_ITEM:
        AppException.bad_request(f"At most {MAX_TAGS_PER_ITEM} tags per place")
    return out

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
        tag: str | None = None,
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
        if tag and tag != "Any":
            stmt = stmt.where(
                CollectionItem.id.in_(
                    select(CollectionItemTag.item_id).where(
                        CollectionItemTag.tag == tag.strip().lower()
                    )
                )
            )
        stmt = stmt.order_by(CollectionItem.created_at.desc())
        return list(db.execute(stmt).scalars().all())

    @staticmethod
    def apply_filters(
        items: list[CollectionItem],
        *,
        country: str | None = None,
        city: str | None = None,
        category: str | None = None,
        tag: str | None = None,
    ) -> list[CollectionItem]:
        """Same rules as list_items' SQL filters, applied to rows already loaded."""
        want_tag = tag.strip().lower() if tag and tag != "Any" else None
        out = []
        for i in items:
            if country and country != "Any" and i.country != country:
                continue
            if city and city != "Any" and i.city != city:
                continue
            if category and category != "Any" and i.category != category:
                continue
            if want_tag and want_tag not in i.tags:
                continue
            out.append(i)
        return out

    @staticmethod
    def filter_facets(items: list[CollectionItem]) -> dict[str, list[str]]:
        countries = sorted({i.country for i in items if i.country})
        cities = sorted({i.city for i in items if i.city})
        categories = sorted({i.category for i in items if i.category})
        return {
            "countries": countries,
            "cities": cities,
            "categories": categories,
            "tags": sorted({t for i in items for t in i.tags}),
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
    def saved_from_keys(db: Session, user_id: uuid.UUID, keys: list[str]) -> set[str]:
        """Which of these saved_from keys the user already has (one query, not one per key)."""
        wanted = [k.strip() for k in keys if k and k.strip()]
        if not wanted:
            return set()
        rows = db.execute(
            select(CollectionItem.saved_from).where(
                CollectionItem.user_id == user_id, CollectionItem.saved_from.in_(wanted)
            )
        ).scalars()
        return {r for r in rows if r}

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
        tags: list[str] | None = None,
        shared_by_user_id: uuid.UUID | None = None,
    ) -> CollectionItem:
        CollectionService._validate_source(source)
        name = _require_text(name, "A name")
        if saved_from and saved_from.strip().lower().startswith(RESERVED_KEY_PREFIXES):
            AppException.bad_request("That source link is reserved")
        clean_tags = normalise_tags(tags)
        CollectionService._validate_match_status(match_status)
        CollectionService._validate_stars(stars)

        if collection_id is not None:
            CollectionService._get_owned_collection(db, collection_id, user_id)

        if saved_from and saved_from.strip():
            existing = CollectionService.find_item_by_saved_from(db, user_id, saved_from)
            if existing is not None:
                if clean_tags:
                    # Keep the user's order; only drop what would go past the limit.
                    merged = list(dict.fromkeys([*existing.tags, *clean_tags]))[:MAX_TAGS_PER_ITEM]
                    CollectionService._replace_tags(existing, merged)
                    db.commit()
                    db.refresh(existing)
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
            note=(note.strip() or None) if note else None,
            stars=stars,
            match_status=match_status,
            is_unsorted=is_unsorted,
            shared_by_user_id=shared_by_user_id,
        )
        CollectionService._replace_tags(row, clean_tags)
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    @staticmethod
    def _replace_tags(row: CollectionItem, tags: list[str]) -> None:
        keep = {t.tag: t for t in row.tag_rows if t.tag in tags}
        row.tag_rows = [keep.get(t) or CollectionItemTag(tag=t) for t in tags]

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
            row.name = _require_text(str(fields["name"]), "A name")
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
        if "tags" in fields and fields["tags"] is not None:
            CollectionService._replace_tags(row, normalise_tags(fields["tags"]))
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
        name = _require_text(name, "A collection name")
        if group_id is not None:
            is_member = db.execute(
                select(GroupMember.id).where(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
            ).first()
            if is_member is None:
                AppException.forbidden("You can only use a group you belong to")
        same = db.execute(
            select(UserCollection).where(
                UserCollection.user_id == user_id,
                func.lower(UserCollection.name) == name.lower(),
                UserCollection.group_id.is_(None) if group_id is None else UserCollection.group_id == group_id,
            )
        ).scalars().first()
        if same is not None:
            return same
        row = UserCollection(
            user_id=user_id,
            name=name,
            group_id=group_id,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    @staticmethod
    def share_item(
        db: Session,
        item_id: uuid.UUID,
        owner: User,
        friend_ids: list[uuid.UUID],
    ) -> dict:
        """Copy one of your saves into each friend's Unsorted and notify them.

        Only accepted connections can receive a share. The copy never carries your
        note, stars, collection or tags (they can reveal where you are or what you think).
        Re-sharing the same save to the same friend does nothing.
        """
        row = CollectionService._get_owned_item(db, item_id, owner.id)
        unique_ids = list(dict.fromkeys(friend_ids))
        if not unique_ids:
            AppException.bad_request("Pick at least one friend")
        if len(unique_ids) > MAX_SHARE_RECIPIENTS:
            AppException.bad_request(f"You can share with at most {MAX_SHARE_RECIPIENTS} friends at once")

        accepted: set[uuid.UUID] = set()
        for fr in db.execute(
            select(FriendRequest).where(
                FriendRequest.status == "accepted",
                or_(
                    (FriendRequest.sender_id == owner.id) & FriendRequest.receiver_id.in_(unique_ids),
                    (FriendRequest.receiver_id == owner.id) & FriendRequest.sender_id.in_(unique_ids),
                ),
            )
        ).scalars():
            accepted.add(fr.receiver_id if fr.sender_id == owner.id else fr.sender_id)
        if any(fid not in accepted for fid in unique_ids):
            AppException.forbidden("You can only share with your connections")

        sent: list[uuid.UUID] = []
        already: list[uuid.UUID] = []
        who = (owner.full_name or "A friend").strip() or "A friend"
        for fid in unique_ids:
            key = f"share:{row.id}:{owner.id}"[:500]
            if CollectionService.find_item_by_saved_from(db, fid, key) is not None:
                already.append(fid)
                continue
            copy = CollectionItem(
                user_id=fid,
                name=row.name,
                city=row.city,
                country=row.country,
                category=row.category,
                subcategory=row.subcategory,
                source="Friend",
                saved_from=key,
                match_status=row.match_status,
                is_unsorted=True,
                shared_by_user_id=owner.id,
            )
            db.add(copy)
            note = NotificationService.append_in_app(
                db,
                fid,
                "collection_share",
                f"{who} shared a place",
                f"{who} sent you {row.name}. It is waiting in Unsorted.",
                {"route": "/collection"},
            )
            db.flush()
            sent.append(fid)
            db.commit()
            NotificationService.try_fcm_for_user(
                db, fid, f"{who} shared a place", f"{who} sent you {row.name}.",
                notif_type="collection_share", notification_id=note.id,
                data={"route": "/collection"},
            )
        return {"sent": [str(i) for i in sent], "already_shared": [str(i) for i in already]}

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
