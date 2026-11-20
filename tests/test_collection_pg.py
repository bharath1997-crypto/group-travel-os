"""
Collection routes against real PostgreSQL (create / list / patch / delete / ownership).

Opt-in, never runs in sqlite CI. Everything — including any missing-table DDL and the
test users — happens inside ONE outer transaction that is rolled back at the end, and
the app's own `commit()` calls only release savepoints (join_transaction_mode):

  COLLECTION_PG_TEST_URL=postgresql://USER:PASS@HOST:5432/db \\
    pytest tests/test_collection_pg.py -v

Drives the real FastAPI routes with TestClient; only `get_db` and `get_current_user`
are overridden.
"""
from __future__ import annotations

import os
import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.main import app
from app.models.collection_item import CollectionItem
from app.models.collection_item_tag import CollectionItemTag
from app.models.friend_request import FriendRequest
from app.models.user import User
from app.models.user_collection import UserCollection
from app.utils.auth import get_current_user
from app.utils.database import Base, get_db

pytestmark = pytest.mark.collection_postgres

API = "/api/v1/collection"


def _make_user(session: Session, label: str) -> User:
    user = User(
        email=f"collection-pg-{label}-{uuid.uuid4().hex[:8]}@example.test",
        hashed_password="not-a-real-hash",
        full_name=f"Collection PG {label}",
    )
    session.add(user)
    session.flush()
    return user


@pytest.fixture()
def pg_env() -> Iterator[tuple[TestClient, dict, User, User]]:
    url = os.getenv("COLLECTION_PG_TEST_URL")
    if not url:
        pytest.skip("set COLLECTION_PG_TEST_URL to run Collection Postgres tests")

    engine = create_engine(url)
    conn = engine.connect()
    outer = conn.begin()
    session = Session(bind=conn, join_transaction_mode="create_savepoint")
    current: dict = {}
    try:
        conn.exec_driver_sql("SET LOCAL lock_timeout = '5s'")
        # Tables may not be applied yet; DDL is transactional, so this is rolled back too.
        Base.metadata.create_all(
            conn,
            tables=[UserCollection.__table__, CollectionItem.__table__, CollectionItemTag.__table__],
            checkfirst=True,
        )
        alice = _make_user(session, "alice")
        bob = _make_user(session, "bob")
        current["user"] = alice

        app.dependency_overrides[get_db] = lambda: session
        app.dependency_overrides[get_current_user] = lambda: current["user"]
        yield TestClient(app), current, alice, bob
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
        session.close()
        outer.rollback()
        conn.close()
        engine.dispose()


def _save(client: TestClient, **over):
    body = {"name": "Green Mill", "city": "Chicago", "country": "USA", "category": "Live music"}
    body.update(over)
    res = client.post(f"{API}/items", json=body)
    assert res.status_code == 201, res.text
    return res.json()


def test_create_list_patch_delete_roundtrip(pg_env):
    client, _current, alice, _bob = pg_env

    created = _save(client, saved_from="https://youtu.be/abc", source="Link")
    assert created["user_id"] == str(alice.id)
    assert created["stars"] == 0 and created["is_unsorted"] is False

    listed = client.get(f"{API}/items").json()
    assert [i["id"] for i in listed["items"]] == [created["id"]]
    assert listed["total_count"] == 1
    assert listed["facets"]["cities"] == ["Chicago"]
    assert listed["city_counts"] == {"Chicago": 1}

    patched = client.patch(
        f"{API}/items/{created['id']}",
        json={"note": "  Get there early ", "stars": 4, "name": "Green Mill Lounge"},
    )
    assert patched.status_code == 200, patched.text
    body = patched.json()
    assert body["note"] == "Get there early"
    assert body["stars"] == 4
    assert body["name"] == "Green Mill Lounge"
    assert body["city"] == "Chicago"  # untouched fields stay

    cleared = client.patch(f"{API}/items/{created['id']}", json={"note": "", "stars": 0}).json()
    assert cleared["note"] is None and cleared["stars"] == 0

    assert client.delete(f"{API}/items/{created['id']}").status_code == 204
    assert client.get(f"{API}/items").json()["items"] == []
    assert client.delete(f"{API}/items/{created['id']}").status_code == 404


def test_filters_unsorted_and_dedupe(pg_env):
    client, *_ = pg_env
    a = _save(client, name="A", city="Chicago", country="USA", category="Food", saved_from="explore:listing:place:1")
    again = _save(client, name="A again", city="Chicago", saved_from="explore:listing:place:1")
    assert again["id"] == a["id"]  # same saved_from is not saved twice
    _save(client, name="B", city="Lisbon", country="Portugal", category="Bars", is_unsorted=True, match_status="unsure")

    everything = client.get(f"{API}/items").json()
    assert everything["total_count"] == 2
    assert everything["unsorted_count"] == 1
    assert everything["city_counts"] == {"Chicago": 1}  # unsorted not counted

    portugal = client.get(f"{API}/items", params={"country": "Portugal"}).json()
    assert [i["name"] for i in portugal["items"]] == ["B"]
    assert portugal["total_count"] == 2  # total and facets stay unfiltered
    assert sorted(portugal["facets"]["countries"]) == ["Portugal", "USA"]

    filed = client.patch(f"{API}/items/{portugal['items'][0]['id']}", json={"is_unsorted": False, "match_status": "sure"})
    assert filed.status_code == 200
    assert client.get(f"{API}/items").json()["unsorted_count"] == 0


def test_named_collections_and_move(pg_env):
    client, _current, _alice, _bob = pg_env
    made = client.post(f"{API}/collections", json={"name": "Lisbon 2027"})
    assert made.status_code == 201, made.text
    cid = made.json()["id"]
    assert [c["name"] for c in client.get(f"{API}/collections").json()] == ["Lisbon 2027"]

    item = _save(client)
    moved = client.patch(f"{API}/items/{item['id']}", json={"collection_id": cid}).json()
    assert moved["collection_id"] == cid
    removed = client.patch(f"{API}/items/{item['id']}", json={"collection_id": None}).json()
    assert removed["collection_id"] is None

    missing = client.patch(f"{API}/items/{item['id']}", json={"collection_id": str(uuid.uuid4())})
    assert missing.status_code == 404


def test_other_users_data_is_private(pg_env):
    client, current, alice, bob = pg_env
    mine = _save(client, name="Mine")
    cid = client.post(f"{API}/collections", json={"name": "Alice only"}).json()["id"]

    current["user"] = bob
    assert client.get(f"{API}/items").json()["items"] == []
    assert client.get(f"{API}/collections").json() == []
    assert client.patch(f"{API}/items/{mine['id']}", json={"stars": 5}).status_code == 403
    assert client.delete(f"{API}/items/{mine['id']}").status_code == 403
    theirs = _save(client, name="Theirs")
    # cannot file a save under someone else's collection
    assert client.patch(f"{API}/items/{theirs['id']}", json={"collection_id": cid}).status_code == 403

    current["user"] = alice
    untouched = client.get(f"{API}/items").json()["items"]
    assert [i["name"] for i in untouched] == ["Mine"]
    assert untouched[0]["stars"] == 0


def test_delete_collection_row_keeps_items(pg_env):
    """FK is ON DELETE SET NULL: items survive when their collection row disappears."""
    client, _current, alice, _bob = pg_env
    cid = client.post(f"{API}/collections", json={"name": "Temp"}).json()["id"]
    item = _save(client, collection_id=cid)
    assert item["collection_id"] == cid

    session = app.dependency_overrides[get_db]()
    session.execute(text("DELETE FROM user_collections WHERE id = :id"), {"id": cid})
    session.expire_all()

    after = client.get(f"{API}/items").json()["items"]
    assert [i["id"] for i in after] == [item["id"]]
    assert after[0]["collection_id"] is None


def test_tags_filter_and_share_with_friend(pg_env):
    """Sprint C4 on real Postgres (rolled back): tags, tag filter, send to a friend."""
    client, current, alice, bob = pg_env
    item = _save(client, tags=["Date Night", "rainy day"], note="private", stars=5)
    assert item["tags"] == ["date night", "rainy day"]
    assert [i["id"] for i in client.get(f"{API}/items", params={"tag": "rainy day"}).json()["items"]] == [item["id"]]
    assert client.get(f"{API}/items", params={"tag": "nope"}).json()["items"] == []

    # not a friend yet -> 403
    res = client.post(f"{API}/items/{item['id']}/share", json={"friend_ids": [str(bob.id)]})
    assert res.status_code == 403

    pg_session = client.app.dependency_overrides[get_db]()
    pg_session.add(FriendRequest(sender_id=alice.id, receiver_id=bob.id, status="accepted"))
    pg_session.flush()
    res = client.post(f"{API}/items/{item['id']}/share", json={"friend_ids": [str(bob.id)]})
    assert res.status_code == 200, res.text
    again = client.post(f"{API}/items/{item['id']}/share", json={"friend_ids": [str(bob.id)]})
    assert again.json()["sent"] == [] and len(again.json()["already_shared"]) == 1

    current["user"] = bob
    got = client.get(f"{API}/items").json()["items"]
    assert len(got) == 1
    assert got[0]["shared_by_name"] == alice.full_name and got[0]["is_unsorted"] is True
    assert got[0]["note"] is None and got[0]["stars"] == 0 and got[0]["tags"] == []
