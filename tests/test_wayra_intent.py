"""Wayra intent classification and local fallback behavior."""

from __future__ import annotations

import asyncio

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
        resp = asyncio.run(AIAssistantService.respond(req))
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
        resp = asyncio.run(AIAssistantService.respond(req))
        assert "Tokyo" in resp.message
        assert "You asked:" not in resp.message


class TestAIAssistantRoute:
    def test_ai_assistant_endpoint_without_auth(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from fastapi.testclient import TestClient

        from app.main import app

        monkeypatch.setattr("app.services.ai_assistant_service._gemini_key", lambda: "")
        monkeypatch.setattr("app.services.ai_assistant_service._openai_key", lambda: "")

        client = TestClient(app)
        response = client.post(
            "/api/v1/ai/assistant",
            json={
                "page": "live",
                "user_message": "Best places to visit in Japan",
                "trip_id": None,
                "group_id": None,
                "active_tab": None,
                "context": {},
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert "message" in body
        assert body["message"]


class TestLiveMapContextReply:
    def test_pick_location_question_uses_selected_place(self) -> None:
        from app.services.wayra_intent import resolve_live_map_context_message

        msg = resolve_live_map_context_message(
            "What location did I pick over there?",
            "live",
            {
                "pathname": "/live",
                "selectedPlace": {
                    "name": "Dropped pin",
                    "lat": 49.90511,
                    "lng": -116.8219,
                    "category": None,
                },
                "liveStage": "place_preview",
            },
        )
        assert msg is not None
        assert "Dropped pin" in msg
        assert "49.90511" in msg
        assert "116.8219" in msg
        assert "create a group" not in msg.lower()

    def test_live_map_context_via_assistant_service(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from app.schemas.ai_assistant import AIAssistantRequest
        from app.services.ai_assistant_service import AIAssistantService

        async def _no_enrich(ctx: dict | None) -> dict | None:
            return ctx

        monkeypatch.setattr(
            "app.services.ai_assistant_service._enrich_live_context",
            _no_enrich,
        )

        req = AIAssistantRequest(
            page="live",
            user_message="What location did I pick?",
            trip_id=None,
            group_id=None,
            active_tab=None,
            context={
                "pathname": "/live",
                "selectedPlace": {
                    "name": "Dropped pin",
                    "lat": 2.642,
                    "lng": 44.92593,
                },
                "liveStage": "destination_set",
            },
        )
        resp = asyncio.run(AIAssistantService.respond(req))
        assert "Dropped pin" in resp.message
        assert resp.summary and resp.summary.get("intent") == "live_map_context"

    def test_deep_location_question_skips_coordinate_stub(self) -> None:
        from app.services.wayra_intent import resolve_live_map_context_message

        msg = (
            "I just want to know about this location properly. "
            "What is this location? What do people do? What is the language?"
        )
        reply = resolve_live_map_context_message(
            msg,
            "live",
            {
                "pathname": "/live",
                "selectedPlace": {"name": "Dropped pin", "lat": 31.66, "lng": 106.07},
            },
        )
        assert reply is None

    def test_enrich_live_context_resolves_generic_pin(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from app.services.ai_assistant_service import _enrich_live_context

        async def fake_reverse(lat: float, lng: float) -> dict:
            return {
                "name": "Unnamed road",
                "display_name": "Unnamed road, Guangyuan, Sichuan, China",
                "address": {
                    "city": "Guangyuan",
                    "state": "Sichuan",
                    "country": "China",
                },
            }

        monkeypatch.setattr(
            "app.services.geocoding_service.GeocodingService.reverse_geocode",
            fake_reverse,
        )

        ctx = {
            "pathname": "/live",
            "selectedPlace": {"name": "Dropped pin", "lat": 31.66, "lng": 106.07},
        }
        enriched = asyncio.run(_enrich_live_context(ctx))
        assert enriched is not None
        place = enriched["selectedPlace"]
        assert place["city"] == "Guangyuan"
        assert place["country"] == "China"
        assert "Sichuan" in place["name"] or place["name"] == "Guangyuan, Sichuan, China"
        assert enriched.get("resolvedMapRegion") == "Guangyuan, Sichuan, China"

    def test_trip_prep_on_live_skips_generic_live_map_app_guide(self) -> None:
        from app.schemas.ai_assistant import AIAssistantRequest
        from app.services.ai_assistant_service import AIAssistantService

        prompt = (
            "I'm planning a trip to Dehcho Region on Rovvy Live. "
            "Here are the tips and warnings I see:\n"
            "- Check the location before starting live travel.\n"
            "- Far from your current area.\n\n"
            "What should I know and how should I prepare?"
        )
        req = AIAssistantRequest(
            page="live",
            user_message=prompt,
            trip_id=None,
            group_id=None,
            active_tab=None,
            context={
                "pathname": "/live",
                "selectedPlace": {
                    "name": "Dehcho Region",
                    "lat": 61.58256,
                    "lng": -121.81618,
                    "address": "Northwest Territories",
                },
                "aiSuggestions": [
                    {"message": "Far from your current area.", "kind": "tip"},
                    {
                        "message": "This route crosses an international border (United States -> Canada).",
                        "kind": "warning",
                    },
                ],
                "routePreview": {
                    "durationSeconds": 54 * 3600 + 41 * 60,
                    "distanceMeters": 3987000,
                    "borderNotice": "Cross-border travel. Expect passport checks.",
                },
            },
        )
        resp = asyncio.run(AIAssistantService.respond(req))
        assert "Open Group" not in resp.message
        assert "Dehcho Region" in resp.message or "prepare" in resp.message.lower()
