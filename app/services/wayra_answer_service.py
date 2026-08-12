"""Perplexity-style Wayra: open sources first, compact LLM summary, hybrid routing."""

from __future__ import annotations

import logging
from typing import Any

from app.schemas.ai_assistant import AIAssistantResponse, WayraSource
from app.services.places_nearby_service import calculate_distance_miles
from app.services.wayra_intent import WayraMode, _is_live_page
from app.services.wayra_llm_providers import summarize_from_sources
from app.services.wayra_behavior_hints import is_composite_whats_here_question
from app.services.wayra_source_intent import (
    classify_wayra_answer_tier,
    extract_place_from_context,
    is_distance_from_me_question,
    nearby_category_from_message,
)
from app.services.wayra_place_context import normalize_place_for_sources
from app.services.wayra_sources_service import (
    build_route_context_block,
    build_user_place_distance_block,
    fetch_discovery_sources,
    fetch_nearby_sources,
    fetch_nearby_sources_combined,
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
            from app.services.wayra_events_context import try_future_events_reply

            future_local = try_future_events_reply(request.user_message, place)
            if future_local is not None:
                return future_local
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
            if category == "all":
                sources, block, _pois = await fetch_nearby_sources_combined(
                    lat=lat,
                    lng=lng,
                    place_label=label,
                )
            else:
                sources, block, _pois = await fetch_nearby_sources(
                    category=category,
                    lat=lat,
                    lng=lng,
                    place_label=label,
                )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Wayra nearby sources failed: %s", exc)
            return AIAssistantResponse(
                message=(
                    "I couldn't load nearby places from OpenStreetMap right now — the map data "
                    "service may be busy. Try again in a moment, or use Search on the Live map."
                ),
                sources=[],
                summary={
                    "intent": "nearby",
                    "tier": "nearby",
                    "provider": "local",
                    "local": True,
                    "osm_error": True,
                },
            )

        if not block.strip() or (block.startswith("No ") and "found within" in block):
            empty_msg = (
                f"I searched OpenStreetMap near {label} but didn't find mapped "
                f"{category.replace('_', ' ')} in this radius. Try widening the area on the map "
                "or ask about a specific category (restaurants, cafes, attractions)."
            )
            if block.strip():
                empty_msg = f"{empty_msg}\n\n{block.strip()}"
            return AIAssistantResponse(
                message=empty_msg,
                sources=sources,
                summary={
                    "intent": "nearby",
                    "tier": "nearby",
                    "provider": "local",
                    "local": True,
                    "category": category,
                    "empty": True,
                },
            )

        message, provider, usage = await summarize_from_sources(
            user_message=user_message,
            place_label=label,
            source_block=block,
            tier="nearby",
            ctx=ctx,
            place=place,
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
        normalized = normalize_place_for_sources(place, ctx)
        label = str(normalized.get("name") or "Selected location")
        try:
            sources, block = await fetch_discovery_sources(
                normalized,
                ctx,
                user_message=user_message,
            )
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
            ctx=ctx,
            place=place,
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
    def _try_local_distance_answer(
        user_message: str,
        ctx: dict[str, Any],
        place: dict[str, Any] | None,
    ) -> AIAssistantResponse | None:
        """Zero-token distance answer when GPS + pin are both known."""
        if is_composite_whats_here_question(user_message):
            return None
        if not is_distance_from_me_question(user_message) or not place:
            return None

        block = build_user_place_distance_block(ctx, place)
        if not block:
            return None

        user = ctx.get("userLocation")
        user_label = "your location"
        if isinstance(user, dict):
            user_label = str(
                user.get("city") or user.get("state") or user.get("country") or user_label
            )
        place_label = str(place.get("name") or "the selected place")

        u_lat = float(user["lat"])  # type: ignore[index]
        u_lng = float(user["lng"])  # type: ignore[index]
        p_lat = float(place["lat"])
        p_lng = float(place["lng"])
        miles = calculate_distance_miles(u_lat, u_lng, p_lat, p_lng)

        parts = [
            f"As the crow flies, {place_label} is about {miles:,.0f} mi "
            f"({miles * 1.609:,.0f} km) from {user_label}."
        ]
        route = ctx.get("routePreview")
        if isinstance(route, dict):
            dist = route.get("distanceMeters")
            dur = route.get("durationSeconds")
            if isinstance(dist, (int, float)) and dist > 0:
                route_mi = round(float(dist) / 1609.34, 1)
                parts.append(f"The mapped driving route is about {route_mi} mi.")
            if isinstance(dur, (int, float)) and dur > 0:
                parts.append(f"Estimated drive time: {int(dur) // 60} min.")
        else:
            parts.append("Set a route on the map for turn-by-turn driving distance.")

        return AIAssistantResponse(
            message=" ".join(parts),
            sources=[],
            summary={
                "intent": "location_hard",
                "tier": "location_hard",
                "provider": "local",
                "local": True,
                "usage": None,
            },
        )

    @staticmethod
    async def _answer_location_hard(
        user_message: str,
        ctx: dict[str, Any],
        place: dict[str, Any] | None,
    ) -> AIAssistantResponse | None:
        local_distance = WayraAnswerService._try_local_distance_answer(
            user_message, ctx, place
        )
        if local_distance is not None:
            return local_distance

        label = str(place.get("name") if place else "your route")
        route_block = build_route_context_block(ctx)
        distance_block = build_user_place_distance_block(ctx, place) if place else ""
        source_block = "\n".join(p for p in (route_block, distance_block) if p).strip()
        source_block = source_block or "No route details in context."
        if place:
            try:
                _, disc_block = await fetch_discovery_sources(place, ctx, user_message=user_message)
                source_block = f"{source_block}\n\n{disc_block}".strip()
            except Exception:  # noqa: BLE001
                pass

        message, provider, usage = await summarize_from_sources(
            user_message=user_message,
            place_label=label,
            source_block=source_block,
            tier="location_hard",
            ctx=ctx,
            place=place,
        )
        sources: list[WayraSource] = []
        if place:
            try:
                sources, _ = await fetch_discovery_sources(place, ctx)
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
