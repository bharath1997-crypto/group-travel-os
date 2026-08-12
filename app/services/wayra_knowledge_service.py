"""Wayra canonical knowledge matching, handlers, and unmatched-question logging."""

from __future__ import annotations

import hashlib
import json
import logging
import re
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.wayra import (
    WayraKnowledgeIntent,
    WayraKnowledgeUtterance,
    WayraUnmatchedQuestion,
)
from app.schemas.ai_assistant import AIAssistantRequest, AIAssistantResponse
from app.services.wayra_discovery import normalize_wayra_query
from app.services.wayra_intent import contextual_app_fallback
from app.services.wayra_place_context import normalize_place_for_sources

logger = logging.getLogger(__name__)

_CONFIDENCE_MIN = 0.72
_HANDLER_KEYS = frozenset({"where_am_i", "what_can_i_do_here", "page_help"})
_PAGE_LABELS = {
    "live": "Live map",
    "explore": "Explore",
    "plan": "Plan",
    "dashboard": "Dashboard",
    "profile": "Profile",
    "group": "Group / Travel Hub",
    "notifications": "Notifications",
    "trips": "Trips",
}


def normalize_knowledge_query(message: str) -> str:
    return normalize_wayra_query(message)[:500]


def page_category(page: str | None) -> str:
    raw = (page or "").strip().lower()
    if not raw:
        return "unknown"
    for key in _PAGE_LABELS:
        if key in raw:
            return key
    return raw.split("/")[-1][:50] or "unknown"


def page_label(page: str | None) -> str:
    cat = page_category(page)
    return _PAGE_LABELS.get(cat, cat.replace("-", " ").title() or "this screen")


def _user_location(ctx: dict[str, Any] | None) -> dict[str, Any] | None:
    if not ctx:
        return None
    user = ctx.get("userLocation")
    if not isinstance(user, dict):
        return None
    lat, lng = user.get("lat"), user.get("lng")
    if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
        return None
    return user


def _selected_place(ctx: dict[str, Any] | None) -> dict[str, Any] | None:
    if not ctx:
        return None
    selected = ctx.get("selectedPlace")
    if not isinstance(selected, dict):
        selected = ctx.get("activeMapPin")
    if not isinstance(selected, dict):
        return None
    lat, lng = selected.get("lat"), selected.get("lng")
    if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
        return None
    return normalize_place_for_sources(
        {
            "name": selected.get("name") or "Selected location",
            "lat": float(lat),
            "lng": float(lng),
            "city": selected.get("city"),
            "state": selected.get("state"),
            "country": selected.get("country"),
            "address": selected.get("address"),
            "category": selected.get("category"),
        },
        ctx,
    )


def _location_label(loc: dict[str, Any]) -> str:
    parts: list[str] = []
    for key in ("city", "state", "country"):
        val = loc.get(key)
        if isinstance(val, str) and val.strip() and val.strip() not in parts:
            parts.append(val.strip())
    name = loc.get("name")
    if isinstance(name, str) and name.strip() and name.strip().lower() not in {
        "dropped pin",
        "selected location",
        "your location",
        "map pin",
    }:
        return name.strip()
    if parts:
        return ", ".join(parts)
    lat, lng = loc.get("lat"), loc.get("lng")
    if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
        return f"coordinates {float(lat):.4f}, {float(lng):.4f}"
    return "your current area"


def sanitize_question_text(message: str) -> str:
    """Strip coordinate-like tokens before logging unmatched questions."""
    text = re.sub(r"-?\d{1,3}\.\d{3,}", "[coord]", message or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:400]


def text_hash(sanitized: str) -> str:
    return hashlib.sha256(sanitized.lower().encode("utf-8")).hexdigest()


class WayraKnowledgeService:
    @staticmethod
    def find_exact_intent(
        db: Session, normalized: str
    ) -> WayraKnowledgeIntent | None:
        if not normalized:
            return None
        result = db.execute(
            select(WayraKnowledgeIntent)
            .join(WayraKnowledgeUtterance)
            .where(
                WayraKnowledgeUtterance.normalized_text == normalized,
                WayraKnowledgeIntent.is_active.is_(True),
            )
            .limit(1)
        )
        return result.scalar_one_or_none()

    @staticmethod
    def get_intent_by_key(db: Session, intent_key: str) -> WayraKnowledgeIntent | None:
        result = db.execute(
            select(WayraKnowledgeIntent).where(
                WayraKnowledgeIntent.intent_key == intent_key,
                WayraKnowledgeIntent.is_active.is_(True),
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    def list_active_catalog(db: Session, *, limit: int = 120) -> list[dict[str, str]]:
        rows = db.execute(
            select(WayraKnowledgeIntent)
            .where(WayraKnowledgeIntent.is_active.is_(True))
            .order_by(WayraKnowledgeIntent.intent_key)
            .limit(limit)
        ).scalars().all()
        return [
            {
                "intent_key": row.intent_key,
                "category": row.category,
                "canonical_question": row.canonical_question,
                "required_context": row.required_context,
            }
            for row in rows
        ]

    @staticmethod
    def log_unmatched(
        db: Session,
        *,
        message: str,
        page: str | None,
        proposed_intent_key: str | None = None,
        proposed_confidence: float | None = None,
    ) -> None:
        sanitized = sanitize_question_text(message)
        if not sanitized:
            return
        digest = text_hash(sanitized)
        existing = db.execute(
            select(WayraUnmatchedQuestion).where(
                WayraUnmatchedQuestion.text_hash == digest
            )
        ).scalar_one_or_none()
        now = datetime.utcnow()
        if existing:
            existing.occurrence_count = int(existing.occurrence_count or 0) + 1
            existing.last_seen_at = now
            if proposed_intent_key:
                existing.proposed_intent_key = proposed_intent_key
            if proposed_confidence is not None:
                existing.proposed_confidence = proposed_confidence
            if page:
                existing.page_category = page_category(page)
        else:
            db.add(
                WayraUnmatchedQuestion(
                    sanitized_text=sanitized,
                    text_hash=digest,
                    page_category=page_category(page),
                    proposed_intent_key=proposed_intent_key,
                    proposed_confidence=proposed_confidence,
                    occurrence_count=1,
                    first_seen_at=now,
                    last_seen_at=now,
                )
            )
        try:
            db.commit()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Wayra unmatched log failed: %s", exc)
            db.rollback()

    @staticmethod
    def list_unmatched(
        db: Session, *, limit: int = 50, offset: int = 0
    ) -> list[WayraUnmatchedQuestion]:
        limit = max(1, min(limit, 200))
        offset = max(0, offset)
        result = db.execute(
            select(WayraUnmatchedQuestion)
            .order_by(
                WayraUnmatchedQuestion.occurrence_count.desc(),
                WayraUnmatchedQuestion.last_seen_at.desc(),
            )
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all())

    @staticmethod
    async def resolve_intent_with_deepseek(
        db: Session,
        *,
        user_message: str,
        page: str | None,
    ) -> tuple[WayraKnowledgeIntent | None, float, dict[str, Any] | None]:
        """Ask DeepSeek to map unfamiliar wording to a catalog intent_key."""
        from app.services import wayra_llm_providers as providers

        catalog = WayraKnowledgeService.list_active_catalog(db)
        if not catalog or not providers._deepseek_key():
            return None, 0.0, None

        catalog_block = "\n".join(
            f"- {row['intent_key']}: {row['canonical_question']} "
            f"(category={row['category']}, context={row['required_context']})"
            for row in catalog
        )
        system = (
            "You are Wayra's intent resolver. Map the user question to exactly one "
            "intent_key from the catalog, or action=unmatched if none fits.\n"
            "Never invent intent keys. Never answer the user. Return JSON only:\n"
            '{"intent_key":"...|null","confidence":0.0-1.0,'
            '"context_scope":"none|page|gps|pin|page_or_gps",'
            '"action":"match|unmatched"}'
        )
        user_block = (
            f"Page: {page_category(page)}\n"
            f"User question: {user_message}\n\n"
            f"CATALOG:\n{catalog_block}"
        )
        try:
            raw, usage = await providers._call_deepseek_full(
                system,
                user_block,
                timeout=12.0,
                temperature=0.1,
                max_tokens=220,
            )
            providers.record_gemini_usage(
                feature="wayra_knowledge_intent_resolve",
                model=providers._deepseek_model(),
                usage=usage,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Wayra knowledge DeepSeek resolve failed: %s", exc)
            return None, 0.0, None

        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return None, 0.0, usage

        if not isinstance(data, dict):
            return None, 0.0, usage
        action = str(data.get("action") or "").strip().lower()
        intent_key = data.get("intent_key")
        try:
            confidence = float(data.get("confidence") or 0.0)
        except (TypeError, ValueError):
            confidence = 0.0

        if action != "match" or not isinstance(intent_key, str) or not intent_key.strip():
            return None, confidence, usage
        if confidence < _CONFIDENCE_MIN:
            return None, confidence, usage

        intent = WayraKnowledgeService.get_intent_by_key(db, intent_key.strip())
        if intent is None:
            return None, confidence, usage
        return intent, confidence, usage

    @staticmethod
    def handle_where_am_i(
        request: AIAssistantRequest, intent: WayraKnowledgeIntent
    ) -> AIAssistantResponse:
        ctx = request.context if isinstance(request.context, dict) else {}
        page = page_label(request.page)
        gps = _user_location(ctx)
        pin = _selected_place(ctx)
        parts: list[str] = [f"You're currently on Rovvy's {page}."]

        if gps:
            parts.append(
                f"Your live GPS location is near {_location_label(gps)} "
                f"({float(gps['lat']):.4f}, {float(gps['lng']):.4f})."
            )
        else:
            parts.append(
                "I don't have your live GPS yet — enable location or tap Locate on Live."
            )

        if pin:
            pin_label = _location_label(pin)
            if not gps or pin_label != _location_label(gps):
                parts.append(
                    f"The selected map pin is {pin_label} "
                    f"({float(pin['lat']):.4f}, {float(pin['lng']):.4f}) — "
                    "that can differ from your GPS if you tapped elsewhere."
                )

        return AIAssistantResponse(
            message=" ".join(parts)[:1200],
            sources=[],
            summary={
                "intent": intent.intent_key,
                "provider": "knowledge",
                "answer_strategy": "handler",
                "handler_key": "where_am_i",
                "context_used": {
                    "page": page_category(request.page),
                    "has_gps": bool(gps),
                    "has_pin": bool(pin),
                },
            },
        )

    @staticmethod
    def handle_page_help(
        request: AIAssistantRequest, intent: WayraKnowledgeIntent
    ) -> AIAssistantResponse:
        page = page_label(request.page)
        fallback = contextual_app_fallback(request.page, request.active_tab)
        message = (
            f"You're on {page}. {fallback}"
            if fallback
            else (
                f"You're on {page}. Use the sidebar to move between Dashboard, Plan, "
                "Explore, Group, Live, and Profile — or ask me a specific question."
            )
        )
        return AIAssistantResponse(
            message=message[:1200],
            sources=[],
            summary={
                "intent": intent.intent_key,
                "provider": "knowledge",
                "answer_strategy": "handler",
                "handler_key": "page_help",
                "context_used": {"page": page_category(request.page)},
            },
        )

    @staticmethod
    async def handle_what_can_i_do_here(
        request: AIAssistantRequest, intent: WayraKnowledgeIntent
    ) -> AIAssistantResponse | None:
        """Dynamic nearby/discovery — delegates to existing hybrid answer path."""
        from app.services.wayra_answer_service import WayraAnswerService
        from app.services.wayra_intent import WayraMode

        ctx = request.context if isinstance(request.context, dict) else {}
        gps = _user_location(ctx)
        pin = _selected_place(ctx)
        place = None
        if gps:
            place = {
                "name": _location_label(gps),
                "lat": float(gps["lat"]),
                "lng": float(gps["lng"]),
                "city": gps.get("city"),
                "state": gps.get("state"),
                "country": gps.get("country"),
            }
        elif pin:
            place = pin

        if place is None:
            return AIAssistantResponse(
                message=(
                    f"You're on {page_label(request.page)}. Turn on GPS or drop a pin so I "
                    "can suggest things to do around your real location."
                ),
                sources=[],
                summary={
                    "intent": intent.intent_key,
                    "provider": "knowledge",
                    "answer_strategy": "handler",
                    "handler_key": "what_can_i_do_here",
                    "needs_location": True,
                },
            )

        # Prefer discovery hybrid with current coordinates.
        hybrid = await WayraAnswerService._answer_discovery(
            request.user_message, ctx, place
        )
        if hybrid is None:
            hybrid = await WayraAnswerService._answer_nearby(
                request.user_message, ctx, place
            )
        if hybrid is None:
            return AIAssistantResponse(
                message=(
                    f"Near {_location_label(place)} I couldn't pull fresh local listings yet. "
                    "Zoom the Live map, try a category like food or parks, or ask a more "
                    "specific question."
                ),
                sources=[],
                summary={
                    "intent": intent.intent_key,
                    "provider": "knowledge",
                    "answer_strategy": "handler",
                    "handler_key": "what_can_i_do_here",
                    "mode": WayraMode.TRAVEL.value,
                },
            )

        summary = dict(hybrid.summary or {})
        summary.update(
            {
                "knowledge_intent": intent.intent_key,
                "handler_key": "what_can_i_do_here",
                "context_used": {
                    "page": page_category(request.page),
                    "place": _location_label(place),
                },
            }
        )
        return AIAssistantResponse(
            message=hybrid.message,
            sources=hybrid.sources,
            suggested_actions=hybrid.suggested_actions,
            summary=summary,
        )

    @staticmethod
    def render_static(
        request: AIAssistantRequest, intent: WayraKnowledgeIntent
    ) -> AIAssistantResponse:
        text = (intent.answer_text or "").strip()
        if intent.answer_strategy == "template":
            text = text.replace("{page}", page_label(request.page))
            gps = _user_location(
                request.context if isinstance(request.context, dict) else None
            )
            text = text.replace(
                "{location_label}",
                _location_label(gps) if gps else "your location",
            )
        if not text:
            text = (
                f"I can help with that on {page_label(request.page)}. "
                "Ask a more specific question about Live, Plan, or your group."
            )
        return AIAssistantResponse(
            message=text[:1200],
            sources=[],
            summary={
                "intent": intent.intent_key,
                "provider": "knowledge",
                "answer_strategy": intent.answer_strategy,
                "confidence": 1.0,
                "context_used": {"page": page_category(request.page)},
            },
        )

    @staticmethod
    async def execute_intent(
        request: AIAssistantRequest,
        intent: WayraKnowledgeIntent,
        *,
        confidence: float,
        match_source: str,
    ) -> AIAssistantResponse | None:
        if intent.answer_strategy == "handler":
            key = (intent.handler_key or "").strip()
            if key not in _HANDLER_KEYS:
                return None
            if key == "where_am_i":
                resp = WayraKnowledgeService.handle_where_am_i(request, intent)
            elif key == "page_help":
                resp = WayraKnowledgeService.handle_page_help(request, intent)
            else:
                resp = await WayraKnowledgeService.handle_what_can_i_do_here(
                    request, intent
                )
            if resp is None:
                return None
            summary = dict(resp.summary or {})
            summary["match_source"] = match_source
            summary["confidence"] = confidence
            return AIAssistantResponse(
                message=resp.message,
                sources=resp.sources,
                suggested_actions=resp.suggested_actions,
                summary=summary,
            )

        resp = WayraKnowledgeService.render_static(request, intent)
        summary = dict(resp.summary or {})
        summary["match_source"] = match_source
        summary["confidence"] = confidence
        return AIAssistantResponse(
            message=resp.message,
            sources=resp.sources,
            suggested_actions=resp.suggested_actions,
            summary=summary,
        )

    @staticmethod
    async def try_answer(
        db: Session | None, request: AIAssistantRequest
    ) -> AIAssistantResponse | None:
        """Exact variant match, then DeepSeek intent resolve. Returns None to fall through."""
        if db is None:
            return None

        try:
            normalized = normalize_knowledge_query(request.user_message)
            intent = WayraKnowledgeService.find_exact_intent(db, normalized)
            confidence = 1.0
            match_source = "exact"

            if intent is None:
                intent, confidence, _usage = (
                    await WayraKnowledgeService.resolve_intent_with_deepseek(
                        db,
                        user_message=request.user_message,
                        page=request.page,
                    )
                )
                match_source = "deepseek_resolve"
                if intent is None:
                    WayraKnowledgeService.log_unmatched(
                        db,
                        message=request.user_message,
                        page=request.page,
                        proposed_confidence=confidence or None,
                    )
                    return None

            return await WayraKnowledgeService.execute_intent(
                request,
                intent,
                confidence=confidence,
                match_source=match_source,
            )
        except Exception as exc:  # noqa: BLE001
            # Missing migration / DB blip must not break browse-first Wayra.
            logger.warning("Wayra knowledge lookup skipped: %s", exc)
            try:
                db.rollback()
            except Exception:  # noqa: BLE001
                pass
            return None
