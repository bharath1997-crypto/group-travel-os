"""
Collection Sprint C4: tags, sharing a save with friends, and the link preview.

Runs on an in-memory SQLite database with only the tables it needs (never a real
database). Firebase push is mocked.
"""
from __future__ import annotations

import uuid
from collections.abc import Iterator
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401  (register every table)
from app.main import app
from app.models.collection_item import CollectionItem
from app.models.friend_request import FriendRequest
from app.models.notification import Notification
from app.models.user import User
from app.services import link_reader_service as lr
from app.services.collection_service import MAX_TAGS_PER_ITEM, normalise_tags
from app.utils.auth import get_current_user
from app.utils.database import Base, get_db

API = "/api/v1/collection"


@compiles(JSONB, "sqlite")
def _jsonb_as_json(_type, _compiler, **_kw):  # pragma: no cover - DDL only
    return "JSON"


TABLES = [
    "users", "groups", "friend_requests", "user_collections",
    "collection_items", "collection_item_tags", "notifications",
]


def _user(session: Session, label: str) -> User:
    u = User(
        email=f"{label}-{uuid.uuid4().hex[:6]}@example.test",
        hashed_password="x",
        full_name=label.title(),
    )
    session.add(u)
    session.flush()
    return u


@pytest.fixture()
def env() -> Iterator[tuple[TestClient, Session, dict, User, User, User]]:
    engine = create_engine(
        "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine, tables=[Base.metadata.tables[n] for n in TABLES])
    session = Session(engine)
    me, friend, stranger = _user(session, "me"), _user(session, "friend"), _user(session, "stranger")
    session.add(FriendRequest(sender_id=me.id, receiver_id=friend.id, status="accepted"))
    session.commit()
    current = {"user": me}
    app.dependency_overrides[get_db] = lambda: session
    app.dependency_overrides[get_current_user] = lambda: current["user"]
    try:
        with patch("app.services.notification_service.NotificationService.send_to_token"):
            yield TestClient(app), session, current, me, friend, stranger
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
        session.close()
        engine.dispose()


def _save(client: TestClient, **over) -> dict:
    body = {"name": "Cafe Uno", "city": "Lisbon", "source": "Link"}
    body.update(over)
    res = client.post(f"{API}/items", json=body)
    assert res.status_code == 201, res.text
    return res.json()


# ── tags ──────────────────────────────────────────────────────────────────────
def test_normalise_tags_rules():
    assert normalise_tags([" Date  Night ", "#rainy day", "date night", ""]) == ["date night", "rainy day"]
    with pytest.raises(Exception):
        normalise_tags(["x" * 41])
    with pytest.raises(Exception):
        normalise_tags([f"t{i}" for i in range(MAX_TAGS_PER_ITEM + 1)])


def test_create_with_tags_and_list_filter_and_facets(env):
    client, *_ = env
    a = _save(client, name="A", tags=["Date Night", "rainy day"])
    _save(client, name="B", tags=["kids"])
    assert a["tags"] == ["date night", "rainy day"]
    listed = client.get(f"{API}/items").json()
    assert listed["facets"]["tags"] == ["date night", "kids", "rainy day"]
    only = client.get(f"{API}/items", params={"tag": "KIDS"}).json()
    assert [i["name"] for i in only["items"]] == ["B"]
    assert only["total_count"] == 2


def test_patch_replaces_tags_and_clears(env):
    client, *_ = env
    item = _save(client, tags=["a", "b"])
    res = client.patch(f"{API}/items/{item['id']}", json={"tags": ["b", "c"]})
    assert res.status_code == 200 and res.json()["tags"] == ["b", "c"]
    res = client.patch(f"{API}/items/{item['id']}", json={"tags": []})
    assert res.json()["tags"] == []
    res = client.patch(f"{API}/items/{item['id']}", json={"note": "only a note"})
    assert res.json()["tags"] == []


def test_tags_validation_422_and_400(env):
    client, *_ = env
    too_many = client.post(f"{API}/items", json={"name": "X", "tags": [f"t{i}" for i in range(11)]})
    assert too_many.status_code == 422
    too_long = client.post(f"{API}/items", json={"name": "X", "tags": ["x" * 41]})
    assert too_long.status_code == 400


def test_resave_same_link_adds_tags_without_duplicate(env):
    client, *_ = env
    first = _save(client, saved_from="https://a.test/x", tags=["one"])
    second = _save(client, saved_from="https://a.test/x", tags=["two"])
    assert first["id"] == second["id"]
    assert second["tags"] == ["one", "two"]


# ── share with friends ────────────────────────────────────────────────────────
def test_share_requires_auth():
    app.dependency_overrides.clear()
    res = TestClient(app).post(f"{API}/items/{uuid.uuid4()}/share", json={"friend_ids": [str(uuid.uuid4())]})
    assert res.status_code == 401


def test_share_validation_422(env):
    client, _s, _c, *_ = env
    assert client.post(f"{API}/items/{uuid.uuid4()}/share", json={"friend_ids": []}).status_code == 422
    assert client.post(f"{API}/items/{uuid.uuid4()}/share", json={}).status_code == 422


def test_share_copies_to_friend_unsorted_without_private_fields(env):
    client, session, _c, me, friend, _x = env
    item = _save(client, note="my secret note", stars=5, tags=["private"], category="Cafe")
    res = client.post(f"{API}/items/{item['id']}/share", json={"friend_ids": [str(friend.id)]})
    assert res.status_code == 200, res.text
    assert res.json()["sent"] == [str(friend.id)] and res.json()["already_shared"] == []

    copy = session.execute(select(CollectionItem).where(CollectionItem.user_id == friend.id)).scalar_one()
    assert copy.is_unsorted is True and copy.source == "Friend"
    assert copy.shared_by_user_id == me.id
    assert copy.note is None and copy.stars == 0 and copy.collection_id is None and copy.tags == []
    assert (copy.name, copy.city, copy.category) == ("Cafe Uno", "Lisbon", "Cafe")

    note = session.execute(select(Notification).where(Notification.user_id == friend.id)).scalar_one()
    assert note.type == "collection_share" and "Me" in note.title


def test_share_is_idempotent(env):
    client, session, _c, _me, friend, _x = env
    item = _save(client)
    body = {"friend_ids": [str(friend.id)]}
    client.post(f"{API}/items/{item['id']}/share", json=body)
    again = client.post(f"{API}/items/{item['id']}/share", json=body)
    assert again.json()["sent"] == [] and again.json()["already_shared"] == [str(friend.id)]
    assert len(session.execute(select(CollectionItem).where(CollectionItem.user_id == friend.id)).scalars().all()) == 1


def test_share_with_non_friend_is_403_and_sends_nothing(env):
    client, session, _c, _me, friend, stranger = env
    item = _save(client)
    res = client.post(
        f"{API}/items/{item['id']}/share",
        json={"friend_ids": [str(friend.id), str(stranger.id)]},
    )
    assert res.status_code == 403
    assert session.execute(select(CollectionItem).where(CollectionItem.user_id == friend.id)).first() is None


def test_pending_request_is_not_a_friend(env):
    client, session, _c, me, _f, stranger = env
    session.add(FriendRequest(sender_id=me.id, receiver_id=stranger.id, status="pending"))
    session.commit()
    item = _save(client)
    res = client.post(f"{API}/items/{item['id']}/share", json={"friend_ids": [str(stranger.id)]})
    assert res.status_code == 403


def test_cannot_share_someone_elses_item(env):
    client, _s, current, me, friend, _x = env
    item = _save(client)
    current["user"] = friend
    res = client.post(f"{API}/items/{item['id']}/share", json={"friend_ids": [str(me.id)]})
    assert res.status_code == 403


def test_friend_sees_who_sent_it(env):
    client, _s, current, me, friend, _x = env
    item = _save(client)
    client.post(f"{API}/items/{item['id']}/share", json={"friend_ids": [str(friend.id)]})
    current["user"] = friend
    got = client.get(f"{API}/items").json()["items"][0]
    assert got["shared_by_name"] == "Me" and got["shared_by_user_id"] == str(me.id)
    assert got["source"] == "Friend" and got["is_unsorted"] is True


# ── preview ───────────────────────────────────────────────────────────────────
def _yt_response(thumb="https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg"):
    class R:
        def raise_for_status(self): ...
        def json(self):
            return {"items": [{"snippet": {
                "title": "Lisbon food tour", "description": "Time Out Market",
                "channelTitle": "Ana Eats", "thumbnails": {"medium": {"url": thumb}},
            }}]}
    return R()


def test_youtube_preview_has_thumbnail_channel_and_video_id():
    lr.reset_state_for_tests()
    with patch.object(lr.httpx, "get", return_value=_yt_response()):
        res = lr.read_link("https://youtu.be/dQw4w9WgXcQ", youtube_key="k")
    assert res["preview"] == {
        "platform": "YouTube", "author": "Ana Eats",
        "thumbnail_url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg", "video_id": "dQw4w9WgXcQ",
    }


def test_youtube_preview_drops_non_https_thumbnail():
    lr.reset_state_for_tests()
    with patch.object(lr.httpx, "get", return_value=_yt_response("http://evil.test/x.jpg")):
        res = lr.read_link("https://youtu.be/dQw4w9WgXcQ", youtube_key="k")
    assert res["preview"]["thumbnail_url"] is None


def test_instagram_preview_is_label_only_and_nothing_fetched():
    with patch.object(lr, "safe_fetch_text") as fetch:
        res = lr.read_link("https://www.instagram.com/reel/abc/")
    fetch.assert_not_called()
    assert res["preview"] == {"platform": "Instagram"}
