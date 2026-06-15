import uuid
import pytest
from datetime import datetime
from unittest.mock import MagicMock, patch
from app.services.wayra_group_service import WayraGroupService, _group_cache
from app.models.wayra import WayraGroupSettings, WayraGroupMemory
from app.models.trip import Trip, TripStatus
from app.models.user import User
from app.models.expense import Expense
from app.models.cart import TravelCart
from app.models.lounge import LoungeChat

class DummyDB:
    def __init__(self):
        self.added = []
        self.flushed = False
    def add(self, item):
        self.added.append(item)
    def flush(self):
        self.flushed = True
    def execute(self, stmt):
        pass

def test_store_group_memory():
    db = DummyDB()
    group_id = uuid.uuid4()
    mem = WayraGroupService.store_memory(
        db=db,
        group_id=group_id,
        memory_type="test_group_type",
        content="Group Content",
        source="group_source",
        source_id="456"
    )
    assert mem is not None
    assert mem.group_id == group_id
    assert mem.memory_type == "test_group_type"
    assert mem.content == "Group Content"
    assert mem.wayra_visible is True
    assert len(db.added) == 1
    assert db.flushed is True

def test_detect_travel_url():
    r1 = WayraGroupService.detect_travel_url("Check this Airbnb link: https://www.airbnb.com/rooms/12345")
    assert r1["is_travel_url"] is True
    assert r1["url"] == "https://www.airbnb.com/rooms/12345"

    r2 = WayraGroupService.detect_travel_url("Look at this beautiful view: https://instagram.com/reel/C8P1x8")
    assert r2["is_travel_url"] is True
    assert r2["url"] == "https://instagram.com/reel/C8P1x8"

    r3 = WayraGroupService.detect_travel_url("Directions: https://google.com/maps/place/Grand+Canyon")
    assert r3["is_travel_url"] is True
    assert r3["url"] == "https://google.com/maps/place/Grand+Canyon"

    r4 = WayraGroupService.detect_travel_url("Just random talk about travel")
    assert r4["is_travel_url"] is False

def test_get_group_context():
    db_session = MagicMock()
    group_id = uuid.uuid4()
    
    user = User(full_name="Bob", id=uuid.uuid4())
    trip = Trip(id=uuid.uuid4(), title="Alpine Skiing", status=TripStatus.planning)
    expense = Expense(description="Lift ticket", amount=200.0, currency="USD", payer=user)
    cart_item = TravelCart(item_name="Ski gear rental", item_type="booking")
    memory = WayraGroupMemory(memory_type="info", content="Prefer snow activities")
    chat = LoungeChat(id=uuid.uuid4(), name="Ski Lounge")

    class MockExecuteResult:
        def __init__(self, items):
            self.items = items
        def scalars(self):
            return self
        def all(self):
            return self.items

    db_session.execute.side_effect = [
        MockExecuteResult([user]),      # members
        MockExecuteResult([trip]),      # trips
        MockExecuteResult([expense]),   # expenses
        MockExecuteResult([cart_item]), # cart
        MockExecuteResult([memory]),    # memories
        MockExecuteResult([chat])       # chats
    ]

    with patch("app.services.wayra_group_service.get_rtdb") as mock_rtdb:
        mock_rtdb.side_effect = [
            {"m1": {"sender_name": "Bob", "text": "Who is coming?", "wayra_visible": True}}, # trip chats
            {"m2": {"sender_name": "Alice", "message": "Ready!", "wayra_visible": True}}    # live chats
        ]
        
        context = WayraGroupService.get_group_context(group_id, db_session)
        assert context["members"] == ["Bob"]
        assert len(context["trips"]) == 1
        assert context["trips"][0]["title"] == "Alpine Skiing"
        assert len(context["expenses"]) == 1
        assert context["expenses"][0]["paid_by"] == "Bob"
        assert len(context["cart"]) == 1
        assert len(context["memory"]) == 1
        assert len(context["messages"]) == 2

def test_group_mention_disabled():
    db_session = MagicMock()
    group_id = uuid.uuid4()
    message = "@wayra recommend a hotel"
    
    settings = WayraGroupSettings(group_id=group_id, wayra_enabled=False)
    db_session.execute.return_value.scalar_one_or_none.return_value = settings
    
    res = WayraGroupService.respond_to_mention(group_id, message, "Bob", db_session)
    assert res is None

def test_group_mention_rate_limited():
    db_session = MagicMock()
    group_id = uuid.uuid4()
    message = "@wayra hello"
    
    settings = WayraGroupSettings(group_id=group_id, wayra_enabled=True)
    db_session.execute.return_value.scalar_one_or_none.return_value = settings
    
    with patch("app.services.wayra_group_service.check_group_limit") as mock_limit:
        mock_limit.return_value = {"allowed": False, "retry_after_minutes": 10}
        
        res = WayraGroupService.respond_to_mention(group_id, message, "Bob", db_session)
        assert "Rate limit reached" in res
