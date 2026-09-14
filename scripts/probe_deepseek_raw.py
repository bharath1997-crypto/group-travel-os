import asyncio
import json

from app.services import wayra_llm_providers as p


async def main() -> None:
    user_block = (
        "Place context: Theodore Roosevelt Expressway\n"
        "User question: I am asking particularly for a plan for this particular location. "
        "What do you say?\n\n"
        "SOURCE SNIPPETS:\n"
        "Route duration: 1200 min\n"
        "Route distance: 1124.9 mi\n"
        "Driving ends at the nearest road; about 0.3 mi walk to the exact pin.\n"
        "User is in Chicago (~1125 mi / ~20 hr drive).\n\n"
        'Reply with JSON only: {"message": "<plain text answer>"}'
    )
    raw, usage = await p._call_deepseek_full(
        p._WAYRA_PLAN_SYSTEM,
        user_block,
        timeout=45.0,
        temperature=0.25,
        max_tokens=1200,
    )
    print("=== USAGE ===")
    print(json.dumps(usage, indent=2))
    print("=== RAW (first 2500 chars) ===")
    print(raw[:2500])
    parsed = p._parse_summary_json(raw, max_chars=4000)
    print("=== PARSED MESSAGE ===")
    print(parsed[:2000] if parsed else "(empty)")
    decision = p._parse_route_decision(raw)
    print("=== ROUTE DECISION ===")
    print(decision)


asyncio.run(main())
