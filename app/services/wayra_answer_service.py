"""Perplexity-style Wayra: open sources first, compact LLM summary, hybrid routing."""

from __future__ import annotations

import logging
from typing import Any

from app.schemas.ai_assistant import AIAssistantResponse, WayraSource
from app.services.wayra_intent import WayraMode, _is_live_page
from app.services.wayra_llm_providers import summarize_from_sources
from app.services.wayra_source_intent import (
    classify_wayra_answer_tier,
    extract_place_from_context,
    nearby_category_from_message,
)
from app.services.wayra_sources_service import (
    build_route_context_block,
    fetch_discovery_sources,
    fetch_nearby_sources,
)

logger = logging.getLogger(__name__)


class WayraAnswerService:
    @staticmethod
    async def try_answer(request, mode: WayraMode) -> AIAssistantResponse | None:
        if mode != WayraMode.TRAVEL:
            return None

        ctx = request.context if isinstance(request.context, dict) else {}
        tier = classify_wayra_answer_tier(request.user_message, ctx)
        place = extract_place_from_context(ctx)

        if tier == "nearby":
            return await WayraAnswerService._answer_nearby(request.user_message, ctx, place)

        if tier == "discovery" and place:
            return await WayraAnswerService._answer_discovery(request.user_message, ctx, place)

        if tier == "location_hard":
            return await WayraAnswerService._answer_location_hard(request.user_message, ctx, place)

        return None

    @staticmethod
    async def _answer_nearby(
        user_message: str,
        ctx: dict[str, Any],
        place: dict[str, Any] | None,
    ) -> AIAssistantResponse | None:
        category = nearby_category_from_message(user_message) or "all"
        if not place:
            return AIAssistantResponse(
                message=(
                    "Turn on location or pick a place on the map so I can search nearby "
                    "pharmacies, food, and other spots from OpenStreetMap."
                ),
                sources=[],
                summary={"intent": "nearby", "local": True, "needs_location": True},
            )

        lat, lng = float(place["lat"]), float(place["lng"])
        label = str(place.get("name") or "your location")
        try:
            sources, block = await fetch_nearby_sources(
                category=category,
                lat=lat,
                lng=lng,
                place_label=label,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Wayra nearby sources failed: %s", exc)
            return None

        message, provider, usage = await summarize_from_sources(
            user_message=user_message,
            place_label=label,
            source_block=block,
            tier="nearby",
        )
        return AIAssistantResponse(
            message=message,
            sources=sources,
            summary={
                "intent": "nearby",
                "tier": "nearby",
                "provider": provider,
                "category": category,
                "usage": usage,
            },
        )

    @staticmethod
    async def _answer_discovery(
        user_message: str,
        ctx: dict[str, Any],
        place: dict[str, Any],
    ) -> AIAssistantResponse | None:
        label = str(place.get("name") or "Selected location")
        try:
            sources, block = await fetch_discovery_sources(place)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Wayra discovery sources failed: %s", exc)
            return None

        if not block.strip():
            return None

        message, provider, usage = await summarize_from_sources(
            user_message=user_message,
            place_label=label,
            source_block=block,
            tier="discovery",
        )
        return AIAssistantResponse(
            message=message,
            sources=sources,
            summary={
                "intent": "discovery",
                "tier": "discovery",
                "provider": provider,
                "usage": usage,
                "on_live": _is_live_page("", ctx),
            },
        )

    @staticmethod
    async def _answer_location_hard(
        user_message: str,
        ctx: dict[str, Any],
        place: dict[str, Any] | None,
    ) -> AIAssistantResponse | None:
        label = str(place.get("name") if place else "your route")
        route_block = build_route_context_block(ctx)
        source_block = route_block or "No route details in context."
        if place:
            try:
                _, disc_block = await fetch_discovery_sources(place)
                source_block = f"{source_block}\n\n{disc_block}".strip()
            except Exception:  # noqa: BLE001
                pass

        message, provider, usage = await summarize_from_sources(
            user_message=user_message,
            place_label=label,
            source_block=source_block,
            tier="location_hard",
        )
        sources: list[WayraSource] = []
        if place:
            try:
                sources, _ = await fetch_discovery_sources(place)
            except Exception:  # noqa: BLE001
                pass

        return AIAssistantResponse(
            message=message,
            sources=sources[:6],
            summary={
                "intent": "location_hard",
                "tier": "location_hard",
                "provider": provider,
                "usage": usage,
            },
        )
