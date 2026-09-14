"""One-off probe: run a single Wayra backend question and print token usage."""

from __future__ import annotations

import asyncio
import json
import sys

from app.schemas.ai_assistant import AIAssistantRequest
from app.services.wayra_answer_service import WayraAnswerService
from app.services.wayra_intent import WayraMode
from app.services.wayra_llm_providers import summarize_from_sources
from app.services.wayra_output_budget import resolve_output_budget

QUESTION = (
    "I am asking particularly for a plan for this particular location. What do you say?"
)
CTX = {
    "pathname": "/live",
    "selectedPlace": {
        "name": "Theodore Roosevelt Expressway",
        "lat": 46.8772,
        "lng": -96.7898,
        "city": "Fargo",
        "state": "Montana",
        "country": "United States",
    },
    "userLocation": {
        "lat": 41.8781,
        "lng": -87.6298,
        "city": "Chicago",
        "state": "Illinois",
        "country": "United States",
    },
    "routePreview": {
        "distanceMeters": 1_810_000,
        "durationSeconds": 72_000,
        "lastMileNotice": (
            "Driving ends at the nearest road; about 0.3 mi walk to the exact pin."
        ),
    },
}


async def main() -> int:
    req = AIAssistantRequest(page="live", user_message=QUESTION, context=CTX)
    budget = resolve_output_budget("location_hard", QUESTION)
    print("=== OUTPUT TIER ===")
    print(
        f"style={budget.style} "
        f"max_output_tokens={budget.max_output_tokens} "
        f"max_chars={budget.max_message_chars}"
    )
    print()

    out = await WayraAnswerService.try_answer(req, WayraMode.TRAVEL)
    usage_from = "WayraAnswerService"
    message = ""
    provider = None
    tier = None
    usage = None
    sources_count = 0

    if out is not None:
        message = out.message or ""
        provider = (out.summary or {}).get("provider")
        tier = (out.summary or {}).get("tier")
        usage = (out.summary or {}).get("usage")
        sources_count = len(out.sources or [])

    if provider == "template" or not message.strip():
        usage_from = "summarize_from_sources (direct plan tier)"
        source_block = "\n".join(
            [
                "Route duration: 1200 min",
                "Route distance: 1124.9 mi",
                "Driving ends at the nearest road; about 0.3 mi walk to the exact pin.",
                "Wikipedia: Theodore Roosevelt Expressway corridor in Montana / North Dakota.",
                "Near Medicine Lake, Antelope MT — remote prairie badlands region.",
                "User is in Chicago (~1125 mi / ~20 hr drive).",
            ]
        )
        message, provider, usage = await summarize_from_sources(
            user_message=QUESTION,
            place_label="Theodore Roosevelt Expressway",
            source_block=source_block,
            tier="location_hard",
        )

    if not message.strip():
        print("No LLM answer returned.")
        return 1

    msg = message
    print("=== ANSWER ===")
    print(msg)
    print()
    print("=== STATS ===")
    print(f"chars={len(msg)}")
    print(f"words~={len(msg.split())}")
    print(f"estimated_output_tokens~={max(1, len(msg) // 4)} (chars/4 heuristic)")
    print(f"via={usage_from}")
    print(f"provider={provider}")
    print(f"tier={tier or budget.tier}")
    if usage:
        print("=== API TOKEN USAGE ===")
        print(json.dumps(usage, indent=2))
        pt = int(usage.get("prompt_tokens") or 0)
        ot = int(usage.get("output_tokens") or 0)
        tt = int(usage.get("total_tokens") or pt + ot)
        print(f"input_tokens={pt}")
        print(f"output_tokens={ot}")
        print(f"total_tokens={tt}")
        print(f"cost_at_0.02_per_1M=${tt * 0.02 / 1_000_000:.6f}")
    else:
        print("usage=not returned")
    if out and out.sources and not sources_count:
        sources_count = len(out.sources)
    if sources_count:
        print(f"sources_count={sources_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
