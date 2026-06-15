import uuid
import pytest
from datetime import datetime
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from app.services.wayra_personal_service import WayraPersonalService, _personal_cache
from app.models.wayra import WayraPersonalMemory
from app.models.trip import Trip, TripStatus
from app.models.cart import TravelCart
from app.models.saved_pin import SavedPin
from app.models.location import Location
from app.models.expense import Expense, ExpenseSplit
from app.models.lounge import LoungeChat
from app.utils.exceptions import AppException

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

def test_store_memory():
    db = DummyDB()
    user_id = uuid.uuid4()
    mem = WayraPersonalService.store_memory(
        db=db,
        user_id=user_id,
        memory_type="test_type",
        content="Test Content",
        source="test_source",
        source_id="123"
    )
    assert mem is not None
    assert mem.user_id == user_id
    assert mem.memory_type == "test_type"
    assert mem.content == "Test Content"
    assert mem.source == "test_source"
    assert mem.source_id == "123"
    assert mem.wayra_visible is True
    assert len(db.added) == 1
    assert db.flushed is True

def test_store_memory_mock_session():
    mock_db = MagicMock()
    mock_db.__class__.__name__ = "MagicMock"
    res = WayraPersonalService.store_memory(
        db=mock_db,
        user_id=uuid.uuid4(),
        memory_type="test",
        content="test"
    )
    assert res is None

def test_get_user_context():
    db_session = MagicMock()
    user_id = uuid.uuid4()
    
    trip = Trip(id=uuid.uuid4(), title="Paris 2026", description="Paris", status=TripStatus.planning)
    cart_item = TravelCart(id=uuid.uuid4(), item_name="Eiffel Tower Tour", item_type="activity")
    pin = SavedPin(name="Lover's Point", latitude=48.8, longitude=2.2)
    loc = Location(name="Hotel de Paris", address="123 Paris St")
    expense = Expense(description="Dinner", amount=150.0, currency="EUR")
    split = ExpenseSplit(expense=Expense(description="Lunch", amount=50.0, currency="EUR"), amount=25.0, is_settled=False)
    chat = LoungeChat(id=uuid.uuid4(), name="Paris Lounge")
    memory = WayraPersonalMemory(memory_type="pref", content="Likes museums")

    class MockExecuteResult:
        def __init__(self, items):
            self.items = items
        def scalars(self):
            return self
        def all(self):
            return self.items

    db_session.execute.side_effect = [
        MockExecuteResult([trip]),      # trips
        MockExecuteResult([cart_item]), # cart
        MockExecuteResult([pin]),       # pins
        MockExecuteResult([loc]),       # locations
        MockExecuteResult([expense]),   # paid expenses
        MockExecuteResult([split]),     # split expenses
        MockExecuteResult([chat]),      # lounge chats
        MockExecuteResult([memory])     # memories
    ]

    with patch("app.services.wayra_personal_service.get_rtdb") as mock_rtdb:
        mock_rtdb.side_effect = [
            {"msg1": {"sender_name": "Bob", "text": "Let's meet!", "wayra_visible": True}}, # chat msgs
            {"msg2": {"sender_name": "Alice", "message": "Arrived", "wayra_visible": True}} # trip live msgs
        ]
        
        context = WayraPersonalService.get_user_context(user_id, db_session)
        
        assert len(context["trips"]) == 1
        assert context["trips"][0]["title"] == "Paris 2026"
        assert len(context["cart"]) == 1
        assert context["cart"][0]["item_name"] == "Eiffel Tower Tour"
        assert len(context["saved_locations"]) == 2
        assert len(context["expenses"]) == 2
        assert len(context["messages"]) == 2
        assert context["messages"][0]["message"] == "Let's meet!"
        assert len(context["memory"]) == 1
        assert context["memory"][0]["content"] == "Likes museums"

def test_personal_chat_caching():
    db_session = MagicMock()
    user_id = uuid.uuid4()
    message = "Any hotel recommendations?"
    
    _personal_cache[(str(user_id), message.lower())] = ("Try Hotel Paris", ["Show details"], datetime.now().timestamp())
    
    res = WayraPersonalService.chat(user_id, message, db_session)
    assert res["response"] == "Try Hotel Paris"
    assert res["suggestions"] == ["Show details"]

def test_personal_chat_rate_limiting():
    db_session = MagicMock()
    user_id = uuid.uuid4()
    message = "Hello Wayra"
    
    with patch("app.services.wayra_personal_service.check_personal_limit") as mock_limit:
        mock_limit.return_value = {"allowed": False, "retry_after_minutes": 15}
        
        with pytest.raises(HTTPException) as excinfo:
            WayraPersonalService.chat(user_id, message, db_session)
            
        assert excinfo.value.status_code == 429
        assert "hourly limit" in excinfo.value.detail
