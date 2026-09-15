"""Run Antarctica Live pin question battery through Wayra backend."""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass

from app.schemas.ai_assistant import AIAssistantRequest
from app.services.ai_assistant_service import AIAssistantService

# Vinson Massif area — typical "ice mountain" Antarctica pin
ANTARCTICA_PIN = {
    "name": "Vinson Massif",
    "lat": -78.5255,
    "lng": -85.6171,
    "category": "Mountain",
    "city": "Antarctica",
    "state": "Antarctic Treaty Area",
    "country": "Antarctica",
    "address": "Ellsworth Mountains, Antarctica",
}

USER_CHICAGO = {
    "lat": 41.8781,
    "lng": -87.6298,
    "city": "Chicago",
    "state": "Illinois",
    "country": "United States",
}

QUESTIONS = [
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
    (
        "I heard there is a place in the world that is always fully closed for six months "
        "and fully open for six months — full sunlight six months and full nighttime six months. "
        "What is that place? I had that somewhere here in my Antarctica region."
    ),
    "I have $40,000 on my hand — I want to spend 15-16 days. What should I plan from Chicago?",
    "When should I plan this trip and what flight should I catch from Chicago?",
]


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
    polar_q = (
        "sun never sets" in lower
        or "six months" in lower
        or "fully open for six months" in lower
        or "full sunlight" in lower
    )
    if polar_q and intent == "nearby":
        bad = True
        note = "polar-nearby-misfire"
    return intent, provider, not bad, note


async def main() -> int:
    ctx = {
        "pathname": "/live",
        "selectedPlace": ANTARCTICA_PIN,
        "userLocation": USER_CHICAGO,
        "liveStage": "place_preview",
        "routePreview": {
            "distanceMeters": 18_500_000,
            "durationSeconds": 2_500_000,
            "lastMileNotice": "Driving ends at the nearest road; remote polar access only by expedition.",
        },
        "contextNotice": "Far from your current area. Drive route unavailable to this exact point.",
    }

    rows: list[Row] = []
    for q in QUESTIONS:
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
                preview=text[:220].replace("\n", " "),
                ok=ok,
                note=note,
            )
        )

    fails = [r for r in rows if not r.ok]
    print("=== ANTARCTICA QA BATTERY ===")
    print(json.dumps({"pin": ANTARCTICA_PIN["name"], "total": len(rows), "failures": len(fails)}, indent=2))
    print()
    for i, r in enumerate(rows, 1):
        flag = "OK" if r.ok else "FAIL"
        print(f"[{flag}] Q{i}: {r.question[:70]}")
        print(f"      intent={r.intent} provider={r.provider} chars={r.chars} note={r.note or '-'}")
        print(f"      {r.preview}")
        print()
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
