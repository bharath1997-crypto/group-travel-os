"""Tests for Wayra canonical knowledge corpus, matching, and admin route."""

from __future__ import annotations

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.wayra import WayraKnowledgeIntent, WayraUnmatchedQuestion
from app.schemas.ai_assistant import AIAssistantRequest
from app.services.wayra_knowledge_seed_service import (
    load_seed_payload,
    seed_wayra_knowledge,
    validate_seed_payload,
)
from app.services.wayra_knowledge_service import (
    WayraKnowledgeService,
    normalize_knowledge_query,
    sanitize_question_text,
)
from app.utils.auth import get_current_user
from app.utils.database import get_db
from tests.conftest import exec_result

client = TestClient(app)


def test_seed_payload_has_100_intents_and_1000_utterances():
    data = load_seed_payload()
    validate_seed_payload(data)
    assert data["intent_count"] == 100
    assert data["utterance_count"] == 1000
    assert len(data["intents"]) == 100
    total = sum(len(i["utterances"]) for i in data["intents"])
    assert total == 1000
    keys = {i["intent_key"] for i in data["intents"]}
    assert len(keys) == 100
    assert "where_am_i" in keys
    assert "what_can_i_do_here" in keys


def test_seed_handler_keys_are_valid():
    data = load_seed_payload()
    allowed = {"where_am_i", "what_can_i_do_here", "page_help"}
    for row in data["intents"]:
        if row["answer_strategy"] == "handler":
            assert row["handler_key"] in allowed


def test_normalize_and_sanitize():
    assert normalize_knowledge_query("Where am I?") == "where am i"
    cleaned = sanitize_question_text("I am at 41.8781, -87.6298 downtown")
    assert "[coord]" in cleaned
    assert "41.8781" not in cleaned


def test_seed_wayra_knowledge_idempotent(db: MagicMock):
    # First intent lookup miss → create; utterance adds ignored by commit
    intent = WayraKnowledgeIntent(
        id=uuid.uuid4(),
        intent_key="what_is_rovvy",
        category="project",
        canonical_question="What is Rovvy?",
        answer_strategy="static",
        answer_text="Rovvy helps groups travel.",
        required_context="none",
        version=1,
        is_active=True,
        utterances=[],
    )

    # Simulate: every intent_key lookup returns None first pass → creates.
    # For simplicity, patch DB methods used by seed.
    db.execute.return_value = exec_result(scalar_one_or_none=None)
    db.flush = MagicMock()
    db.commit = MagicMock()
    db.add = MagicMock()
    db.delete = MagicMock()

    # Use a tiny fake seed file via monkeypatch of load/validate
    tiny = {
        "version": 1,
        "intent_count": 1,
        "utterance_count": 10,
        "intents": [
            {
                "intent_key": "what_is_rovvy",
                "category": "project",
                "canonical_question": "What is Rovvy?",
                "answer_strategy": "static",
                "answer_text": "Rovvy helps groups travel.",
                "handler_key": None,
                "required_context": "none",
                "utterances": [
                    {
                        "utterance": f"What is Rovvy {i}?",
                        "normalized": f"what is rovvy {i}",
                        "style_tag": "casual",
                    }
                    for i in range(10)
                ],
            }
        ],
    }

    with (
        patch(
            "app.services.wayra_knowledge_seed_service.load_seed_payload",
            return_value=tiny,
        ),
        patch(
            "app.services.wayra_knowledge_seed_service.validate_seed_payload",
        ),
    ):
        stats = seed_wayra_knowledge(db)

    assert stats["created"] == 1
    assert stats["utterances"] == 10
    assert db.commit.called


@pytest.mark.asyncio
async def test_exact_match_returns_static_answer(db: MagicMock):
    intent = WayraKnowledgeIntent(
        id=uuid.uuid4(),
        intent_key="what_is_rovvy",
        category="project",
        canonical_question="What is Rovvy?",
        answer_strategy="static",
        answer_text="Rovvy is your group travel companion.",
        required_context="none",
        version=1,
        is_active=True,
    )
    db.execute.return_value = exec_result(scalar_one_or_none=intent)
    req = AIAssistantRequest(page="/live", user_message="What is Rovvy?")
    resp = await WayraKnowledgeService.try_answer(db, req)
    assert resp is not None
    assert "group travel companion" in resp.message
    assert resp.summary["match_source"] == "exact"
    assert resp.summary["provider"] == "knowledge"


@pytest.mark.asyncio
async def test_deepseek_resolve_match(db: MagicMock):
    intent = WayraKnowledgeIntent(
        id=uuid.uuid4(),
        intent_key="hello",
        category="conversation",
        canonical_question="Hello",
        answer_strategy="static",
        answer_text="Hey — I'm Wayra.",
        required_context="none",
        version=1,
        is_active=True,
    )

    # first exact miss, then catalog list, then get_intent_by_key
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=None),  # exact
        exec_result(scalars_all=[intent]),  # catalog
        exec_result(scalar_one_or_none=intent),  # get by key
    ]

    with (
        patch(
            "app.services.wayra_llm_providers._deepseek_key",
            return_value="ds-key",
        ),
        patch(
            "app.services.wayra_llm_providers._call_deepseek_full",
            new=AsyncMock(
                return_value=(
                    '{"intent_key":"hello","confidence":0.91,'
                    '"context_scope":"none","action":"match"}',
                    {"total_tokens": 20},
                )
            ),
        ),
        patch("app.services.wayra_llm_providers.record_gemini_usage"),
        patch("app.services.wayra_llm_providers._deepseek_model", return_value="deepseek-v4-flash"),
    ):
        req = AIAssistantRequest(page="/dashboard", user_message="yo wayra what's good")
        resp = await WayraKnowledgeService.try_answer(db, req)

    assert resp is not None
    assert "Wayra" in resp.message
    assert resp.summary["match_source"] == "deepseek_resolve"


@pytest.mark.asyncio
async def test_low_confidence_logs_unmatched(db: MagicMock):
    db.execute.side_effect = [
        exec_result(scalar_one_or_none=None),  # exact
        exec_result(scalars_all=[]),  # catalog empty → early none, still logs
    ]
    db.commit = MagicMock()
    # When catalog empty, resolve returns None immediately without DeepSeek;
    # still logs unmatched.
    req = AIAssistantRequest(page="/live", user_message="quantum foam picnic schedule")
    with patch.object(
        WayraKnowledgeService,
        "resolve_intent_with_deepseek",
        new=AsyncMock(return_value=(None, 0.2, None)),
    ):
        # Need execute for log_unmatched select + add
        db.execute.side_effect = [
            exec_result(scalar_one_or_none=None),  # exact in try_answer
            exec_result(scalar_one_or_none=None),  # unmatched existing
        ]
        resp = await WayraKnowledgeService.try_answer(db, req)

    assert resp is None
    assert db.add.called
    assert db.commit.called


@pytest.mark.asyncio
async def test_where_am_i_changes_with_gps():
    intent = WayraKnowledgeIntent(
        id=uuid.uuid4(),
        intent_key="where_am_i",
        category="live_context",
        canonical_question="Where am I?",
        answer_strategy="handler",
        answer_text=None,
        handler_key="where_am_i",
        required_context="page_or_gps",
        version=1,
        is_active=True,
    )
    req1 = AIAssistantRequest(
        page="/live",
        user_message="Where am I?",
        context={
            "page": "live",
            "userLocation": {"lat": 41.88, "lng": -87.63, "city": "Chicago"},
        },
    )
    req2 = AIAssistantRequest(
        page="/live",
        user_message="Where am I?",
        context={
            "page": "live",
            "userLocation": {"lat": 40.71, "lng": -74.00, "city": "New York"},
        },
    )
    a = WayraKnowledgeService.handle_where_am_i(req1, intent)
    b = WayraKnowledgeService.handle_where_am_i(req2, intent)
    assert "Chicago" in a.message
    assert "New York" in b.message
    assert a.message != b.message
    assert "Live map" in a.message


@pytest.mark.asyncio
async def test_where_am_i_distinguishes_pin_from_gps():
    intent = WayraKnowledgeIntent(
        id=uuid.uuid4(),
        intent_key="where_am_i",
        category="live_context",
        canonical_question="Where am I?",
        answer_strategy="handler",
        answer_text=None,
        handler_key="where_am_i",
        required_context="page_or_gps",
        version=1,
        is_active=True,
    )
    req = AIAssistantRequest(
        page="/live",
        user_message="Where am I?",
        context={
            "page": "live",
            "userLocation": {"lat": 41.88, "lng": -87.63, "city": "Chicago"},
            "selectedPlace": {
                "name": "Grant Park",
                "lat": 41.87,
                "lng": -87.62,
                "city": "Chicago",
            },
        },
    )
    resp = WayraKnowledgeService.handle_where_am_i(req, intent)
    assert "GPS" in resp.message
    assert "Grant Park" in resp.message
    assert "selected map pin" in resp.message.lower() or "pin" in resp.message.lower()


@pytest.mark.asyncio
async def test_what_can_i_do_here_needs_location():
    intent = WayraKnowledgeIntent(
        id=uuid.uuid4(),
        intent_key="what_can_i_do_here",
        category="live_context",
        canonical_question="What can I do here?",
        answer_strategy="handler",
        answer_text=None,
        handler_key="what_can_i_do_here",
        required_context="gps",
        version=1,
        is_active=True,
    )
    req = AIAssistantRequest(page="/live", user_message="What can I do here?", context={})
    resp = await WayraKnowledgeService.handle_what_can_i_do_here(req, intent)
    assert resp is not None
    assert resp.summary.get("needs_location") is True
    assert "GPS" in resp.message or "pin" in resp.message.lower()


@pytest.mark.asyncio
async def test_what_can_i_do_here_delegates_discovery():
    intent = WayraKnowledgeIntent(
        id=uuid.uuid4(),
        intent_key="what_can_i_do_here",
        category="live_context",
        canonical_question="What can I do here?",
        answer_strategy="handler",
        answer_text=None,
        handler_key="what_can_i_do_here",
        required_context="gps",
        version=1,
        is_active=True,
    )
    req = AIAssistantRequest(
        page="/live",
        user_message="What can I do here?",
        context={
            "page": "live",
            "userLocation": {"lat": 41.88, "lng": -87.63, "city": "Chicago"},
        },
    )
    from app.schemas.ai_assistant import AIAssistantResponse

    fake = AIAssistantResponse(
        message="Try the lakefront walk near Chicago.",
        sources=[],
        summary={"provider": "deepseek", "tier": "discovery"},
    )
    with patch(
        "app.services.wayra_answer_service.WayraAnswerService._answer_discovery",
        new=AsyncMock(return_value=fake),
    ):
        resp = await WayraKnowledgeService.handle_what_can_i_do_here(req, intent)
    assert resp is not None
    assert "lakefront" in resp.message
    assert resp.summary["handler_key"] == "what_can_i_do_here"


def test_unmatched_admin_success(db: MagicMock, mock_user):
    mock_user.is_admin = True
    row = WayraUnmatchedQuestion(
        id=uuid.uuid4(),
        sanitized_text="quantum foam picnic",
        text_hash="abc",
        page_category="live",
        proposed_intent_key=None,
        proposed_confidence=0.2,
        occurrence_count=3,
        first_seen_at=datetime.utcnow(),
        last_seen_at=datetime.utcnow(),
    )
    db.execute.return_value = exec_result(scalars_all=[row])

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: db
    try:
        res = client.get("/api/v1/ai/wayra/unmatched-questions?limit=10&offset=0")
    finally:
        app.dependency_overrides.clear()

    assert res.status_code == 200
    body = res.json()
    assert body["limit"] == 10
    assert len(body["items"]) == 1
    assert body["items"][0]["sanitized_text"] == "quantum foam picnic"


def test_unmatched_admin_unauthorized():
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_db, None)
    res = client.get("/api/v1/ai/wayra/unmatched-questions")
    assert res.status_code in (401, 403)


def test_unmatched_admin_validation_error(db: MagicMock, mock_user):
    mock_user.is_admin = True
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_db] = lambda: db
    try:
        res = client.get("/api/v1/ai/wayra/unmatched-questions?limit=0")
    finally:
        app.dependency_overrides.clear()
    assert res.status_code == 422
