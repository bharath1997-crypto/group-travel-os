"""Wayra intent classification and local fallback behavior."""

from __future__ import annotations

import pytest

from app.services.wayra_intent import (
    AppIntent,
    WayraMode,
    classify_mode,
    contextual_app_fallback,
    resolve_app_intent,
    resolve_app_guide_message,
    travel_fallback_message,
)


class TestClassifyMode:
    def test_create_group_is_app_guide(self) -> None:
        assert classify_mode("How do I create a group?") == WayraMode.APP_GUIDE

    def test_plan_page_is_app_guide(self) -> None:
        assert classify_mode("What is the Plan page for?") == WayraMode.APP_GUIDE

    def test_notifications_is_app_guide(self) -> None:
        assert classify_mode("How do I see my notifications?") == WayraMode.APP_GUIDE

    def test_weekend_destination_is_travel(self) -> None:
        assert classify_mode("Suggest a weekend trip destination") == WayraMode.TRAVEL

    def test_japan_places_is_travel(self) -> None:
        assert classify_mode("Best places to visit in Japan") == WayraMode.TRAVEL


class TestResolveAppIntent:
    def test_create_group_intent(self) -> None:
        assert resolve_app_intent("How do I create a group?") == AppIntent.CREATE_GROUP

    def test_create_trip_intent(self) -> None:
        assert resolve_app_intent("How do I create a trip?") == AppIntent.CREATE_TRIP

    def test_plan_page_intent(self) -> None:
        assert resolve_app_intent("What is the Plan page for?") == AppIntent.PLAN_PAGE

    def test_notifications_intent(self) -> None:
        assert resolve_app_intent("How do I see my notifications?") == AppIntent.NOTIFICATIONS

    def test_group_not_trip(self) -> None:
        msg = resolve_app_guide_message("How do I create a group?", "dashboard")
        assert msg is not None
        assert "group" in msg.lower()
        assert "new trip" not in msg.lower()
        assert "travel hub" in msg.lower() or "sidebar" in msg.lower()

    def test_notifications_not_settings(self) -> None:
        msg = resolve_app_guide_message("How do I see my notifications?", "dashboard")
        assert msg is not None
        assert "bell" in msg.lower()
        assert "password" not in msg.lower()


class TestTravelFallback:
    def test_japan_fallback_has_curated_cities(self) -> None:
        msg = travel_fallback_message("Best places to visit in Japan")
        assert msg is not None
        assert "Tokyo" in msg
        assert "Kyoto" in msg
        assert "taking longer" in msg.lower()

    def test_weekend_fallback_chicago(self) -> None:
        msg = travel_fallback_message(
            "Suggest a weekend trip destination",
            {"city": "Chicago"},
        )
        assert msg is not None
        assert "Milwaukee" in msg or "Lake Geneva" in msg
        assert "temporarily unavailable" not in msg.lower()

    def test_weekend_fallback_generic(self) -> None:
        msg = travel_fallback_message("Suggest a weekend getaway")
        assert msg is not None
        assert "poll" in msg.lower()


class TestContextualAppFallback:
    def test_dashboard_not_old_boilerplate(self) -> None:
        msg = contextual_app_fallback("dashboard")
        assert "command center" in msg.lower() or "trip" in msg.lower()
        assert "what do you want to do in the app" not in msg.lower()

    def test_plan_page_context(self) -> None:
        msg = contextual_app_fallback("plan")
        assert "flights" in msg.lower() or "plan" in msg.lower()


class TestAIAssistantServiceIntegration:
    def test_app_guide_local_without_api_keys(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """App Guide matched intents return locally even when LLM keys are absent."""
        from app.schemas.ai_assistant import AIAssistantRequest
        from app.services.ai_assistant_service import AIAssistantService

        monkeypatch.setattr("app.services.ai_assistant_service._gemini_key", lambda: "")
        monkeypatch.setattr("app.services.ai_assistant_service._openai_key", lambda: "")

        req = AIAssistantRequest(
            page="dashboard",
            user_message="How do I create a group?",
            trip_id=None,
            group_id=None,
            active_tab=None,
            context={},
        )
        resp = AIAssistantService.respond(req)
        assert "travel hub" in resp.message.lower() or "group" in resp.message.lower()
        assert "temporarily unavailable" not in resp.message.lower()
        assert resp.summary and resp.summary.get("local") is True

    def test_travel_failure_uses_curated_fallback(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from app.schemas.ai_assistant import AIAssistantRequest
        from app.services.ai_assistant_service import AIAssistantService

        monkeypatch.setattr("app.services.ai_assistant_service._gemini_key", lambda: "")
        monkeypatch.setattr("app.services.ai_assistant_service._openai_key", lambda: "")

        req = AIAssistantRequest(
            page="dashboard",
            user_message="Best places to visit in Japan",
            trip_id=None,
            group_id=None,
            active_tab=None,
            context={},
        )
        resp = AIAssistantService.respond(req)
        assert "Tokyo" in resp.message
        assert "You asked:" not in resp.message
