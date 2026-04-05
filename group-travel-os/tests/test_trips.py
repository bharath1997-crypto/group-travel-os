import json
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import create_app, db as _db


@pytest.fixture
def app():
    application = create_app("testing")
    with application.app_context():
        _db.create_all()
        yield application
        _db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


# ---------------------------------------------------------------------------
# Trip CRUD
# ---------------------------------------------------------------------------

def test_list_trips_empty(client):
    resp = client.get("/trips/")
    assert resp.status_code == 200
    assert resp.get_json() == []


def test_create_trip(client):
    payload = {"title": "Summer Escape", "destination": "Paris", "start_date": "2026-07-01", "end_date": "2026-07-14"}
    resp = client.post("/trips/", data=json.dumps(payload), content_type="application/json")
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["title"] == "Summer Escape"
    assert data["destination"] == "Paris"
    assert "id" in data


def test_create_trip_missing_fields(client):
    resp = client.post("/trips/", data=json.dumps({"title": "No destination"}), content_type="application/json")
    assert resp.status_code == 422
    assert "errors" in resp.get_json()


def test_get_trip(client):
    create_resp = client.post(
        "/trips/",
        data=json.dumps({"title": "Beach Trip", "destination": "Maldives"}),
        content_type="application/json",
    )
    trip_id = create_resp.get_json()["id"]
    resp = client.get(f"/trips/{trip_id}")
    assert resp.status_code == 200
    assert resp.get_json()["id"] == trip_id


def test_get_trip_not_found(client):
    resp = client.get("/trips/999")
    assert resp.status_code == 404


def test_update_trip(client):
    create_resp = client.post(
        "/trips/",
        data=json.dumps({"title": "Mountain Trek", "destination": "Alps"}),
        content_type="application/json",
    )
    trip_id = create_resp.get_json()["id"]
    resp = client.put(
        f"/trips/{trip_id}",
        data=json.dumps({"destination": "Rockies"}),
        content_type="application/json",
    )
    assert resp.status_code == 200
    assert resp.get_json()["destination"] == "Rockies"


def test_delete_trip(client):
    create_resp = client.post(
        "/trips/",
        data=json.dumps({"title": "Delete Me", "destination": "Nowhere"}),
        content_type="application/json",
    )
    trip_id = create_resp.get_json()["id"]
    resp = client.delete(f"/trips/{trip_id}")
    assert resp.status_code == 200
    assert client.get(f"/trips/{trip_id}").status_code == 404


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------

def _create_trip(client, title="Test Trip", destination="Rome"):
    resp = client.post(
        "/trips/",
        data=json.dumps({"title": title, "destination": destination}),
        content_type="application/json",
    )
    return resp.get_json()["id"]


def test_add_and_list_member(client):
    trip_id = _create_trip(client)
    resp = client.post(
        f"/trips/{trip_id}/members",
        data=json.dumps({"name": "Alice", "email": "alice@example.com"}),
        content_type="application/json",
    )
    assert resp.status_code == 201
    assert resp.get_json()["name"] == "Alice"

    list_resp = client.get(f"/trips/{trip_id}/members")
    assert list_resp.status_code == 200
    assert len(list_resp.get_json()) == 1


def test_remove_member(client):
    trip_id = _create_trip(client)
    member_id = client.post(
        f"/trips/{trip_id}/members",
        data=json.dumps({"name": "Bob"}),
        content_type="application/json",
    ).get_json()["id"]

    resp = client.delete(f"/trips/{trip_id}/members/{member_id}")
    assert resp.status_code == 200
    assert client.get(f"/trips/{trip_id}/members").get_json() == []


# ---------------------------------------------------------------------------
# Polls & Voting
# ---------------------------------------------------------------------------

def test_create_poll_and_vote(client):
    trip_id = _create_trip(client)
    member_id = client.post(
        f"/trips/{trip_id}/members",
        data=json.dumps({"name": "Carol"}),
        content_type="application/json",
    ).get_json()["id"]

    poll_resp = client.post(
        f"/trips/{trip_id}/polls",
        data=json.dumps({
            "question": "Where should we eat?",
            "options": [{"label": "Pizza"}, {"label": "Sushi"}],
        }),
        content_type="application/json",
    )
    assert poll_resp.status_code == 201
    poll = poll_resp.get_json()
    assert poll["question"] == "Where should we eat?"
    option_id = poll["options"][0]["id"]

    vote_resp = client.post(
        f"/trips/{trip_id}/polls/{poll['id']}/vote",
        data=json.dumps({"option_id": option_id, "member_id": member_id}),
        content_type="application/json",
    )
    assert vote_resp.status_code == 201

    # Duplicate vote should be rejected
    dup_resp = client.post(
        f"/trips/{trip_id}/polls/{poll['id']}/vote",
        data=json.dumps({"option_id": option_id, "member_id": member_id}),
        content_type="application/json",
    )
    assert dup_resp.status_code == 409
