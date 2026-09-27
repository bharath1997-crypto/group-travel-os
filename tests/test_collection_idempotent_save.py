from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

from app.models.collection_item import CollectionItem
from app.services.collection_service import CollectionService


def test_create_item_returns_existing_when_saved_from_matches():
    user_id = uuid4()
    existing = CollectionItem(
        id=uuid4(),
        user_id=user_id,
        collection_id=None,
        name="Saved place",
        latitude=None,
        longitude=None,
        city="Chicago",
        country="USA",
        category="Parks",
        subcategory=None,
        source="Search",
        saved_from="explore:listing:place:gers:abc",
        note=None,
        stars=0,
        match_status="sure",
        is_unsorted=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db = MagicMock()
    db.execute.return_value.scalar_one_or_none.return_value = existing

    out = CollectionService.create_item(
        db,
        user_id,
        name="Different title",
        saved_from="explore:listing:place:gers:abc",
        source="Search",
        is_unsorted=True,
    )

    assert out is existing
    db.add.assert_not_called()
