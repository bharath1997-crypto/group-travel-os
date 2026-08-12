"""Run Live map QA question battery for any pin + home location."""

from __future__ import annotations

import argparse
import asyncio
import json
from dataclasses import dataclass
from typing import Any

from app.schemas.ai_assistant import AIAssistantRequest
from app.services.ai_assistant_service import AIAssistantService
from app.services.places_nearby_service import calculate_distance_miles

USER_CHICAGO = {
    "lat": 41.8781,
    "lng": -87.6298,
    "city": "Chicago",
    "state": "Illinois",
    "country": "United States",
}

STANDARD_QUESTIONS = [
    "Where I am right now",
    "What is the temperature right now from here?",
    "What can I do here?",
    "How many days should I spend here?",
    "What kind of food should I take over there?",
    "What kind of food should I buy there?",
    "What is the currency over there?",
    "How am I going to survive there?",
    "What things am I going to survive on in this particular location?",
    "What is the way to reach over there?",
    "Do I need any kind of certification to reach out there?",
    "How is the medical facility over there?",
    "How are the people going to stay over there?",
    "I have $40,000 on my hand — I want to spend 15-16 days. What should I plan from Chicago?",
    "When should I plan this trip and what flight should I catch from Chicago?",
]

SCENARIOS: dict[str, dict[str, Any]] = {
    "brus-laguna": {
        "pin": {
            "name": "Brus Laguna",
            "lat": 15.7308,
            "lng": -84.8486,
            "category": "Town",
            "city": "Brus Laguna",
            "state": "Gracias a Dios",
            "country": "Honduras",
            "address": "Gracias a Dios, Honduras",
        },
        "extra_question": (
            "I heard there is a place where the sun never sets for months and never rises for months. "
            "Is that anywhere near Brus Laguna or this region?"
        ),
        "last_mile": "Remote coastal town — last leg may be boat or small aircraft from La Ceiba.",
        "context_notice": "Far from your current area. International travel from the United States.",
    },
    "barcelona": {
        "pin": {
            "name": "Sagrada Família",
            "lat": 41.4036,
            "lng": 2.1744,
            "category": "Landmark",
            "city": "Barcelona",
            "state": "Catalonia",
            "country": "Spain",
            "address": "Barcelona, Catalonia, Spain",
        },
        "extra_question": (
            "I heard there is a place where the sun never sets for months and never rises for months. "
            "Is that anywhere near Barcelona or this region?"
        ),
        "last_mile": "Metro or taxi from Barcelona-El Prat Airport (~30 min).",
        "context_notice": "International trip from the United States.",
    },
    "dehcho": {
        "pin": {
            "name": "Dehcho Region",
            "lat": 61.58256,
            "lng": -121.81618,
            "category": "Region",
            "city": "Dehcho Region",
            "state": "Northwest Territories",
            "country": "Canada",
            "address": "Northwest Territories, Canada",
        },
        "extra_question": (
            "I heard there is a place where the sun never sets for months and never rises for months. "
            "Is that anywhere near the Dehcho Region?"
        ),
        "last_mile": "Long drive from Yellowknife; winter road access only in season.",
        "context_notice": "Far from your current area. Cross-border travel from the United States.",
    },
    "chicago-cortez": {
        "pin": {
            "name": "West Cortez Street",
            "lat": 41.9020,
            "lng": -87.7100,
            "category": "Address",
            "city": "Chicago",
            "state": "Illinois",
            "country": "United States",
            "address": "West Cortez Street, Chicago, IL",
            "source": "map_pick",
        },
        "route_distance_m": 5500,
        "route_duration_s": 420,
        "tester_questions": [
            "What restaurants, cafes, or attractions are near this exact spot?",
            (
                "I have a $50,000 budget for a 4-day trip starting here. Plan an insanely luxurious "
                "itinerary including private jets, 5-star hotels, Michelin-star dining, and exclusive "
                "experiences, with a full cost breakdown."
            ),
            (
                "What sources are you using for this place's details, hours, and nearby recommendations? "
                "Are they connected to live booking data?"
            ),
        ],
    },
    "chicago-hamlin": {
        "pin": {
            "name": "North Hamlin Avenue",
            "lat": 41.9045,
            "lng": -87.7210,
            "category": "Address",
            "city": "Chicago",
            "state": "Illinois",
            "country": "United States",
            "address": "North Hamlin Avenue, Chicago, IL",
            "source": "map_pick",
        },
        "route_distance_m": 6200,
        "route_duration_s": 480,
        "tester_questions": [
            "What's here, how far is it, how to prepare?",
            "What restaurants, cafes, or attractions are near this exact spot?",
        ],
    },
    "chicago-hyatt-wicker": {
        "pin": {
            "name": "Hyatt Place Chicago/Wicker Park",
            "lat": 41.9075,
            "lng": -87.6720,
            "category": "Hotel",
            "city": "Chicago",
            "state": "Illinois",
            "country": "United States",
            "address": "Hyatt Place Chicago/Wicker Park, Chicago, IL",
            "source": "search",
        },
        "route_distance_m": 4800,
        "route_duration_s": 360,
        "tester_questions": [
            "What can I do here?",
            "What restaurants, cafes, or attractions are near this exact spot?",
        ],
    },
    "chicago-springfield": {
        "pin": {
            "name": "North Springfield Avenue",
            "lat": 41.9210,
            "lng": -87.7250,
            "category": "Address",
            "city": "Chicago",
            "state": "Illinois",
            "country": "United States",
            "address": "North Springfield Avenue, Chicago, IL",
            "source": "map_pick",
        },
        "route_distance_m": 7000,
        "route_duration_s": 540,
        "tester_questions": [
            "What can I do here?",
        ],
    },
}


@dataclass
class Row:
    question: str
    intent: str
    provider: str
    chars: int
    preview: str
    ok: bool
    note: str


def _classify(message: str, summary: dict | None, text: str) -> tuple[str, str, bool, str]:
    s = summary or {}
    intent = str(s.get("intent") or s.get("tier") or s.get("parse") or "unknown")
    provider = str(s.get("provider") or ("local" if s.get("local") else "—"))
    lower = (text or "").lower()
    bad = (
        "i can still help with" in lower
        or "open the available sources for current details" in lower
        or len(text or "") < 40
        or text.strip() in {"...", "…"}
    )
    note = ""
    if "template" in provider:
        bad = True
        note = "template fallback"
    if "here's how i'd prepare" in lower and "what can i do" in message.lower():
        bad = True
        note = "travel prep misfire"
    if "where" in message.lower() and "am" in message.lower() and "dropped pin" in lower:
        bad = True
        note = "weak where-am-i"
    if "where" in message.lower() and "am" in message.lower() and "physically" not in lower and "planning" not in lower:
        if "you're at" in lower or "you are at" in lower:
            bad = True
            note = "missing-dual-context"
    if intent == "live_travel_prep" or (
        "here's how i'd prepare" in lower and "$" in message.lower()
    ):
        bad = True
        note = "travel-prep-misfire"
    if "694 hr" in lower or "11495" in lower:
        bad = True
        note = "bogus-drive-plan"
    if "near this exact spot" in message.lower() or "restaurants, cafes, or attractions" in message.lower():
        if intent != "nearby":
            bad = True
            note = "nearby-routing-misfire"
        elif "tap start solo live" in lower or "driving route" in lower and "restaurant" not in lower:
            bad = True
            note = "nearby-route-fallback"
        elif provider == "local" and "openstreetmap" in lower and "couldn't load" in lower:
            pass  # acceptable OSM outage message
    polar_q = (
        "sun never sets" in lower
        or "sun never rises" in lower
        or "polar day" in lower
        or "polar night" in lower
        or ("six months" in lower and ("sunlight" in lower or "nighttime" in lower or "night" in lower))
        or "fully open for six months" in lower
    )
    if polar_q:
        if intent == "nearby":
            bad = True
            note = "polar-nearby-misfire"
        if "openstreetmap" in lower and ("no restaurants" in lower or "didn't find mapped" in lower):
            bad = True
            note = "polar-osm-fallback"

    if "50,000" in message or "50000" in message.replace(",", ""):
        if intent == "nearby":
            bad = True
            note = "luxury-plan-nearby-misfire"
        elif "shopping or upgrades" in lower:
            unalloc = lower.find("shopping or upgrades")
            if unalloc > 0 and "remaining" in lower[max(0, unalloc - 80) : unalloc + 40]:
                bad = True
                note = "budget-under-allocated"
    return intent, provider, not bad, note


def _build_ctx(scenario: dict[str, Any]) -> dict[str, Any]:
    pin = scenario["pin"]
    miles = calculate_distance_miles(
        USER_CHICAGO["lat"],
        USER_CHICAGO["lng"],
        float(pin["lat"]),
        float(pin["lng"]),
    )
    if scenario.get("route_distance_m"):
        drive_m = int(scenario["route_distance_m"])
        drive_s = int(scenario.get("route_duration_s") or drive_m / 25)
    else:
        drive_m = int(miles * 1609.344 * 1.15)
        drive_s = int(drive_m / 25)
    return {
        "pathname": "/live",
        "selectedPlace": pin,
        "userLocation": USER_CHICAGO,
        "liveStage": "place_preview",
        "routePreview": {
            "distanceMeters": drive_m,
            "durationSeconds": drive_s,
            "lastMileNotice": scenario.get("last_mile", ""),
        },
        "contextNotice": scenario.get("context_notice", ""),
    }


async def run_scenario(name: str, scenario: dict[str, Any]) -> tuple[list[Row], int]:
    ctx = _build_ctx(scenario)
    tester_qs = scenario.get("tester_questions")
    if tester_qs:
        questions = list(tester_qs)
    else:
        questions = list(STANDARD_QUESTIONS)
        extra = scenario.get("extra_question")
        if extra:
            questions.insert(13, extra)

    rows: list[Row] = []
    for q in questions:
        req = AIAssistantRequest(page="live", user_message=q, context=ctx)
        out = await AIAssistantService.respond(req, db=None)
        text = out.message or ""
        summary = out.summary if isinstance(out.summary, dict) else {}
        intent, provider, ok, note = _classify(q, summary, text)
        rows.append(
            Row(
                question=q,
                intent=intent,
                provider=provider,
                chars=len(text),
                preview=text[:280].replace("\n", " "),
                ok=ok,
                note=note,
            )
        )
    fails = sum(1 for r in rows if not r.ok)
    return rows, fails


async def main() -> int:
    parser = argparse.ArgumentParser(description="Live map QA battery")
    parser.add_argument(
        "scenarios",
        nargs="*",
        default=["chicago-cortez", "chicago-hamlin", "chicago-hyatt-wicker", "chicago-springfield"],
        help=f"Scenario keys: {', '.join(SCENARIOS)}",
    )
    args = parser.parse_args()

    total_fails = 0
    for name in args.scenarios:
        if name not in SCENARIOS:
            print(f"Unknown scenario: {name}")
            total_fails += 1
            continue
        scenario = SCENARIOS[name]
        rows, fails = await run_scenario(name, scenario)
        total_fails += fails
        pin_name = scenario["pin"]["name"]
        print(f"\n{'=' * 60}")
        print(f"SCENARIO: {name.upper()} — {pin_name}")
        print(json.dumps({"pin": pin_name, "total": len(rows), "failures": fails}, indent=2))
        print(f"{'=' * 60}\n")
        for i, r in enumerate(rows, 1):
            flag = "OK" if r.ok else "FAIL"
            print(f"[{flag}] Q{i}: {r.question[:72]}")
            print(f"      intent={r.intent} provider={r.provider} chars={r.chars} note={r.note or '-'}")
            print(f"      {r.preview}")
            print()

    return 1 if total_fails else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
