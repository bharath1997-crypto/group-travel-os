"""Zero-token Wayra replies: weather, meta, chat, language, simple navigation."""

from __future__ import annotations

import re
from typing import Any

from app.schemas.ai_assistant import AIAssistantResponse, WayraSource
from app.services.wayra_intent import (
    _extract_live_selected_place,
    _is_live_page,
    is_app_how_to_question,
    normalize_query,
    resolve_app_guide_message,
)
from app.services.wayra_discovery import is_discovery_app_guide_question
from app.services.wayra_route_feasibility import assess_drive_feasibility, is_drive_navigation_question
from app.services.wayra_source_intent import extract_place_from_context, is_planning_from_home
from app.services.wayra_sources_service import build_user_place_distance_block
from app.services.places_nearby_service import calculate_distance_miles
from app.services.wayra_weather_intent import (
    _home_city_weather,
    build_weather_reply,
    classify_weather_sub_intent,
    extract_home_city,
)
from app.services.weather_service import WeatherService

_WEATHER_RE = re.compile(
    r"\b(weather|weather like|weather warning|rain|snow|snowing|temperature|"
    r"too hot|too cold|peak season|best time of year|when should i avoid|"
    r"good to visit right now|season is best|bring an umbrella|"
    r"comfortable|how (?:am i|will i|do i) (?:going to )?feel|feels like|"
    r"chilly|humid|jacket|coat)\b",
    re.I,
)

_META_AI_RE = re.compile(
    r"\b(gemini|deepseek|openai|gpt|google ai|what model|which ai|which model|"
    r"who built wayra|who built rovvy|behind the scenes|real person or ai|"
    r"are you ai|using gemini|using deepseek|powers your answers|choose which ai)\b",
    re.I,
)

_CONVERSATION_RE = re.compile(
    r"^(hello wayra|hello|hi wayra|hi|hey wayra|hey|good morning|good evening|"
    r"thanks for your help|thank you|thanks|you re awesome|you're awesome|"
    r"what else can you help with|that s interesting tell me more|tell me more)\b",
    re.I,
)

_BORDER_RE = re.compile(r"\b(near a border|border crossing|international border)\b", re.I)
_LAST_MILE_RE = re.compile(r"\blast mile\b", re.I)

_LANGUAGE_PHRASE_RE = re.compile(
    r"\b(how do i say hello|how to say hello|say hello in|how do i say thank|"
    r"what language do they speak|main language|do people speak english|"
    r"how do i say\b)",
    re.I,
)

_HOME_CONTEXT_RE = re.compile(
    r"\b(for that location )?from my (?:house|home)\b|"
    r"\bfrom my location to (?:their|this|that|the) location\b|"
    r"\bcall from my location to\b",
    re.I,
)

_NAVIGATION_RE = re.compile(
    r"\b(how do i get to|best route|how long is the drive|is there parking|"
    r"can i walk to|how is traffic|accessible by car|navigate|reroute|"
    r"start navigation|set .+ as my destination|near a border|"
    r"call from my location|from my location to|how to reach|way to reach|"
    r"how do i get there|get over there)\b",
    re.I,
)

_REACH_QUESTION_RE = re.compile(
    r"\b(how to reach|way to reach|how do i get there|get over there)\b",
    re.I,
)

_WHERE_AM_I_RE = re.compile(
    r"\b(where am i|where i am|where are we now|where i am right now|where am i right now)\b",
    re.I,
)

_TIME_RE = re.compile(
    r"\b("
    r"what time|what s the time|whats the time|what is the time|what is time|"
    r"what time is it|tell me the time|give me the time|"
    r"local time|current time|clock|"
    r"time over there|time there|time at|exact time|time exactly|"
    r"time difference|compare.{0,20}time|same time as me|"
    r"time zone|timezone|time now|time right now|"
    r"time at this pin|time at the pin|time in the pin|time at this location|"
    r"time at this spot|time here|the time at|the time in"
    r")\b",
    re.I,
)

_TIME_EXCLUDE_RE = re.compile(
    r"\b("
    r"best time|peak season|opening time|closing time|drive time|travel time|"
    r"how long|how much time|time to visit|time of year|response time|"
    r"real.?time traffic|timeline|lifetime|part.?time|full.?time"
    r")\b",
    re.I,
)

_TIME_PIN_CONTEXT_RE = re.compile(
    r"\b(time|clock)\b.{0,40}\b(pin|location|here|there|this spot|coordinates|exactly)\b|"
    r"\b(exactly|exact|precise|current)\b.{0,20}\b(time|clock)\b",
    re.I,
)

_COUNTRY_LANGUAGE: dict[str, dict[str, str]] = {
    "russia": {
        "language": "Russian",
        "hello": "Привет (Privet)",
        "thanks": "Спасибо (Spasibo)",
        "english": "English is uncommon outside hotels and tourist spots; learn a few Russian phrases.",
    },
    "japan": {
        "language": "Japanese",
        "hello": "こんにちは (Konnichiwa)",
        "thanks": "ありがとう (Arigato)",
        "english": "English signage is common in Tokyo; smaller towns may have less English.",
    },
    "france": {
        "language": "French",
        "hello": "Bonjour",
        "thanks": "Merci",
        "english": "English is often understood in Paris tourist areas; French is appreciated elsewhere.",
    },
    "united states": {
        "language": "English",
        "hello": "Hello",
        "thanks": "Thank you",
        "english": "English is the primary language nationwide.",
    },
    "mexico": {
        "language": "Spanish",
        "hello": "Hola",
        "thanks": "Gracias",
        "english": "English is common in tourist zones; Spanish is primary.",
    },
    "india": {
        "language": "Hindi and English (plus regional languages)",
        "hello": "Namaste",
        "thanks": "Dhanyavaad",
        "english": "English is widely used in cities and for travel.",
    },
}


def _place_label(place: dict[str, Any] | None, ctx: dict[str, Any] | None) -> str:
    if place:
        name = place.get("name")
        if isinstance(name, str) and name.strip():
            return name.strip()
    region = (ctx or {}).get("resolvedMapRegion")
    if isinstance(region, str) and region.strip():
        return region.strip()
    return "this place"


def _country_key(place: dict[str, Any] | None) -> str | None:
    if not place:
        return None
    country = place.get("country")
    if isinstance(country, str) and country.strip():
        return country.strip().lower()
    return None


def is_weather_question(message: str) -> bool:
    return bool(_WEATHER_RE.search(normalize_query(message)))


def is_meta_ai_question(message: str) -> bool:
    return bool(_META_AI_RE.search(normalize_query(message)))


def is_conversation_question(message: str) -> bool:
    q = normalize_query(message).rstrip("?").strip()
    return bool(_CONVERSATION_RE.match(q))


def is_language_phrase_question(message: str) -> bool:
    return bool(_LANGUAGE_PHRASE_RE.search(normalize_query(message)))


def is_home_context_question(message: str) -> bool:
    return bool(_HOME_CONTEXT_RE.search(normalize_query(message)))


def is_navigation_question(message: str) -> bool:
    return bool(_NAVIGATION_RE.search(normalize_query(message)))


def is_local_time_question(message: str) -> bool:
    q = normalize_query(message)
    if not q or ("time" not in q and "clock" not in q):
        return False
    if _TIME_EXCLUDE_RE.search(q):
        return False
    if _TIME_RE.search(q):
        return True
    return bool(_TIME_PIN_CONTEXT_RE.search(q))


def is_border_question(message: str) -> bool:
    return bool(_BORDER_RE.search(normalize_query(message)))


def is_last_mile_question(message: str) -> bool:
    return bool(_LAST_MILE_RE.search(normalize_query(message)))


def resolve_app_guide_local_reply(message: str, page: str) -> str | None:
    q = normalize_query(message)
    if "pencil icon" in q:
        return (
            "The pencil icon on Live lets you edit a dropped pin — rename the label, adjust the spot, "
            "or refine what you're sharing before you navigate or send it to your group."
        )
    if "switch travel modes" in q or "travel modes" in q:
        return (
            "Open Plan in the sidebar to switch between Flights, Hotels, Routes, and Buses. "
            "On Live, use the map tools for driving, walking, and Solo Live navigation."
        )
    if "solo live" in q:
        return (
            "Solo Live turns on turn-by-turn navigation on the map — pick a destination, tap Set destination, "
            "then Start Solo Live to follow the route with GPS."
        )
    return resolve_app_guide_message(message, page)


def resolve_last_mile_reply(ctx: dict[str, Any] | None, place: dict[str, Any] | None) -> str:
    label = _place_label(place, ctx)
    route = (ctx or {}).get("routePreview")
    if isinstance(route, dict):
        notice = route.get("lastMileNotice")
        if isinstance(notice, str) and notice.strip():
            return notice.strip()
        walk = route.get("lastMileDistanceMeters")
        if isinstance(walk, (int, float)) and walk > 0:
            ft = int(walk * 3.28084)
            return (
                f"The last mile to {label} includes about {ft} ft on foot after driving. "
                "Follow the dashed walk segment on the map."
            )
    return (
        f"The last mile is the final walk or short drive after you arrive near {label}. "
        "Zoom in on the map around your pin for footpaths and exact entry points."
    )


def resolve_border_reply(place: dict[str, Any] | None) -> str:
    label = _place_label(place, None)
    country = (place or {}).get("country") or "this country"
    return (
        f"{label} is in {country} and is not an international border crossing. "
        "It sits in the interior of the country — plan domestic travel and local entry rules."
    )


def _local_response(
    message: str,
    *,
    intent: str,
    sources: list[WayraSource] | None = None,
) -> AIAssistantResponse:
    return AIAssistantResponse(
        message=message[:1200],
        sources=sources or [],
        summary={"intent": intent, "local": True, "provider": "local", "usage": None},
    )


def resolve_meta_ai_reply(message: str) -> str:
    q = normalize_query(message)
    if "who built" in q:
        return (
            "Wayra is Rovvy's built-in travel assistant — part of the Rovvy app you are using. "
            "I help with places, routes, food, culture, and trip prep on the map."
        )
    if any(k in q for k in ("real person", "are you ai")):
        return (
            "I'm Wayra, Rovvy's AI travel assistant built into the app. "
            "I'm not a human, but I can help with the place you picked on the map."
        )
    if "behind the scenes" in q or "how does wayra" in q or "choose which ai" in q:
        return (
            "I'm Wayra, Rovvy's travel assistant. Rovvy may use different systems depending on the task, "
            "while keeping the experience and privacy controls within Rovvy."
        )
    return (
        "I'm Wayra, Rovvy's built-in travel assistant. I focus on places, routes, and trip prep. "
        "Rovvy handles provider choices internally — you don't need to pick a model."
    )


def resolve_conversation_reply(message: str, place_label: str) -> str:
    q = normalize_query(message)
    if q.startswith("thank") or "thanks" in q:
        return f"You're welcome! Ask me anything about {place_label} — food, culture, weather, or the drive."
    if "what else" in q:
        return (
            f"I can help with {place_label} — weather, food, culture, what to wear, safety tips, "
            "distance from you, and how to get there on the Live map."
        )
    if "awesome" in q:
        return f"Thank you! Happy to help you explore {place_label}."
    if "tell me more" in q:
        return f"Ask a specific question about {place_label} — food, culture, weather, restrictions, or the route."
    return (
        f"Hello! You're looking at {place_label}. "
        "Ask me about the weather, local food, culture, what to wear, or how far it is from you."
    )


def resolve_language_reply(message: str, place: dict[str, Any] | None) -> str | None:
    key = _country_key(place)
    info = _COUNTRY_LANGUAGE.get(key or "")
    if not info and place:
        city = place.get("city")
        if isinstance(city, str) and city.lower() == "moscow":
            info = _COUNTRY_LANGUAGE["russia"]
    if not info:
        country = (place or {}).get("country") or "this region"
        return (
            "Based on general travel knowledge, the main local language varies by region. "
            f"Around {country}, hello and thank you in the local language are appreciated — "
            "check the Wikipedia source link for more detail."
        )

    prefix = "Based on general travel knowledge, "
    q = normalize_query(message)
    if "hello" in q or "say hello" in q:
        return (
            f"{prefix}the primary language is {info['language']}. "
            f"Hello: {info['hello']}. Thank you: {info['thanks']}. {info['english']}"
        )
    if "english" in q:
        return f"{prefix}{info['english']} Primary language: {info['language']}."
    if "language" in q:
        return (
            f"{prefix}they primarily speak {info['language']} here. {info['english']} "
            f"Hello: {info['hello']}. Thank you: {info['thanks']}."
        )
    return (
        f"{prefix}primary language: {info['language']}. "
        f"Hello: {info['hello']}. Thank you: {info['thanks']}."
    )


def resolve_weather_reply(message: str, place: dict[str, Any] | None) -> str | None:
    if not place:
        return None
    lat, lng = place.get("lat"), place.get("lng")
    if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
        return None

    try:
        from datetime import date

        body = WeatherService.get_forecast(float(lat), float(lng), date.today())
    except Exception:  # noqa: BLE001
        return None

    label = str(place.get("name") or place.get("city") or "this location")
    sub = classify_weather_sub_intent(message)
    home_city = extract_home_city(message) if sub == "weather_comfort" else None
    home_body = _home_city_weather(home_city) if home_city else None
    return build_weather_reply(
        sub_intent=sub,
        place_label=label,
        body=body,
        home_city=home_city,
        home_body=home_body,
    )


def resolve_home_context_reply(
    message: str,
    place: dict[str, Any] | None,
    ctx: dict[str, Any] | None,
) -> str | None:
    """Distance + weather comfort from the user's home (userLocation on Live)."""
    if not place:
        return None
    from datetime import date

    parts: list[str] = []
    dist_block = build_user_place_distance_block(ctx, place)
    if dist_block:
        parts.append(dist_block.strip())

    user = (ctx or {}).get("userLocation") if ctx else None
    home_city = extract_home_city(message)
    if not home_city and isinstance(user, dict):
        home_city = str(user.get("city") or user.get("state") or "").strip() or None

    lat, lng = place.get("lat"), place.get("lng")
    if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
        try:
            body = WeatherService.get_forecast(float(lat), float(lng), date.today())
            home_body = _home_city_weather(home_city) if home_city else None
            label = _place_label(place, ctx)
            sub = classify_weather_sub_intent(message)
            if sub != "weather_comfort" and is_home_context_question(message):
                sub = "weather_comfort"
            parts.append(
                build_weather_reply(
                    sub_intent=sub,
                    place_label=label,
                    body=body,
                    home_city=home_city,
                    home_body=home_body,
                )
            )
        except Exception:  # noqa: BLE001
            pass

    if not parts:
        return None
    return " ".join(parts)


def is_where_am_i_question(message: str) -> bool:
    return bool(_WHERE_AM_I_RE.search(normalize_query(message)))


def resolve_where_am_i_reply(
    message: str,
    place: dict[str, Any] | None,
    ctx: dict[str, Any] | None,
) -> str | None:
    if not is_where_am_i_question(message):
        return None

    user = (ctx or {}).get("userLocation")
    home_label = None
    if isinstance(user, dict):
        home_label = str(
            user.get("city") or user.get("state") or user.get("country") or ""
        ).strip() or None

    if place and home_label and is_planning_from_home(ctx):
        dest_label = _place_label(place, ctx)
        u_lat, u_lng = float(user["lat"]), float(user["lng"])  # type: ignore[index]
        miles = calculate_distance_miles(u_lat, u_lng, float(place["lat"]), float(place["lng"]))
        return (
            f"You're in {home_label} right now. On the Live map you've selected {dest_label} "
            f"as your planning destination — about {miles:,.0f} mi away. "
            "Ask me how to get there from home, when to go, or what to budget for the trip."
        )

    if home_label:
        return f"You're in {home_label} right now based on your Live location."

    if place:
        return (
            f"Your map pin is on {_place_label(place, ctx)}. "
            "Turn on location if you want me to compare that to where you are physically."
        )

    return "Turn on location or pick a place on the map, then ask me again."


def resolve_navigation_reply(
    message: str,
    place: dict[str, Any] | None,
    ctx: dict[str, Any] | None,
) -> str | None:
    if not place:
        return None

    label = _place_label(place, ctx)
    q = normalize_query(message)

    if _REACH_QUESTION_RE.search(q) and is_planning_from_home(ctx):
        return None

    if re.search(r"\b(call from my location|from my location to)\b", q):
        feas = assess_drive_feasibility(ctx, place)
        if not feas.feasible and feas.message:
            return feas.message
        dist_block = build_user_place_distance_block(ctx, place)
        if dist_block:
            return (
                f"{dist_block.strip()} "
                f"{label} may be remote — research flights, boats, or regional transit if a direct drive is unavailable."
            )

    if is_drive_navigation_question(message):
        feas = assess_drive_feasibility(ctx, place)
        if not feas.feasible and feas.message:
            return feas.message

    route = (ctx or {}).get("routePreview")
    route_dict = route if isinstance(route, dict) else None

    if route_dict:
        dist = route_dict.get("distanceMeters")
        dur = route_dict.get("durationSeconds")
        if "how long" in q or "drive" in q:
            if isinstance(dur, (int, float)) and dur > 0:
                hours = int(dur) // 3600
                mins = (int(dur) % 3600) // 60
                time_s = f"{hours} hr {mins} min" if hours else f"{mins} min"
                dist_s = ""
                if isinstance(dist, (int, float)) and dist > 0:
                    dist_s = f" ({round(float(dist) / 1609.34, 1)} mi)"
                return f"Driving to {label} is about {time_s}{dist_s} on your current route preview."
        if "traffic" in q:
            return (
                f"Traffic varies — your route preview to {label} is the best estimate right now. "
                "Tap Start Solo Live on the map for live navigation."
            )
        if "best route" in q or "how do i get" in q:
            dist_s = ""
            if isinstance(dist, (int, float)) and dist > 0:
                dist_s = f" about {round(float(dist) / 1609.34, 1)} mi"
            return (
                f"Your mapped route to {label} is ready{dist_s}. "
                "Tap Start Solo Live on the Live map for turn-by-turn directions."
            )

    if "parking" in q:
        return (
            f"Parking near {label} is limited in the historic center — look for garages around the Kremlin area "
            "or use metro. Search the map for parking nearby."
        )
    if "walk" in q:
        return (
            f"You can walk around {label} once you arrive — the square itself is pedestrian. "
            "Set your destination on the Live map for walking or driving directions."
        )
    if "border" in q:
        country = place.get("country") or "this country"
        return f"{label} is in {country}. It is not a border crossing — plan domestic travel accordingly."

    return (
        f"To get to {label}: search or pick it on the Live map, tap Set destination, "
        "then Start Solo Live for turn-by-turn directions."
    )


def resolve_local_time_reply(
    message: str,
    place: dict[str, Any] | None,
    ctx: dict[str, Any] | None,
) -> str | None:
    if not place:
        return None
    lat, lng = place.get("lat"), place.get("lng")
    if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
        return None

    try:
        place_clock = WeatherService.get_local_time(float(lat), float(lng))
    except Exception:  # noqa: BLE001
        return None

    label = _place_label(place, ctx)
    tz_name = str(place_clock.get("timezone") or "local time")
    time_display = str(place_clock.get("time_display") or "")
    date_display = str(place_clock.get("date_display") or "")
    if not time_display:
        return None

    parts = [
        f"It's {time_display} at {label} ({tz_name.replace('_', ' ')}) on {date_display}."
    ]

    q = normalize_query(message)
    wants_compare = bool(
        re.search(r"\b(compare|difference|with me|same time|vs\.?|versus)\b", q)
    )
    user = (ctx or {}).get("userLocation")
    if wants_compare and isinstance(user, dict):
        u_lat, u_lng = user.get("lat"), user.get("lng")
        user_label = (
            user.get("city")
            or user.get("state")
            or user.get("country")
            or "your location"
        )
        user_clock: dict[str, Any] | None = None
        if isinstance(u_lat, (int, float)) and isinstance(u_lng, (int, float)):
            try:
                user_clock = WeatherService.get_local_time(float(u_lat), float(u_lng))
            except Exception:  # noqa: BLE001
                user_clock = None

        if user_clock:
            user_time = str(user_clock.get("time_display") or "")
            user_tz = str(user_clock.get("timezone") or "")
            if user_time:
                parts.append(f"At {user_label}, it's {user_time}.")
            place_offset = int(place_clock.get("utc_offset_seconds") or 0)
            user_offset = int(user_clock.get("utc_offset_seconds") or 0)
            if place_offset == user_offset or tz_name == user_tz:
                parts.append("You're in the same time zone — the clock reads the same.")
            else:
                diff_hours = (place_offset - user_offset) / 3600
                if abs(diff_hours) < 0.01:
                    parts.append("You're in the same time zone — the clock reads the same.")
                elif diff_hours > 0:
                    h = abs(diff_hours)
                    label_h = f"{h:g} hour" if h == 1 else f"{h:g} hours"
                    parts.append(f"{label} is {label_h} ahead of you.")
                else:
                    h = abs(diff_hours)
                    label_h = f"{h:g} hour" if h == 1 else f"{h:g} hours"
                    parts.append(f"{label} is {label_h} behind you.")

    return " ".join(parts)


def try_local_reply(
    message: str,
    page: str,
    ctx: dict[str, Any] | None,
) -> AIAssistantResponse | None:
    """Free local answers before any LLM call."""
    if not message.strip():
        return None

    on_live = _is_live_page(page, ctx)
    place = extract_place_from_context(ctx) if on_live else _extract_live_selected_place(ctx)

    if is_meta_ai_question(message):
        return _local_response(resolve_meta_ai_reply(message), intent="meta_ai")

    app_msg = resolve_app_guide_local_reply(message, page)
    if app_msg and (
        is_discovery_app_guide_question(message)
        or is_app_how_to_question(message)
    ):
        return _local_response(app_msg, intent="app_guide")

    if on_live and place and is_border_question(message):
        return _local_response(resolve_border_reply(place), intent="navigation")

    if on_live and place and is_last_mile_question(message):
        return _local_response(resolve_last_mile_reply(ctx, place), intent="navigation")

    if on_live and is_conversation_question(message):
        return _local_response(
            resolve_conversation_reply(message, _place_label(place, ctx)),
            intent="conversation",
        )

    if on_live and place and is_language_phrase_question(message):
        text = resolve_language_reply(message, place)
        if text:
            return _local_response(text, intent="language")

    if on_live and place and is_where_am_i_question(message):
        text = resolve_where_am_i_reply(message, place, ctx)
        if text:
            return _local_response(text, intent="where_am_i")

    if on_live and place and is_home_context_question(message):
        text = resolve_home_context_reply(message, place, ctx)
        if text:
            source = WayraSource(
                label="Open-Meteo weather",
                url="https://open-meteo.com/",
                source_type="weather",
                snippet=text[:120],
            )
            return _local_response(text, intent="home_context", sources=[source])

    if on_live and place and is_weather_question(message):
        text = resolve_weather_reply(message, place)
        if text:
            source = WayraSource(
                label="Open-Meteo weather",
                url="https://open-meteo.com/",
                source_type="weather",
                snippet=text[:120],
            )
            sub = classify_weather_sub_intent(message)
            return _local_response(text, intent=sub, sources=[source])

    if on_live and place and is_local_time_question(message):
        text = resolve_local_time_reply(message, place, ctx)
        if text:
            source = WayraSource(
                label="Open-Meteo local time",
                url="https://open-meteo.com/",
                source_type="weather",
                snippet=text[:120],
            )
            return _local_response(text, intent="local_time", sources=[source])

    if on_live and place and is_navigation_question(message):
        text = resolve_navigation_reply(message, place, ctx)
        if text:
            return _local_response(text, intent="navigation")

    return None
