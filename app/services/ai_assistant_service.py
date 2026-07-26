"""
Rovvy AI assistant service.

Primary engine  : Google Gemini (gemini-2.0-flash via google-generativeai SDK)
Fallback engine : OpenAI GPT-4o-mini
Branding rule   : NEVER reveal the underlying model or provider to the user.
                  All responses must appear as Rovvy's own native AI.

The system prompt explicitly forbids the model from mentioning Google, Gemini,
OpenAI, GPT, or any third-party AI name — the user experience is "Rovvy AI".
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

from config import settings
from app.services.gemini_usage import (
    parse_sdk_usage_metadata,
    record_gemini_usage,
)
from app.schemas.ai_assistant import (
    AIAssistantRequest,
    AIAssistantResponse,
    AISuggestedAction,
)
from app.services.wayra_answer_service import WayraAnswerService
from app.services.wayra_intent import (
    WayraMode,
    _is_live_page,
    classify_mode,
    contextual_app_fallback,
    degraded_message,
    is_app_how_to_question,
    resolve_app_guide_message,
    resolve_live_map_context_message,
    resolve_live_travel_prep_message,
    travel_fallback_message,
)

logger = logging.getLogger(__name__)

_GEMINI_MODEL = "gemini-2.5-flash"  # updated for 2026 model compatibility
_OPENAI_MODEL = "gpt-4o-mini"
_MAX_OUTPUT_TOKENS = 2048

_GENERIC_PLACE_NAMES = frozenset(
    {"dropped pin", "selected location", "address", "place", "map pin"}
)


def _is_generic_place_name(name: str | None) -> bool:
    if not name or not name.strip():
        return True
    return name.strip().lower() in _GENERIC_PLACE_NAMES


def _region_label_from_address(addr: dict[str, Any]) -> str | None:
    city = (
        addr.get("city")
        or addr.get("town")
        or addr.get("village")
        or addr.get("municipality")
        or addr.get("county")
    )
    state = addr.get("state")
    country = addr.get("country")
    parts = [p.strip() for p in (city, state, country) if isinstance(p, str) and p.strip()]
    if not parts:
        return None
    deduped: list[str] = []
    for part in parts:
        if part not in deduped:
            deduped.append(part)
    return ", ".join(deduped)


def _region_from_nominatim(
    data: dict[str, Any],
    *,
    original_name: str | None = None,
) -> dict[str, Any]:
    addr = data.get("address") if isinstance(data.get("address"), dict) else {}
    city = (
        addr.get("city")
        or addr.get("town")
        or addr.get("village")
        or addr.get("municipality")
        or addr.get("county")
    )
    state = addr.get("state")
    country = addr.get("country")
    display = data.get("display_name") if isinstance(data.get("display_name"), str) else ""
    raw_name = data.get("name") if isinstance(data.get("name"), str) else None
    if not raw_name and display:
        raw_name = display.split(",")[0].strip() or None
    region_label = _region_label_from_address(addr)
    resolved_name = raw_name
    if _is_generic_place_name(original_name) or _is_generic_place_name(resolved_name):
        resolved_name = region_label or raw_name or "Dropped pin"
    return {
        "name": resolved_name,
        "city": city,
        "state": state,
        "country": country,
        "address": display or None,
        "region_label": region_label,
    }


async def _enrich_live_context(ctx: dict[str, Any] | None) -> dict[str, Any] | None:
    """Reverse-geocode generic dropped pins so Wayra can answer culture/language questions."""
    if not ctx or not _is_live_page("", ctx):
        return ctx

    selected = ctx.get("selectedPlace")
    if not isinstance(selected, dict):
        return ctx

    lat = selected.get("lat")
    lng = selected.get("lng")
    if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
        return ctx

    name = selected.get("name") if isinstance(selected.get("name"), str) else None
    city = selected.get("city") if isinstance(selected.get("city"), str) else None
    country = selected.get("country") if isinstance(selected.get("country"), str) else None
    if not _is_generic_place_name(name) and (city or country):
        return ctx

    from app.services.geocoding_service import GeocodingService

    data = await GeocodingService.reverse_geocode(float(lat), float(lng))
    if not data:
        return ctx

    region = _region_from_nominatim(data, original_name=name)
    enriched = {**selected}
    for key in ("name", "city", "state", "country", "address"):
        value = region.get(key)
        if value:
            enriched[key] = value

    updated = {**ctx, "selectedPlace": enriched}
    if region.get("region_label"):
        updated["resolvedMapRegion"] = region["region_label"]
    return updated


# ── Prompt construction ────────────────────────────────────────────────────────

def _app_knowledge_block() -> str:
    return """
ROVVY FEATURE KNOWLEDGE — use ONLY when the user asks how the app works:

GROUPS:
- Create group: Group in left sidebar → Travel Hub → create workspace → name it → share invite link
- Invite friends: Travel Hub → share invite link with your group
- View groups: Group in left sidebar → Travel Hub
- Delete/leave group: Group settings → Leave or Delete

TRIPS:
- Create trip: Dashboard → "+ New Trip" or Trips section → New Trip → add title, dates, destination
- View all trips: Click "Trips" in your group or Dashboard → "View all trips"
- Delete trip: Open trip → Settings → Delete trip
- Change trip status: Trip settings → change to planning/confirmed/ongoing/completed

POLLS:
- Create poll: Inside a trip → Polls tab → New Poll → add options
- Vote: Open poll → click your preferred option
- Close poll: Poll creator can click "Close poll"

EXPENSES & SPLITS:
- Add expense: Trip → Expenses tab → Add Expense → who paid, amount, split method
- View balances: Trip → Expenses → Balance Summary
- Settle: Mark individual splits as settled

PLAN PAGE:
- Search flights: Plan → Flights tab → enter origin, destination, dates
- Search buses: Plan → Buses tab → powered by Busbud via Travelpayouts
- Search hotels: Plan → Hotels tab
- Search activities: Plan → Activities tab

EXPLORE PAGE:
- Browse destinations: Explore page → trending destinations feed
- Filter: Use category filters (beach, mountain, city, food)
- Save destination: Click heart/save icon on any destination card

LIVE MAP & COORDINATION:
- Share location: Trip → Live tab → Start sharing
- View members on map: Trip → Live/Map tab
- Set meet point: Trip → Live tab → Drop meet point
- Countdown timer: Trip → Live tab → Start timer

NOTIFICATIONS:
- View notifications: Click bell icon (🔔) in top right of any page

PROFILE & SETTINGS:
- Edit profile: Click Profile in left sidebar → edit name, bio, avatar
- Change avatar: Profile → click avatar image → upload new photo
- Account settings: Profile → Settings tab

BUDDY TRIPS:
- Find buddy trips: Explore page → Buddy Trips section
- Join a buddy trip: Click on listing → Request to join

PLANS & PRICING:
- Free plan: Up to 5 group members, no live features
- 3-Day Pass: $4.99 — full features for 3 days
- 7-Day Pass: $8.99 — full features for 7 days
- Pro: $9.99/month — unlimited, up to 10 members
- Upgrade: Profile → Settings → Upgrade Plan

VERIFICATION:
- Verify email: Check inbox for OTP code → go to /verify → enter 6-digit code
"""


def _travel_live_discovery_block() -> str:
    return """
TRAVEL DISCOVERY ON LIVE MAP (default for pin questions — priority over app navigation):
- The user picked a place on the map. Answer about THAT place/region first — not about how Rovvy works.
- Use context.selectedPlace, live_context_block, resolved_map_region, live_ai_suggestions, and routePreview.
- When selectedPlace.name is generic ("Dropped pin", "Map pin"), infer the real region from coordinates, city, state, country, and address.
- Structure satisfying answers:
  1) One-line snapshot — what/where this place is.
  2) Two to four concrete highlights — nature, culture, activities, food, or logistics as relevant to the question.
  3) One practical tip — season, access, safety, border/distance prep, or what to pack when relevant.
- Write 4 to 8 sentences for discovery questions. Be warm, specific, and useful — not a one-line stub.
- Do NOT tell users to "open Plan", "use the Plan tab", or "start Solo Live" unless they ask about booking, driving/navigation, or trip logistics.
- Do NOT explain groups, polls, splits, or Live mechanics unless they explicitly ask how the app works.
- Do NOT say "pick a landmark" or "search Explore first" — they already picked a pin.
- Never invent exact business names, prices, phone numbers, or opening hours. Speak in categories ("local markets", "tundra wildlife", "Inuit cultural heritage").
- For trip-prep / warnings questions: lead with aiSuggestions and routePreview facts (distance, border, far-from-home), then practical prep steps.
- When chat_attached_location is present, treat it as the user's explicit "I'm here" anchor for nearby POI questions (pharmacies, food, etc.). List categories only — do not invent open hours or business names.
- When messenger_profile.full_name is present, you may address the user warmly by name.
- suggested_actions: include 0 to 2 helpful chips when natural:
  - "Explore Activities" → /explore/activities (things to do)
  - "Plan a Trip" → /trips/plan (multi-day planning)
  - "Start Solo Live" → only when navigation or driving is clearly relevant
"""


def _response_rules_block(mode: WayraMode, *, on_live: bool) -> str:
    if mode == WayraMode.TRAVEL and on_live:
        return """
RESPONSE RULES (travel discovery on Live):
- Lead with the place name from context. Plain text only, no markdown.
- 4 to 8 sentences for "what's here", activities, culture, food, safety, or prep questions.
- Mention Rovvy features only as optional next steps at the end — never as the main answer.
- Never say "I don't know" — use geographic knowledge from coordinates and region when needed.
- You are read-only: do NOT claim to have saved, deleted, or changed anything.
"""
    if mode == WayraMode.TRAVEL:
        return """
RESPONSE RULES (travel):
- Give specific destination ideas and practical next steps in 3 to 6 sentences.
- Plain text only, no markdown.
- Never say "I don't know" — always give the best available answer.
- You are read-only: do NOT claim to have saved, deleted, or changed anything.
"""
    return """
RESPONSE RULES (app guide):
- Be friendly, warm, concise — max 2 to 3 sentences.
- Give the exact in-app path (sidebar, tab, button) the user should tap.
- Plain text only, no markdown.
- You are read-only: do NOT claim to have saved, deleted, or changed anything.
"""


def _generation_temperature(mode: WayraMode, *, on_live: bool) -> float:
    if mode == WayraMode.TRAVEL and on_live:
        return 0.55
    if mode == WayraMode.TRAVEL:
        return 0.5
    return 0.35


def _build_system_prompt(
    page: str,
    active_tab: str | None,
    *,
    mode: WayraMode = WayraMode.APP_GUIDE,
    on_live: bool = False,
) -> str:
    tab = active_tab or "(not specified)"
    travel_live = mode == WayraMode.TRAVEL and on_live

    priority_block = _travel_live_discovery_block() if travel_live else ""

    return f"""You are Wayra, the built-in AI assistant for Rovvy — a group travel planning app.
You are a native feature of Rovvy, not a third-party service.

IDENTITY RULES (never break):
- NEVER mention Google, Gemini, OpenAI, GPT, Claude, or any third-party AI name.
- If asked what AI you are: "I'm Wayra, Rovvy's built-in travel assistant."
- Always present yourself as a core part of Rovvy.

The user is currently on page: {page!r} (active tab: {tab!r}).
Wayra mode for this turn: {mode.value!r}.
{priority_block}
{_app_knowledge_block()}
{_response_rules_block(mode, on_live=on_live)}
Output format — single JSON object only:
{{
  "message": "string, plain text, <= 1200 chars, no markdown",
  "suggested_actions": [
    {{
      "type": "string",
      "label": "short button label",
      "target": "string or null",
      "payload": {{}} or null
    }}
  ],
  "summary": {{}} or null
}}"""


def _extract_city_from_context(ctx: dict[str, Any] | None) -> str | None:
    if not ctx:
        return None
    for key in ("city", "destination", "destination_city", "place", "location"):
        val = ctx.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return None


def _enrich_destination_intel(ctx: dict[str, Any] | None) -> dict[str, Any] | None:
    """Fetch live weather and events when context includes a destination city."""
    city = _extract_city_from_context(ctx)
    if not city:
        return None

    from app.services.events_service import get_events
    from app.services.weather_service import get_weather

    intel: dict[str, Any] = {"city": city}
    weather = get_weather(city)
    if weather:
        intel["weather"] = weather
    events = get_events(city)
    if events:
        intel["events"] = events[:5]
    return intel if len(intel) > 1 else None


def _build_input_payload(request: AIAssistantRequest, *, mode: WayraMode) -> str:
    ctx = request.context if isinstance(request.context, dict) else {}
    on_live = _is_live_page(request.page, ctx)
    payload: dict[str, Any] = {
        "page": request.page,
        "active_tab": request.active_tab,
        "trip_id": str(request.trip_id) if request.trip_id is not None else None,
        "group_id": str(request.group_id) if request.group_id is not None else None,
        "context": request.context,
        "user_message": request.user_message,
        "wayra_mode": mode.value,
        "response_style": (
            "travel_discovery_live"
            if mode == WayraMode.TRAVEL and on_live
            else "travel"
            if mode == WayraMode.TRAVEL
            else "app_guide"
        ),
    }
    selected = ctx.get("selectedPlace")
    if isinstance(selected, dict):
        payload["selected_place_on_map"] = selected
    if ctx.get("aiSuggestions") is not None:
        payload["live_ai_suggestions"] = ctx.get("aiSuggestions")
    if ctx.get("routePreview") is not None:
        payload["live_route_preview"] = ctx.get("routePreview")
    if ctx.get("liveContextBlock") is not None:
        payload["live_context_block"] = ctx.get("liveContextBlock")
    attached = ctx.get("chatAttachedLocation")
    if isinstance(attached, dict) and attached.get("lat") is not None:
        payload["chat_attached_location"] = attached
    profile = ctx.get("messengerProfile")
    if isinstance(profile, dict):
        payload["messenger_profile"] = profile
    if ctx.get("resolvedMapRegion") is not None:
        payload["resolved_map_region"] = ctx.get("resolvedMapRegion")
    if ctx.get("implicitLocation") is True:
        payload["implicit_location"] = True
    destination_intel = _enrich_destination_intel(ctx)
    if destination_intel:
        payload["destination_intel"] = destination_intel
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


# ── Gemini client ──────────────────────────────────────────────────────────────

def _gemini_key() -> str:
    return (
        settings.gemini_api_key
        or os.environ.get("GEMINI_API_KEY")
        or ""
    ).strip()


def _call_gemini(
    system_prompt: str,
    user_block: str,
    *,
    temperature: float = 0.4,
) -> tuple[str, dict[str, int] | None]:
    """Call Gemini and return raw text + token usage. Raises on failure."""
    import google.generativeai as genai  # type: ignore[import-untyped]

    key = _gemini_key()
    if not key:
        raise ValueError("GEMINI_API_KEY not configured")

    genai.configure(api_key=key)
    model = genai.GenerativeModel(
        model_name=_GEMINI_MODEL,
        system_instruction=system_prompt,
        generation_config=genai.types.GenerationConfig(  # type: ignore[attr-defined]
            max_output_tokens=_MAX_OUTPUT_TOKENS,
            temperature=temperature,
        ),
    )
    prompt = (
        "Context and user message (JSON). Reply with JSON only as specified.\n"
        + user_block
    )
    try:
        response = model.generate_content(prompt)
        usage = parse_sdk_usage_metadata(response)
        record_gemini_usage(feature="wayra_assistant", model=_GEMINI_MODEL, usage=usage)
        return (response.text or ""), usage
    except Exception as exc:
        logger.error("DEBUG: Gemini generate_content failed inside _call_gemini: %s", exc, exc_info=True)
        raise


# ── OpenAI fallback ────────────────────────────────────────────────────────────

def _openai_key() -> str:
    return (
        settings.openai_api_key
        or os.environ.get("OPENAI_API_KEY")
        or ""
    ).strip()


def _call_openai(system_prompt: str, user_block: str, *, temperature: float = 0.4) -> str:
    """Fallback to OpenAI when Gemini is unavailable. Returns raw text."""
    from openai import OpenAI  # type: ignore[import-untyped]

    key = _openai_key()
    if not key:
        raise ValueError("OPENAI_API_KEY not configured")

    client = OpenAI(api_key=key, timeout=60.0)
    resp = client.responses.create(
        model=_OPENAI_MODEL,
        instructions=system_prompt,
        input=(
            "Context and user message (JSON). Reply with JSON only as specified.\n"
            + user_block
        ),
        max_output_tokens=_MAX_OUTPUT_TOKENS,
        temperature=temperature,
    )
    t = getattr(resp, "output_text", None)
    if isinstance(t, str) and t.strip():
        return t.strip()
    out = getattr(resp, "output", None) or []
    parts: list[str] = []
    for item in out:
        for content in getattr(item, "content", None) or []:
            t2 = (
                getattr(content, "text", None)
                or getattr(content, "value", None)
                or getattr(content, "input_text", None)
            )
            if isinstance(t2, str) and t2:
                parts.append(t2)
    return "".join(parts).strip()


# ── JSON parsing / coercion ────────────────────────────────────────────────────

def _strip_markdown_lite(text: str) -> str:
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    s = re.sub(r"\*(.+?)\*", r"\1", s)
    s = re.sub(r"`([^`]+)`", r"\1", s)
    s = re.sub(r"^#{1,6}\s*", "", s, flags=re.MULTILINE)
    return s.strip()


def _parse_model_json(raw: str) -> dict[str, Any] | None:
    text = raw.strip()
    if not text:
        return None
    # Strip code fences if present
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```\s*$", "", text, flags=re.DOTALL).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}\s*$", text)
        if not m:
            return None
        try:
            data = json.loads(m.group(0))
        except json.JSONDecodeError:
            return None
    return data if isinstance(data, dict) else None


def _coerce_action(row: object) -> AISuggestedAction | None:
    if not isinstance(row, dict):
        return None
    t = row.get("type")
    label = row.get("label")
    if not isinstance(t, str) or not t.strip():
        return None
    if not isinstance(label, str) or not label.strip():
        return None
    target = row.get("target")
    if target is not None and not isinstance(target, str):
        target = str(target)
    payload = row.get("payload")
    if payload is not None and not isinstance(payload, dict):
        payload = None
    return AISuggestedAction(
        type=t.strip(),
        label=label.strip(),
        target=target,
        payload=payload,
    )


def _build_response(data: dict[str, Any] | None, raw: str, user_message: str) -> AIAssistantResponse:
    if data is None:
        clean = _strip_markdown_lite(raw)[:1200]
        return AIAssistantResponse(
            message=clean or "I couldn't process that right now. Please try again.",
            suggested_actions=[],
            summary={"parse": "plain_text"},
        )

    message = data.get("message", "")
    if not isinstance(message, str):
        message = str(message)
    message = _strip_markdown_lite(message)[:1200]

    actions: list[AISuggestedAction] = []
    for a in (data.get("suggested_actions") or []):
        act = _coerce_action(a)
        if act is not None:
            actions.append(act)

    summary = data.get("summary")
    if summary is not None and not isinstance(summary, dict):
        summary = None

    if not message:
        message = "I couldn't find an answer right now. Try asking something else!"

    return AIAssistantResponse(
        message=message,
        suggested_actions=actions,
        summary=summary,
    )


def _fallback_response(
    request: AIAssistantRequest,
    *,
    prefer_travel: bool,
) -> AIAssistantResponse:
    ctx = request.context if isinstance(request.context, dict) else None
    msg = degraded_message(
        request.user_message,
        request.page,
        request.active_tab,
        ctx,
        prefer_travel=prefer_travel,
    )
    return AIAssistantResponse(
        message=msg[:1200],
        suggested_actions=[],
        summary={"fallback": True, "local": True},
    )


# ── Main service class ─────────────────────────────────────────────────────────

class AIAssistantService:
    @staticmethod
    async def respond(request: AIAssistantRequest) -> AIAssistantResponse:
        mode = classify_mode(request.user_message)
        ctx = request.context if isinstance(request.context, dict) else None
        ctx = await _enrich_live_context(ctx)
        request = request.model_copy(update={"context": ctx})

        live_map = resolve_live_map_context_message(
            request.user_message,
            request.page,
            ctx,
        )
        if live_map:
            return AIAssistantResponse(
                message=live_map[:1200],
                suggested_actions=[],
                summary={"intent": "live_map_context", "local": True},
            )

        # Reliable App Guide: answer locally for known product intents (no LLM latency).
        if mode == WayraMode.APP_GUIDE:
            on_live = _is_live_page(request.page, ctx)
            allow_app_local = not on_live or is_app_how_to_question(request.user_message)
            if allow_app_local:
                local_app = resolve_app_guide_message(request.user_message, request.page)
                if local_app:
                    return AIAssistantResponse(
                        message=local_app,
                        suggested_actions=[],
                        summary={"intent": "app_guide", "local": True},
                    )

        # Perplexity-style travel answers: OSM/Wikipedia sources + compact cheap LLM.
        if mode == WayraMode.TRAVEL:
            hybrid = await WayraAnswerService.try_answer(request, mode)
            if hybrid is not None:
                return hybrid

        system_prompt = _build_system_prompt(
            request.page,
            request.active_tab,
            mode=mode,
            on_live=_is_live_page(request.page, ctx),
        )
        user_block = _build_input_payload(request, mode=mode)
        temperature = _generation_temperature(mode, on_live=_is_live_page(request.page, ctx))

        raw_text = ""
        gemini_usage: dict[str, int] | None = None

        # 1. Try Gemini first
        if _gemini_key():
            try:
                raw_text, gemini_usage = _call_gemini(
                    system_prompt,
                    user_block,
                    temperature=temperature,
                )
                logger.debug("Rovvy AI (primary) responded OK")
            except Exception as exc:  # noqa: BLE001
                logger.warning("Rovvy AI primary call failed: %s", exc, exc_info=False)
                raw_text = ""

        # 2. Fall back to OpenAI if Gemini failed or key missing
        if not raw_text and _openai_key():
            try:
                raw_text = _call_openai(system_prompt, user_block, temperature=temperature)
                logger.debug("Rovvy AI (secondary) responded OK")
            except Exception as exc:  # noqa: BLE001
                logger.warning("Rovvy AI secondary call failed: %s", exc, exc_info=False)
                raw_text = ""

        if not raw_text:
            prefer_travel = mode == WayraMode.TRAVEL
            if prefer_travel:
                travel_local = travel_fallback_message(request.user_message, ctx)
                if travel_local:
                    return AIAssistantResponse(
                        message=travel_local[:1200],
                        suggested_actions=[],
                        summary={"fallback": True, "local": True, "mode": "travel"},
                    )
            if mode == WayraMode.APP_GUIDE:
                return AIAssistantResponse(
                    message=contextual_app_fallback(request.page, request.active_tab)[:1200],
                    suggested_actions=[],
                    summary={"fallback": True, "local": True, "mode": "app_guide"},
                )
            return _fallback_response(request, prefer_travel=prefer_travel)

        data = _parse_model_json(raw_text)
        response = _build_response(data, raw_text, request.user_message)
        if gemini_usage and isinstance(response.summary, dict):
            response.summary = {**response.summary, "gemini_usage": gemini_usage}
        elif gemini_usage:
            response.summary = {"gemini_usage": gemini_usage}
        return response


class AwaitableString(str):
    def __await__(self):
        async def _async_val():
            return self
        return _async_val().__await__()


def generate_gemini_content(prompt: str) -> AwaitableString:
    """Call Gemini directly with a single prompt string."""
    import google.generativeai as genai  # type: ignore[import-untyped]

    key = _gemini_key()
    if not key:
        logger.warning("GEMINI_API_KEY not configured for generate_gemini_content")
        return AwaitableString("")

    try:
        genai.configure(api_key=key)
        model = genai.GenerativeModel(
            model_name=_GEMINI_MODEL,
            generation_config=genai.types.GenerationConfig(  # type: ignore[attr-defined]
                max_output_tokens=_MAX_OUTPUT_TOKENS,
                temperature=0.4,
            ),
        )
        response = model.generate_content(prompt)
        return AwaitableString(response.text or "")
    except Exception as e:
        logger.error(f"Gemini generate content failed: {e}")
        return AwaitableString("")
